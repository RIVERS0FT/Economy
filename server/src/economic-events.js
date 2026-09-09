import { DEFAULT_PROVINCE_ID, PROVINCE_CATALOG } from './provinces.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const EVENT_SLOT_MS = 3 * DAY_MS;
const EVENT_DURATION_MS = DAY_MS;
const EVENT_RESULT_WINDOW_MS = DAY_MS;
const EVENT_RAMP_MS = 30 * 60 * 1000;
const VISIBLE_WINDOW_MS = 7 * DAY_MS;
const REGIONAL_EVENT_SLOT_MS = DAY_MS;
const REGIONAL_EVENT_DURATION_MS = DAY_MS;
const REGIONAL_EVENT_ANNOUNCE_MS = 12 * HOUR_MS;
const REGIONAL_EVENT_RETENTION_MS = 2 * DAY_MS;
const REGIONAL_EVENT_AUDIT_LIMIT = 120;

export const ECONOMIC_EVENT_EPOCH_MS = Date.UTC(2026, 6, 27, 2, 0, 0, 0);
export const REGIONAL_ECONOMIC_EVENT_EPOCH_MS = Date.UTC(2026, 7, 31, 16, 0, 0, 0);
export const REGIONAL_ECONOMIC_EVENT_DEMAND_MULTIPLIER_BPS = 12_500;

export const ECONOMIC_EVENT_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'festival-catering',
    title: '节庆餐饮季',
    description: '居民在节庆期间增加新鲜食品、饮品和便利餐食的消费比重。',
    classMultipliersBps: Object.freeze({
      food: Object.freeze({ 'fresh-drinks': 13_500, convenience: 12_500 }),
    }),
    productMultipliersBps: Object.freeze({ fruit: 12_000, beverage: 12_000, 'prepared-meal': 12_000 }),
    classLabels: Object.freeze(['新鲜与饮品', '便利食品与糖类']),
    productIds: Object.freeze(['fruit', 'beverage', 'prepared-meal']),
  }),
  Object.freeze({
    id: 'protein-procurement',
    title: '蛋白采购季',
    description: '居民集中补充肉、蛋、奶和鱼类，蛋白质类别的需求份额上升。',
    classMultipliersBps: Object.freeze({ food: Object.freeze({ protein: 13_500 }) }),
    productMultipliersBps: Object.freeze({ meat: 11_500, eggs: 11_500, milk: 11_500, fish: 11_500 }),
    classLabels: Object.freeze(['蛋白质']),
    productIds: Object.freeze(['meat', 'eggs', 'milk', 'fish']),
  }),
  Object.freeze({
    id: 'home-renovation',
    title: '家居翻新季',
    description: '装修、包装与家居更新活动增加，木材、纸浆、木板和家具更受关注。',
    classMultipliersBps: Object.freeze({ household: Object.freeze({ home: 14_000 }) }),
    productMultipliersBps: Object.freeze({ timber: 11_500, lumber: 12_000, pulp: 12_000, furniture: 12_000 }),
    classLabels: Object.freeze(['木材、纸品与家居']),
    productIds: Object.freeze(['timber', 'lumber', 'pulp', 'furniture']),
  }),
  Object.freeze({
    id: 'seasonal-apparel',
    title: '换季采购期',
    description: '穿着维护和换季采购增加，纺织产业链的终端需求份额上升。',
    classMultipliersBps: Object.freeze({ household: Object.freeze({ wear: 14_000 }) }),
    productMultipliersBps: Object.freeze({ cotton: 11_500, wool: 11_500, textile: 11_500, clothing: 11_500 }),
    classLabels: Object.freeze(['穿着与纺织']),
    productIds: Object.freeze(['cotton', 'wool', 'textile', 'clothing']),
  }),
  Object.freeze({
    id: 'daily-restocking',
    title: '日用补库期',
    description: '能源、包装和日用材料进入集中补库阶段，相关商品的选择权重上升。',
    classMultipliersBps: Object.freeze({ household: Object.freeze({ daily: 13_500 }) }),
    productMultipliersBps: Object.freeze({ paper: 11_500, 'crude-oil': 11_500, plastic: 11_500 }),
    classLabels: Object.freeze(['能源、包装与日用消耗']),
    productIds: Object.freeze(['paper', 'crude-oil', 'plastic']),
  }),
  Object.freeze({
    id: 'equipment-renewal',
    title: '设备更新潮',
    description: '建设维修和设备更新活动增加，金属、机械、电子产品和家电更受关注。',
    classMultipliersBps: Object.freeze({ household: Object.freeze({ durables: 13_500 }) }),
    productMultipliersBps: Object.freeze({ steel: 11_500, copper: 11_500, machinery: 12_000, electronics: 12_000, appliance: 12_000 }),
    classLabels: Object.freeze(['金属建设与耐用品']),
    productIds: Object.freeze(['steel', 'copper', 'machinery', 'electronics', 'appliance']),
  }),
]);

const EVENT_TEMPLATE_BY_ID = new Map(ECONOMIC_EVENT_TEMPLATES.map((template) => [template.id, template]));

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function eventForSlot(slotIndex) {
  const template = ECONOMIC_EVENT_TEMPLATES[modulo(slotIndex, ECONOMIC_EVENT_TEMPLATES.length)];
  const startsAt = ECONOMIC_EVENT_EPOCH_MS + slotIndex * EVENT_SLOT_MS;
  return {
    id: `economic-event-${slotIndex}-${template.id}`,
    template,
    startsAt,
    endsAt: startsAt + EVENT_DURATION_MS,
    announcedAt: startsAt - 2 * DAY_MS,
  };
}

function slotIndexAt(now) {
  return Math.floor((Number(now) - ECONOMIC_EVENT_EPOCH_MS) / EVENT_SLOT_MS);
}

function nearbyEvents(now, before = 3, after = 5) {
  const base = slotIndexAt(now);
  const events = [];
  for (let offset = -before; offset <= after; offset += 1) events.push(eventForSlot(base + offset));
  return events;
}

function eventStrength(event, now) {
  if (!event || now < event.startsAt || now >= event.endsAt) return 0;
  const rampIn = Math.min(1, Math.max(0, (now - event.startsAt) / EVENT_RAMP_MS));
  const rampOut = Math.min(1, Math.max(0, (event.endsAt - now) / EVENT_RAMP_MS));
  return Math.min(rampIn, rampOut);
}

function activeEvent(now) {
  return nearbyEvents(now, 1, 1).find((event) => now >= event.startsAt && now < event.endsAt) || null;
}

function regionalSlotIndexAt(now) {
  return Math.floor((Number(now) - REGIONAL_ECONOMIC_EVENT_EPOCH_MS) / REGIONAL_EVENT_SLOT_MS);
}

function activeProvinceIds(world) {
  const active = new Set();
  for (const player of Object.values(world?.players || {})) {
    if (player?.startingProvinceId) active.add(String(player.startingProvinceId));
    for (const group of player?.facilityGroups || []) {
      if (Number(group?.count || 0) > 0 && group?.provinceId) active.add(String(group.provinceId));
    }
  }
  const valid = PROVINCE_CATALOG.map((province) => province.id).filter((provinceId) => active.has(provinceId));
  return valid.length > 0 ? valid : [DEFAULT_PROVINCE_ID];
}

function ensureRegionalState(world) {
  world.marketDemand ||= {};
  const previous = world.marketDemand.regionalEvents;
  const state = previous && typeof previous === 'object' ? previous : {};
  state.modelVersion = 1;
  state.events = Array.isArray(state.events) ? state.events : [];
  state.audit = Array.isArray(state.audit) ? state.audit : [];
  world.marketDemand.regionalEvents = state;
  return state;
}

function createRegionalEvent(world, slotIndex) {
  const provinces = activeProvinceIds(world);
  const provinceId = provinces[modulo(slotIndex * 7 + 3, provinces.length)];
  const province = PROVINCE_CATALOG.find((candidate) => candidate.id === provinceId);
  const template = ECONOMIC_EVENT_TEMPLATES[modulo(slotIndex * 5 + 1, ECONOMIC_EVENT_TEMPLATES.length)];
  const startsAt = REGIONAL_ECONOMIC_EVENT_EPOCH_MS + slotIndex * REGIONAL_EVENT_SLOT_MS;
  return {
    id: `regional-event-${slotIndex}-${provinceId}-${template.id}`,
    slotIndex,
    templateId: template.id,
    provinceId,
    provinceName: province?.name || provinceId,
    title: `${province?.shortName || province?.name || provinceId} · ${template.title}`,
    description: `${province?.name || provinceId}出现限时需求变化：${template.description}`,
    announcedAt: startsAt - REGIONAL_EVENT_ANNOUNCE_MS,
    startsAt,
    endsAt: startsAt + REGIONAL_EVENT_DURATION_MS,
    demandMultiplierBps: REGIONAL_ECONOMIC_EVENT_DEMAND_MULTIPLIER_BPS,
    createdAt: Math.min(Date.now(), startsAt),
    closedAt: null,
  };
}

function recordRegionalAudit(state, event, action, now) {
  if (state.audit.some((entry) => entry.eventId === event.id && entry.action === action)) return;
  state.audit.push({
    eventId: event.id,
    action,
    provinceId: event.provinceId,
    templateId: event.templateId,
    createdAt: Number(now),
  });
  if (state.audit.length > REGIONAL_EVENT_AUDIT_LIMIT) state.audit.splice(0, state.audit.length - REGIONAL_EVENT_AUDIT_LIMIT);
}

export function processRegionalEconomicEvents(world, now = Date.now()) {
  const normalizedNow = Math.max(0, Number(now) || 0);
  const state = ensureRegionalState(world);
  const baseSlot = regionalSlotIndexAt(normalizedNow);
  for (let offset = -1; offset <= 2; offset += 1) {
    const slotIndex = baseSlot + offset;
    if (state.events.some((event) => Number(event.slotIndex) === slotIndex)) continue;
    const event = createRegionalEvent(world, slotIndex);
    event.createdAt = normalizedNow;
    state.events.push(event);
    recordRegionalAudit(state, event, 'created', normalizedNow);
  }
  for (const event of state.events) {
    if (normalizedNow >= Number(event.endsAt) && !event.closedAt) {
      event.closedAt = normalizedNow;
      recordRegionalAudit(state, event, 'ended', normalizedNow);
    }
  }
  state.events = state.events
    .filter((event) => Number(event.endsAt) > normalizedNow - REGIONAL_EVENT_RETENTION_MS)
    .sort((left, right) => Number(left.startsAt) - Number(right.startsAt) || String(left.id).localeCompare(String(right.id)));
  state.lastProcessedAt = normalizedNow;
  return state;
}

export function regionalEconomicEventForProvince(world, provinceId, now = Date.now()) {
  const normalizedNow = Math.max(0, Number(now) || 0);
  const state = processRegionalEconomicEvents(world, normalizedNow);
  return state.events.find((event) => (
    String(event.provinceId) === String(provinceId)
    && normalizedNow >= Number(event.startsAt)
    && normalizedNow < Number(event.endsAt)
  )) || null;
}

function applyClassMultipliers(baseShares, multipliers, strength) {
  const entries = Object.entries(baseShares || {});
  if (strength <= 0 || entries.length === 0 || Object.keys(multipliers || {}).length === 0) return { ...(baseShares || {}) };
  const weighted = entries.map(([classId, share]) => {
    const base = Math.max(0, Number(share || 0));
    const targetMultiplier = Math.max(0, Number(multipliers[classId] || 10_000)) / 10_000;
    return [classId, base * (1 + (targetMultiplier - 1) * strength)];
  });
  const total = weighted.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return { ...(baseShares || {}) };
  return Object.fromEntries(weighted.map(([classId, value]) => [classId, value / total]));
}

export function economicEventRegionalClassShares(world, groupId, baseShares, now = Date.now(), provinceId = DEFAULT_PROVINCE_ID) {
  const event = regionalEconomicEventForProvince(world, provinceId, now);
  const template = event ? EVENT_TEMPLATE_BY_ID.get(event.templateId) : null;
  return applyClassMultipliers(baseShares, template?.classMultipliersBps?.[groupId] || {}, event ? 1 : 0);
}

export function economicEventRegionalProductWeight(world, productId, now = Date.now(), provinceId = DEFAULT_PROVINCE_ID) {
  const event = regionalEconomicEventForProvince(world, provinceId, now);
  const template = event ? EVENT_TEMPLATE_BY_ID.get(event.templateId) : null;
  if (!template) return 1;
  return Math.max(0, Number(template.productMultipliersBps?.[productId] || 10_000)) / 10_000;
}

export function createEconomicCalendarClientState(now = Date.now(), world = null) {
  const normalizedNow = Math.max(0, Number(now) || 0);
  const visibleUntil = normalizedNow + VISIBLE_WINDOW_MS;
  const globalEvents = nearbyEvents(normalizedNow, 1, 4)
    .filter((event) => event.endsAt > normalizedNow - EVENT_RESULT_WINDOW_MS && event.startsAt <= visibleUntil)
    .map((event) => ({
      id: event.id,
      templateId: event.template.id,
      scope: 'global',
      title: event.template.title,
      description: event.template.description,
      announcedAt: event.announcedAt,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      rampMs: EVENT_RAMP_MS,
      classLabels: [...event.template.classLabels],
      productIds: [...event.template.productIds],
    }));
  const regionalEvents = (world?.marketDemand?.regionalEvents?.events || [])
    .filter((event) => Number(event.endsAt) > normalizedNow - EVENT_RESULT_WINDOW_MS && Number(event.startsAt) <= visibleUntil)
    .map((event) => {
      const template = EVENT_TEMPLATE_BY_ID.get(String(event.templateId));
      return {
        id: String(event.id),
        templateId: String(event.templateId),
        scope: 'regional',
        provinceId: String(event.provinceId),
        provinceName: String(event.provinceName || event.provinceId),
        title: String(event.title || template?.title || '地区经济事件'),
        description: String(event.description || template?.description || ''),
        announcedAt: Number(event.announcedAt),
        startsAt: Number(event.startsAt),
        endsAt: Number(event.endsAt),
        rampMs: 0,
        demandMultiplierBps: Number(event.demandMultiplierBps || REGIONAL_ECONOMIC_EVENT_DEMAND_MULTIPLIER_BPS),
        classLabels: [...(template?.classLabels || [])],
        productIds: [...(template?.productIds || [])],
      };
    });
  return {
    version: 3,
    timeZone: 'Asia/Shanghai',
    events: [...globalEvents, ...regionalEvents].sort((left, right) => left.startsAt - right.startsAt || left.id.localeCompare(right.id)),
  };
}

export function economicEventClassShares(modelId, groupId, baseShares, now = Date.now()) {
  void modelId;
  const event = activeEvent(Number(now));
  const strength = eventStrength(event, Number(now));
  return applyClassMultipliers(baseShares, event?.template.classMultipliersBps?.[groupId] || {}, strength);
}

export function economicEventProductWeight(productId, now = Date.now()) {
  const event = activeEvent(Number(now));
  const strength = eventStrength(event, Number(now));
  if (strength <= 0) return 1;
  const target = Math.max(0, Number(event.template.productMultipliersBps?.[productId] || 10_000)) / 10_000;
  return 1 + (target - 1) * strength;
}

export function nextEconomicEventDeadline(now = Date.now()) {
  const normalizedNow = Math.max(0, Number(now) || 0);
  let next = null;
  for (const event of nearbyEvents(normalizedNow, 4, 6)) {
    for (const candidate of [event.startsAt, event.endsAt]) {
      if (candidate <= normalizedNow) continue;
      if (next === null || candidate < next) next = candidate;
    }
  }
  const regionalBase = regionalSlotIndexAt(normalizedNow);
  for (let offset = -1; offset <= 3; offset += 1) {
    const startsAt = REGIONAL_ECONOMIC_EVENT_EPOCH_MS + (regionalBase + offset) * REGIONAL_EVENT_SLOT_MS;
    for (const candidate of [startsAt, startsAt + REGIONAL_EVENT_DURATION_MS]) {
      if (candidate <= normalizedNow) continue;
      if (next === null || candidate < next) next = candidate;
    }
  }
  return next;
}
