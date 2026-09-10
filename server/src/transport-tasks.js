import { randomUUID, createHash } from 'node:crypto';
import {
  TRANSPORT_MODE_POLICY, TRANSPORT_FUEL_PRODUCT_ID, transportFleetCost,
  transportRouteVehicleCount, transportPolicyDurationMs, createTransportCyclePolicy,
} from '../../shared/transport-policy.js';
import {
  TRANSPORT_TASK_LIMIT, TRANSPORT_TASK_ROUTE_LIMIT, TRANSPORT_TASK_HISTORY_LIMIT,
  TRANSPORT_FREIGHT_DAILY_BUDGET, TRANSPORT_TASK_BUDGET_LIMIT,
  TRANSPORT_TASK_QUANTITY_LIMIT, TRANSPORT_TASK_DAY_MS,
  allocateTransportTasks, allocateTransportTaskCost, transportTaskSpan, transportTaskGap, taskStockKey,
} from '../../shared/transport-task-planner.js';
import { PRODUCT_CATALOG } from './industry-catalog.js';
import { provinceDistanceKm } from './province-access.js';
import { inventoryForProvince, readInventoryForProvince, provinceScopedKey, PROVINCE_CATALOG } from './provinces.js';
import { freezeCommodity, frozenForSource, consumeCommodityFreeze, releaseCommodityFreeze } from './commodity-freezes.js';
import { buildingInputPlans, planInputTotals, reconcileBuildingInputFreezes } from './building-input-freezes.js';
import { roundInternalMoney } from './money.js';

const INTERNAL = Symbol('transport-task-runtime');
const PRODUCTS = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const PROVINCES = new Set(PROVINCE_CATALOG.map((province) => province.id));
const active = (task) => task.status === 'active';
const open = (task) => active(task) || task.status === 'cancelling';
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_DAILY_CLAIMS = 100;
const safe = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const taskSource = (id) => `task:${id}`;
const fuelSource = (id) => `fuel:${id}`;
const success = (message, extra = {}) => ({ ok: true, message, ...extra });
const failure = (message) => ({ ok: false, message });

function stateFor(player, create = false) {
  if (player.transportTaskState) return player.transportTaskState;
  if (!create) return { tasks: [], quota: null };
  return player.transportTaskState = { tasks: [], quota: null };
}

function currentQuota(player, now, create = false) {
  const state = stateFor(player, create);
  const day = Math.floor((now + BEIJING_OFFSET_MS) / TRANSPORT_TASK_DAY_MS);
  if (state.quota?.day === day) return state.quota;
  const quota = { day, committedReward: 0, claimedOfferIds: [] };
  if (create) state.quota = quota;
  return quota;
}

function tasksFor(player, routeId) {
  const tasks = stateFor(player).tasks ?? [];
  return routeId === undefined ? tasks : tasks.filter((task) => task.routeId === routeId);
}

function routeFor(player, routeId) {
  return (player?.transportRoutes ?? []).find((route) => route.id === routeId);
}

function tripFor(world, userId, routeId) {
  return (world.transportShipments ?? []).find((trip) => Number(trip.ownerId) === Number(userId)
    && trip.routeId === routeId && trip.status !== 'arrived');
}

function traversalFor(route) {
  const stops = [route.sourceProvinceId, ...(route.viaProvinceIds ?? []), route.destinationProvinceId];
  return route.sourceProvinceId === route.destinationProvinceId ? stops : [...stops, ...stops.slice(0, -1).reverse()];
}

function geometryFor(route) {
  const traversal = traversalFor(route);
  const legDistances = traversal.slice(1).map((provinceId, index) => provinceDistanceKm(traversal[index], provinceId));
  return { traversal, legDistances, distanceKm: legDistances.reduce((sum, value) => sum + value, 0) };
}

function taskHeld(player, task) {
  return frozenForSource(readInventoryForProvince(player, task.productId, task.sourceProvinceId), 'transport', taskSource(task.id));
}

function fuelHeld(player, route) {
  return frozenForSource(readInventoryForProvince(player, TRANSPORT_FUEL_PRODUCT_ID, route.sourceProvinceId), 'transport', fuelSource(route.id));
}

function cargoForPlayer(world, userId) {
  return (world.transportShipments ?? []).filter((trip) => Number(trip.ownerId) === Number(userId)
    && trip.status !== 'arrived').flatMap((trip) => trip.taskCargo ?? []);
}

function buildingNeed(world, player, provinceId, productId, now) {
  let target = 0;
  let held = 0;
  for (const plan of buildingInputPlans(world, player, now, provinceId)) {
    target += safe(planInputTotals(plan)[productId] ?? 0);
    held += frozenForSource(readInventoryForProvince(player, productId, provinceId), plan.kind, plan.sourceId);
  }
  return { target, held };
}

function supplyGap(world, player, userId, task, now) {
  const need = buildingNeed(world, player, task.destinationProvinceId, task.productId, now);
  const inventory = readInventoryForProvince(player, task.productId, task.destinationProvinceId);
  const incomingCargo = cargoForPlayer(world, userId).filter((entry) => entry.kind === 'supply'
    && entry.destinationProvinceId === task.destinationProvinceId && entry.productId === task.productId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const incomingReserved = tasksFor(player).filter((other) => other.kind === 'supply' && active(other)
    && other.id !== task.id && other.destinationProvinceId === task.destinationProvinceId && other.productId === task.productId)
    .reduce((sum, other) => sum + taskHeld(player, other), 0);
  return transportTaskGap(Math.min(task.targetQuantity, need.target), safe(inventory.available) + need.held,
    incomingCargo + incomingReserved);
}

function validFuelQuote(world, provinceId, now) {
  const market = world.markets?.[provinceScopedKey(provinceId, TRANSPORT_FUEL_PRODUCT_ID)];
  const price = Number(market?.officialPrice);
  return Number.isFinite(price) && price > 0 && Number(market?.nextPriceAt) > now ? price : null;
}

/** Read-only offers; reward is based on direct road distance, never a detour or route ID. */
export function transportFreightOffers(world, player, route, now) {
  if (route.deletionPending) return [];
  const quota = currentQuota(player, now);
  if (quota.claimedOfferIds.length >= MAX_DAILY_CLAIMS) return [];
  const stops = [...new Set(traversalFor(route))];
  if (stops.length < 2) return [];
  const offers = [];
  for (let index = 0; index < 3; index += 1) {
    const sourceProvinceId = stops[index % stops.length];
    const destinationProvinceId = stops[(index + 1) % stops.length];
    const quote = validFuelQuote(world, sourceProvinceId, now);
    if (quote === null) continue;
    const digest = createHash('sha256').update(`${quota.day}:${sourceProvinceId}:${destinationProvinceId}:${index}`).digest();
    const product = PRODUCT_CATALOG[digest.readUInt32BE(0) % PRODUCT_CATALOG.length];
    const quantity = [200, 800, 2000][index];
    const id = `freight:${quota.day}:${sourceProvinceId}:${destinationProvinceId}:${product.id}:${index}`;
    if (quota.claimedOfferIds.includes(id)) continue;
    const direct = transportFleetCost('road', 2 * provinceDistanceKm(sourceProvinceId, destinationProvinceId), 1);
    const unitReward = (direct.transportFee + direct.fuelPurchased * quote * 0.99) * 1.35 / TRANSPORT_MODE_POLICY.road.capacity + 0.01;
    const reward = roundInternalMoney(unitReward * quantity);
    const deadlineAt = (quota.day + 1) * TRANSPORT_TASK_DAY_MS - BEIJING_OFFSET_MS;
    if (!Number.isFinite(reward) || reward <= 0 || reward + quota.committedReward > TRANSPORT_FREIGHT_DAILY_BUDGET) continue;
    const geometry = geometryFor(route);
    const span = transportTaskSpan(geometry.traversal, sourceProvinceId, destinationProvinceId);
    if (!span) continue;
    const legTimes = geometry.legDistances.map((distance) => transportPolicyDurationMs(createTransportCyclePolicy(route.mode), distance));
    const trips = Math.ceil(quantity / (TRANSPORT_MODE_POLICY[route.mode].capacity * transportRouteVehicleCount(route)));
    const duration = legTimes.slice(0, span.destinationVisitIndex).reduce((sum, time) => sum + time, 0)
      + Math.max(0, trips - 1) * legTimes.reduce((sum, time) => sum + time, 0);
    if (now + duration >= deadlineAt) continue;
    offers.push({ id, sourceProvinceId, destinationProvinceId, productId: product.id, quantity, reward, deadlineAt });
  }
  return offers;
}

function trimTasks(player) {
  const state = stateFor(player, true);
  const pending = state.tasks.filter(open);
  const closed = state.tasks.filter((task) => !open(task)).sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, TRANSPORT_TASK_HISTORY_LIMIT);
  state.tasks = [...pending, ...closed];
}

function setReservation(player, provinceId, productId, sourceId, target) {
  const current = readInventoryForProvince(player, productId, provinceId);
  const owned = frozenForSource(current, 'transport', sourceId);
  const next = safe(target);
  if (owned === next) return false;
  const inventory = inventoryForProvince(player, productId, provinceId);
  if (owned > next) releaseCommodityFreeze(inventory, 'transport', sourceId, owned - next);
  else freezeCommodity(inventory, 'transport', sourceId, next - owned);
  return true;
}

function pendingTaskLoads(world, userId, routeId) {
  const pending = new Map();
  const trip = tripFor(world, userId, routeId);
  for (const entry of trip?.taskAllocations ?? []) {
    if (!entry.loaded) pending.set(entry.taskId, (pending.get(entry.taskId) ?? 0) + entry.quantity);
  }
  return pending;
}

function taskRequests(world, player, userId, route, now) {
  if (route.deletionPending) return [];
  const pending = pendingTaskLoads(world, userId, route.id);
  const geometry = geometryFor(route);
  const arrivalTimes = [now];
  for (const distance of geometry.legDistances) arrivalTimes.push(arrivalTimes.at(-1) + transportPolicyDurationMs(createTransportCyclePolicy(route.mode), distance));
  return tasksFor(player, route.id).filter(active).filter((task) => {
    const span = transportTaskSpan(geometry.traversal, task.sourceProvinceId, task.destinationProvinceId);
    return span && (task.kind !== 'freight' || task.deadlineAt >= arrivalTimes[span.destinationVisitIndex]);
  })
    .map((task) => ({
      ...task, priority: task.kind === 'freight' ? 0 : 1,
      escrowQuantity: task.kind === 'freight' ? Math.max(0, safe(task.escrowQuantity) - (pending.get(task.id) ?? 0)) : 0,
      remainingQuantity: Math.max(0, (task.kind === 'freight' ? safe(task.escrowQuantity) : supplyGap(world, player, userId, task, now)) - (pending.get(task.id) ?? 0)),
      reservedQuantity: task.kind === 'supply' ? Math.max(0, taskHeld(player, task) - (pending.get(task.id) ?? 0)) : 0,
    }));
}

/** Forecast from actual assets only. Nothing is purchased or transferred here. */
export function planTransportTaskTrip(world, player, userId, route, now) {
  const geometry = geometryFor(route);
  const requests = taskRequests(world, player, userId, route, now);
  const fuelInventory = readInventoryForProvince(player, TRANSPORT_FUEL_PRODUCT_ID, route.sourceProvinceId);
  const fuelNeed = buildingNeed(world, player, route.sourceProvinceId, TRANSPORT_FUEL_PRODUCT_ID, now);
  const availableFuel = Math.max(0, safe(fuelInventory.available) - Math.max(0, fuelNeed.target - fuelNeed.held)) + fuelHeld(player, route);
  const fuelPrice = validFuelQuote(world, route.sourceProvinceId, now);
  const empty = { ready: false, reason: '等待运输需求', vehicleCount: 1, allocations: [], costs: [],
    fuelRequired: 0, transportFee: 0, transportedQuantity: 0, peakLoad: 0, geometry };
  if (requests.length === 0) return empty;
  const baseStock = {};
  for (const request of requests) {
    if (request.kind !== 'supply') continue;
    const key = taskStockKey(request.sourceProvinceId, request.productId);
    if (Object.hasOwn(baseStock, key)) continue;
    const inventory = readInventoryForProvince(player, request.productId, request.sourceProvinceId);
    const need = buildingNeed(world, player, request.sourceProvinceId, request.productId, now);
    baseStock[key] = Math.max(0, safe(inventory.available) - Math.max(0, need.target - need.held));
  }
  let best = null;
  for (let count = 1; count <= transportRouteVehicleCount(route); count += 1) {
    const candidateCost = transportFleetCost(route.mode, geometry.distanceKm, count);
    const stock = { ...baseStock };
    const originFuelKey = taskStockKey(route.sourceProvinceId, TRANSPORT_FUEL_PRODUCT_ID);
    if (Object.hasOwn(stock, originFuelKey)) {
      stock[originFuelKey] = Math.max(0, stock[originFuelKey] - Math.max(0, candidateCost.fuelPurchased - fuelHeld(player, route)));
    }
    let selected = requests;
    let plan;
    let costs;
    // Removing budget-blocked tasks allows other independent work to proceed.
    for (let pass = 0; pass <= requests.length; pass += 1) {
      plan = allocateTransportTasks({ traversal: geometry.traversal,
        capacity: TRANSPORT_MODE_POLICY[route.mode].capacity * count, requests: selected, stock });
      costs = allocateTransportTaskCost(plan.allocations, geometry.legDistances, candidateCost.transportFee);
      const blocked = new Set(costs.filter((entry) => {
        const request = selected.find((task) => task.id === entry.taskId);
        return request.kind === 'supply' && entry.cost > roundInternalMoney(request.budget - request.spent);
      }).map((entry) => entry.taskId));
      if (blocked.size === 0) break;
      selected = selected.filter((request) => !blocked.has(request.id));
    }
    if (!plan.allocations.length) continue;
    // Never send unused vehicles just because they are owned.
    if (Math.ceil(plan.peakLoad / TRANSPORT_MODE_POLICY[route.mode].capacity) !== count) continue;
    let reason = '';
    if (Number(player.credits) < candidateCost.transportFee) reason = '资金不足';
    else if (availableFuel < candidateCost.fuelPurchased) reason = '燃料不足';
    const hasSupply = plan.allocations.some((entry) => entry.kind === 'supply');
    if (!hasSupply && !reason) {
      const reward = plan.allocations.reduce((sum, entry) => {
        const task = requests.find((request) => request.id === entry.taskId);
        return sum + task.reward * entry.quantity / task.quantity;
      }, 0);
      if (fuelPrice === null) reason = '行情未就绪';
      else if (reward < (candidateCost.transportFee + candidateCost.fuelPurchased * fuelPrice * 0.99) * 1.2 + 1) reason = '委托收入不足以覆盖成本';
    }
    const candidate = { ...plan, costs, geometry, vehicleCount: count, fuelRequired: candidateCost.fuelPurchased,
      transportFee: candidateCost.transportFee, ready: !reason, reason: reason || '可启动任务运输' };
    if (!best || (candidate.ready && !best.ready)
      || (candidate.ready === best.ready && candidate.transportedQuantity > best.transportedQuantity)) best = candidate;
  }
  return best ?? { ...empty, reason: requests.some((task) => task.kind === 'supply') ? '等待原料缺口、货源或预算' : '等待可承运委托' };
}

function desiredReservations(world, player, userId, route, now) {
  const plan = planTransportTaskTrip(world, player, userId, route, now);
  const cargo = new Map(plan.allocations.filter((entry) => entry.kind === 'supply').map((entry) => [entry.taskId, entry.quantity]));
  const pending = pendingTaskLoads(world, userId, route.id);
  for (const task of tasksFor(player, route.id)) {
    if (active(task) && task.kind === 'supply') cargo.set(task.id, (cargo.get(task.id) ?? 0) + (pending.get(task.id) ?? 0));
  }
  const fuelInventory = readInventoryForProvince(player, TRANSPORT_FUEL_PRODUCT_ID, route.sourceProvinceId);
  const need = buildingNeed(world, player, route.sourceProvinceId, TRANSPORT_FUEL_PRODUCT_ID, now);
  const fuel = Math.min(plan.fuelRequired, Math.max(0, safe(fuelInventory.available) - Math.max(0, need.target - need.held)) + fuelHeld(player, route));
  const needed = tasksFor(player, route.id).some((task) => active(task) && task.kind === 'freight' && task.deadlineAt <= now)
    || tasksFor(player, route.id).some((task) => task.kind === 'supply' && taskHeld(player, task) !== (cargo.get(task.id) ?? 0))
    || fuelHeld(player, route) !== fuel;
  return { plan, cargo, fuel, needed };
}

/** Called on explicit task actions and real completed building cycles, never pure reads. */
export function reconcileTransportTaskReserves(world, player, userId, now, provinceId) {
  let changed = false;
  for (const route of player.transportRoutes ?? []) {
    const routeTasks = tasksFor(player, route.id);
    if (!routeTasks.length) continue;
    const currentTrip = tripFor(world, userId, route.id);
    if (provinceId !== undefined && route.sourceProvinceId !== provinceId
      && !routeTasks.some((task) => task.sourceProvinceId === provinceId || task.destinationProvinceId === provinceId)) continue;
    for (const task of routeTasks) {
      if (!currentTrip && active(task) && task.kind === 'freight' && task.deadlineAt <= now) {
        task.status = 'expired'; task.updatedAt = now;
        task.returnedQuantity = safe(task.returnedQuantity) + safe(task.escrowQuantity); task.escrowQuantity = 0; changed = true;
      }
    }
    const wanted = desiredReservations(world, player, userId, route, now);
    // Release excess custody first, then reserve propulsion before fuel-as-cargo.
    for (const task of routeTasks) {
      if (task.kind !== 'supply') continue;
      const next = wanted.cargo.get(task.id) ?? 0;
      if (taskHeld(player, task) > next) changed = setReservation(player, task.sourceProvinceId, task.productId, taskSource(task.id), next) || changed;
    }
    changed = setReservation(player, route.sourceProvinceId, TRANSPORT_FUEL_PRODUCT_ID, fuelSource(route.id), wanted.fuel) || changed;
    for (const task of routeTasks) {
      if (task.kind !== 'supply') continue;
      changed = setReservation(player, task.sourceProvinceId, task.productId, taskSource(task.id), wanted.cargo.get(task.id) ?? 0) || changed;
    }
  }
  return changed;
}

export function applyTransportTaskAction(world, user, payload, now) {
  const operations = new Set(['task-supply-create', 'task-freight-accept', 'task-cancel', 'task-maintain']);
  if (!operations.has(payload.operation)) return null;
  const player = world.players?.[String(user.id)];
  if (!player) return failure('玩家状态无效');
  const route = routeFor(player, payload.routeId);
  if (!route) return failure('运输路线不存在');
  if (payload.operation === 'task-cancel') {
    const task = tasksFor(player, route.id).find((entry) => entry.id === payload.taskId && active(entry));
    if (!task) return failure('运输任务不存在或已结束');
    const trip = tripFor(world, user.id, route.id);
    const carried = (trip?.taskCargo ?? []).some((entry) => entry.taskId === task.id);
    task.status = carried ? 'cancelling' : 'cancelled'; task.updatedAt = now;
    if (task.kind === 'supply') setReservation(player, task.sourceProvinceId, task.productId, taskSource(task.id), 0);
    else { task.returnedQuantity = safe(task.returnedQuantity) + safe(task.escrowQuantity); task.escrowQuantity = 0; }
    if (!trip) reconcileTransportTaskReserves(world, player, user.id, now);
    trimTasks(player);
    return success('运输任务已取消，已装车货物仍送达原目的地');
  }
  if (route.deletionPending) return failure('该路线已预约删除，不能承接新任务');
  if (payload.operation === 'task-maintain') {
    reconcileTransportTaskReserves(world, player, user.id, now);
    return success('运输任务保障已同步');
  }
  if (tasksFor(player).filter(open).length >= TRANSPORT_TASK_LIMIT
    || tasksFor(player, route.id).filter(open).length >= TRANSPORT_TASK_ROUTE_LIMIT) return failure('运输任务数量已达上限');
  let task;
  if (payload.operation === 'task-freight-accept') {
    const offer = transportFreightOffers(world, player, route, now).find((entry) => entry.id === payload.offerId);
    if (!offer) return failure('货运委托已过期、已承接或预算不足');
    const quota = currentQuota(player, now, true);
    quota.claimedOfferIds.push(offer.id);
    quota.committedReward = roundInternalMoney(quota.committedReward + offer.reward);
    task = { ...offer, id: `transport-task-${randomUUID()}`, offerId: offer.id, kind: 'freight',
      escrowQuantity: offer.quantity, paid: 0 };
  } else {
    const { sourceProvinceId, destinationProvinceId, productId, targetQuantity, budget } = payload;
    if (!PROVINCES.has(sourceProvinceId) || !PROVINCES.has(destinationProvinceId) || !PRODUCTS.has(productId)
      || !transportTaskSpan(traversalFor(route), sourceProvinceId, destinationProvinceId)) return failure('补给地区或商品无效，必须由现有路线按顺序到达');
    if (!Number.isSafeInteger(targetQuantity) || targetQuantity < 1 || targetQuantity > TRANSPORT_TASK_QUANTITY_LIMIT
      || !Number.isFinite(budget) || budget <= 0 || budget > TRANSPORT_TASK_BUDGET_LIMIT) return failure('保障数量或累计运费预算无效');
    if (buildingNeed(world, player, destinationProvinceId, productId, now).target < 1) return failure('目标地区没有使用该商品的运行中建筑');
    if (tasksFor(player).some((entry) => open(entry) && entry.kind === 'supply'
      && entry.destinationProvinceId === destinationProvinceId && entry.productId === productId)) return failure('该收货地区与商品已有补给任务，请先结束原任务');
    task = { id: `transport-task-${randomUUID()}`, kind: 'supply', sourceProvinceId, destinationProvinceId,
      productId, targetQuantity, budget: roundInternalMoney(budget) };
  }
  Object.assign(task, { routeId: route.id, status: 'active', deliveredQuantity: 0, spent: 0, createdAt: now, updatedAt: now });
  stateFor(player, true).tasks.push(task);
  reconcileTransportTaskReserves(world, player, user.id, now);
  trimTasks(player);
  return success(task.kind === 'freight' ? '货运委托已承接，将自动运输并按实际交付结算' : '产业补给已建立，将按真实缺口自动调货');
}

export function isTransportTaskStart(payload) {
  return payload.taskDispatch === true && payload[INTERNAL] !== true;
}

export function isInternalTransportTaskCall(payload) {
  return payload[INTERNAL] === true;
}

function taskById(player, id) {
  return tasksFor(player).find((task) => task.id === id);
}

function nodeCargoSummary(entries) {
  const totals = new Map();
  for (const entry of entries) totals.set(entry.productId, (totals.get(entry.productId) ?? 0) + entry.quantity);
  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}

function loadTaskAllocations(player, trip, visitIndex, now) {
  const loaded = [];
  for (const entry of trip.taskAllocations ?? []) {
    if (entry.loaded || entry.sourceVisitIndex !== visitIndex) continue;
    const task = taskById(player, entry.taskId);
    if (!task || !active(task) || (task.kind === 'freight' && task.deadlineAt <= now)) continue;
    if (entry.kind === 'supply') {
      const inventory = inventoryForProvince(player, entry.productId, entry.sourceProvinceId);
      consumeCommodityFreeze(inventory, 'transport', taskSource(task.id), entry.quantity);
      inventory.inTransit = safe(inventory.inTransit) + entry.quantity;
    } else task.escrowQuantity -= entry.quantity;
    entry.loaded = true;
    trip.taskCargo.push({ ...entry });
    loaded.push({ productId: entry.productId, quantity: entry.quantity, taskId: entry.taskId });
  }
  return nodeCargoSummary(loaded);
}

function validateTaskLoads(player, trip, visitIndex, now) {
  let total = 0;
  const inTransitDeltas = new Map();
  for (const entry of trip.taskAllocations ?? []) {
    if (entry.loaded || entry.sourceVisitIndex !== visitIndex) continue;
    const task = taskById(player, entry.taskId);
    if (!task || !active(task) || (task.kind === 'freight' && task.deadlineAt <= now)) continue;
    const available = entry.kind === 'supply' ? taskHeld(player, task) : task.escrowQuantity;
    if (available < entry.quantity || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) return null;
    if (entry.kind === 'supply') {
      const key = taskStockKey(entry.sourceProvinceId, entry.productId);
      const delta = (inTransitDeltas.get(key) ?? 0) + entry.quantity;
      const inventory = readInventoryForProvince(player, entry.productId, entry.sourceProvinceId);
      if (!Number.isSafeInteger(safe(inventory.inTransit) + delta)) return null;
      inTransitDeltas.set(key, delta);
    }
    total += entry.quantity;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

/** The core performs the existing fee/deadline transaction; custody is attached only on success. */
export function startTransportTaskCycle(world, user, payload, now, startCore) {
  const player = world.players?.[String(user.id)];
  const route = routeFor(player, payload.routeId);
  if (!player || !route || route.deletionPending) return failure('运输路线不可用');
  if (tripFor(world, user.id, route.id)) return failure('该路线已有一趟运输进行中');
  const wanted = desiredReservations(world, player, user.id, route, now);
  if (!wanted.plan.ready) return failure(wanted.plan.reason);
  if (wanted.needed) return failure('任务库存保障已变化，请先同步保障');
  const plan = wanted.plan;
  if (validateTaskLoads(player, { taskAllocations: plan.allocations }, 0, now) === null) return failure('起点任务库存超过安全范围');
  for (const entry of plan.costs) {
    const task = taskById(player, entry.taskId);
    if (!task || !Number.isSafeInteger(Math.round((task.spent + entry.cost) * 1e6))) return failure('累计运输费用超过安全范围');
  }
  const fuelInventory = inventoryForProvince(player, TRANSPORT_FUEL_PRODUCT_ID, route.sourceProvinceId);
  const fuelSnapshot = structuredClone(fuelInventory);
  // Temporarily release only this route's paid-for-next-trip custody into the core's normal fuel path.
  releaseCommodityFreeze(fuelInventory, 'transport', fuelSource(route.id), plan.fuelRequired);
  let result;
  try {
    result = startCore(world, user, { routeId: route.id, vehicleCount: plan.vehicleCount, load: [], [INTERNAL]: true }, now);
  } catch (error) {
    for (const key of Object.keys(fuelInventory)) delete fuelInventory[key];
    Object.assign(fuelInventory, fuelSnapshot);
    throw error;
  }
  if (!result.ok) {
    for (const key of Object.keys(fuelInventory)) delete fuelInventory[key];
    Object.assign(fuelInventory, fuelSnapshot);
    return result;
  }
  const trip = tripFor(world, user.id, route.id);
  trip.taskTrip = true;
  trip.taskAllocations = plan.allocations.map((entry) => ({ ...entry, loaded: false }));
  trip.taskCargo = [];
  trip.taskDelivered = [];
  trip.freightIncome = 0;
  for (const entry of plan.costs) {
    const task = taskById(player, entry.taskId);
    task.spent = roundInternalMoney(task.spent + entry.cost);
    task.updatedAt = now;
  }
  const load = loadTaskAllocations(player, trip, 0, now);
  trip.nodeHistory[0].load = load;
  if (trip.currentLeg) trip.currentLeg.remainingLoad = trip.taskCargo.reduce((sum, entry) => sum + entry.quantity, 0);
  return success('任务运输已启动，运费和燃料已一次性扣除', { cycleId: trip.id });
}

export function serviceTransportTaskNode(world, user, payload, now, serviceCore) {
  const player = world.players?.[String(user.id)];
  const route = routeFor(player, payload.routeId);
  const trip = tripFor(world, user.id, payload.routeId);
  if (!route || !trip?.taskTrip || trip.status !== 'docked'
    || payload.cycleId !== trip.id || payload.visitIndex !== trip.currentVisitIndex) return failure('运输任务节点已变化，请同步后重试');
  const visitIndex = trip.currentVisitIndex;
  const provinceId = trip.traversalStops[visitIndex];
  const finalVisit = visitIndex === trip.traversalStops.length - 1;
  const unloading = trip.taskCargo.filter((entry) => entry.destinationVisitIndex === visitIndex);
  const retained = trip.taskCargo.filter((entry) => entry.destinationVisitIndex !== visitIndex);
  if (retained.some((entry) => entry.destinationVisitIndex < visitIndex) || (finalVisit && retained.length)) return failure('任务货物目的地校验失败');
  const loadingQuantity = validateTaskLoads(player, trip, visitIndex, now);
  if (loadingQuantity === null || retained.reduce((sum, entry) => sum + entry.quantity, 0) + loadingQuantity > trip.policySnapshot.capacity) return failure('任务货物保障或运力已变化');
  const originDeltas = new Map();
  const destinationDeltas = new Map();
  let paymentMicros = 0n;
  for (const entry of unloading) {
    const task = taskById(player, entry.taskId);
    if (!task || !Number.isSafeInteger(task.deliveredQuantity + entry.quantity)) return failure('运输任务归属或累计数量无效');
    if (entry.kind === 'supply') {
      const key = taskStockKey(entry.sourceProvinceId, entry.productId);
      const out = (originDeltas.get(key) ?? 0) + entry.quantity;
      const incoming = (destinationDeltas.get(entry.productId) ?? 0) + entry.quantity;
      const origin = readInventoryForProvince(player, entry.productId, entry.sourceProvinceId);
      const destination = readInventoryForProvince(player, entry.productId, provinceId);
      if (safe(origin.inTransit) < out || !Number.isSafeInteger(safe(destination.available) + incoming)) return failure('任务库存校验失败');
      originDeltas.set(key, out); destinationDeltas.set(entry.productId, incoming);
    } else if (now <= task.deadlineAt) {
      const earned = BigInt(Math.round(task.reward * 1e6)) * BigInt(task.deliveredQuantity + entry.quantity) / BigInt(task.quantity);
      paymentMicros += earned - BigInt(Math.round(task.paid * 1e6));
    }
  }
  if (paymentMicros < 0n || !Number.isSafeInteger(Math.round(player.credits * 1e6) + Number(paymentMicros))) return failure('委托结算金额超过安全范围');
  const result = serviceCore(world, user, { routeId: route.id, cycleId: trip.id, visitIndex,
    unload: [], load: [], [INTERNAL]: true }, now);
  if (!result.ok) return result;
  for (const entry of unloading) {
    const task = taskById(player, entry.taskId);
    if (!task) throw new Error('在途运输任务缺少归属记录');
    if (entry.kind === 'supply') {
      const origin = inventoryForProvince(player, entry.productId, entry.sourceProvinceId);
      origin.inTransit -= entry.quantity;
      inventoryForProvince(player, entry.productId, provinceId).available += entry.quantity;
    }
    task.deliveredQuantity += entry.quantity;
    task.updatedAt = now;
    if (entry.kind === 'freight' && now <= task.deadlineAt) {
      const earnedMicros = Number(BigInt(Math.round(task.reward * 1e6)) * BigInt(task.deliveredQuantity) / BigInt(task.quantity));
      const payment = Math.max(0, earnedMicros / 1e6 - task.paid);
      player.credits = roundInternalMoney(player.credits + payment);
      task.paid = roundInternalMoney(task.paid + payment);
      trip.freightIncome = roundInternalMoney(trip.freightIncome + payment);
    }
    if (entry.kind === 'freight' && task.deliveredQuantity >= task.quantity) task.status = now <= task.deadlineAt ? 'completed' : 'expired';
    trip.taskDelivered.push({ ...entry, deliveredAt: now });
  }
  trip.taskCargo = retained;
  for (const task of tasksFor(player, route.id)) {
    if (task.status === 'cancelling' && !retained.some((entry) => entry.taskId === task.id)) {
      task.status = 'cancelled'; task.updatedAt = now;
    }
  }
  if (unloading.some((entry) => entry.kind === 'supply')) reconcileBuildingInputFreezes(world, player, now, provinceId);
  const load = finalVisit ? [] : loadTaskAllocations(player, trip, visitIndex, now);
  const node = trip.nodeHistory[trip.nodeHistory.length - 1];
  node.unload = nodeCargoSummary(unloading);
  node.load = load;
  if (trip.currentLeg) trip.currentLeg.remainingLoad = trip.taskCargo.reduce((sum, entry) => sum + entry.quantity, 0);
  if (finalVisit) {
    if (!routeFor(player, route.id)) cancelTransportRouteTasks(world, user.id, route, now);
    else reconcileTransportTaskReserves(world, player, user.id, now);
    trimTasks(player);
  }
  return result;
}

export function cancelTransportRouteTasks(world, userId, route, now) {
  const player = world.players?.[String(userId)];
  if (!player?.transportTaskState) return;
  for (const task of tasksFor(player, route.id)) {
    if (open(task)) { task.status = 'cancelled'; task.updatedAt = now; }
    if (task.kind === 'freight') { task.returnedQuantity = safe(task.returnedQuantity) + safe(task.escrowQuantity); task.escrowQuantity = 0; }
    if (task.kind === 'supply') setReservation(player, task.sourceProvinceId, task.productId, taskSource(task.id), 0);
  }
  setReservation(player, route.sourceProvinceId, TRANSPORT_FUEL_PRODUCT_ID, fuelSource(route.id), 0);
  trimTasks(player);
}

export function transportTaskRouteState(world, userId, route, now) {
  const player = world.players?.[String(userId)];
  if (!player || !route) return {};
  const tasks = tasksFor(player, route.id);
  const trip = tripFor(world, userId, route.id);
  const wanted = trip || route.deletionPending ? null : desiredReservations(world, player, userId, route, now);
  const plan = wanted?.plan;
  const records = tasks.map((task) => ({
    id: task.id, kind: task.kind, status: task.kind === 'freight' && active(task) && task.deadlineAt <= now ? 'expired' : task.status,
    sourceProvinceId: task.sourceProvinceId, destinationProvinceId: task.destinationProvinceId,
    productId: task.productId, quantity: task.quantity, targetQuantity: task.targetQuantity,
    deliveredQuantity: task.deliveredQuantity, reservedQuantity: task.kind === 'supply' ? taskHeld(player, task) : task.escrowQuantity,
    inTransitQuantity: cargoForPlayer(world, userId).filter((entry) => entry.taskId === task.id).reduce((sum, entry) => sum + entry.quantity, 0),
    reward: task.reward, paid: task.paid, budget: task.budget, spent: task.spent,
    deadlineAt: task.deadlineAt, createdAt: task.createdAt, updatedAt: task.updatedAt,
  }));
  const dispatch = plan ? {
    ready: plan.ready, maintenanceRequired: wanted.needed,
    reason: plan.reason, vehicleCount: plan.vehicleCount, fuelRequired: plan.fuelRequired,
    transportFee: plan.transportFee, transportedQuantity: plan.transportedQuantity,
    fingerprint: createHash('sha256').update(JSON.stringify({
      allocations: plan.allocations, ready: plan.ready, reason: plan.reason, vehicleCount: plan.vehicleCount,
      credits: player.credits, needed: wanted.needed, fuel: fuelHeld(player, route),
      records: records.map((task) => [task.id, task.status, task.reservedQuantity, task.inTransitQuantity, task.spent]),
    })).digest('hex'),
  } : null;
  return { transportBusiness: { tasks: records, offers: transportFreightOffers(world, player, route, now),
    dispatch, reservedFuel: fuelHeld(player, route), dailyRewardBudget: TRANSPORT_FREIGHT_DAILY_BUDGET,
    committedReward: currentQuota(player, now).committedReward } };
}

export function transportTaskShipmentState(trip) {
  if (!trip?.taskTrip) return {};
  const manifest = trip.status === 'arrived' ? trip.taskDelivered ?? [] : trip.taskCargo ?? [];
  return { taskTrip: true, freightIncome: Number(trip.freightIncome ?? 0),
    taskCargo: (trip.taskCargo ?? []).map((entry) => ({ taskId: entry.taskId, kind: entry.kind,
      productId: entry.productId, quantity: entry.quantity, sourceProvinceId: entry.sourceProvinceId,
      destinationProvinceId: entry.destinationProvinceId })),
    manifest: manifest.map((entry) => ({ productId: entry.productId, quantity: entry.quantity,
      destinationProvinceId: entry.destinationProvinceId, taskId: entry.taskId, kind: entry.kind })),
    deliveredQuantity: (trip.taskDelivered ?? []).reduce((sum, entry) => sum + entry.quantity, 0),
  };
}
