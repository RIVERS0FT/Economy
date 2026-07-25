import { nonContractWarehouseReservation } from './warehouse-reservations.js';

const runtimeByWorld = new WeakMap();
const diagnosticsByWorld = new WeakMap();

function numericId(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function increment(map, key, delta) {
  if (key === null || !Number.isFinite(Number(delta)) || delta === 0) return;
  const next = Number(map.get(key) || 0) + Number(delta);
  if (next <= 0) map.delete(key);
  else map.set(key, next);
}

function uniqueIds(...values) {
  return [...new Set(values.map(numericId).filter((value) => value !== null))];
}

function contractSnapshot(contract) {
  return {
    id: String(contract?.id || ''),
    status: String(contract?.status || ''),
    publisherId: numericId(contract?.publisherId),
    buyerId: numericId(contract?.buyerId),
    supplierId: numericId(contract?.supplierId),
    quantityPerDelivery: Math.max(0, Math.floor(Number(contract?.quantityPerDelivery || 0))),
    completedDeliveries: Math.max(0, Math.floor(Number(contract?.completedDeliveries || 0))),
    totalDeliveries: Math.max(0, Math.floor(Number(contract?.totalDeliveries || 0))),
    offerExpiresAt: Number(contract?.offerExpiresAt),
    nextDueAt: Number(contract?.nextDueAt),
    graceEndsAt: Number(contract?.graceEndsAt),
  };
}

function reservationQuantity(snapshot) {
  if (
    snapshot.status !== 'active'
    || snapshot.buyerId === null
    || snapshot.completedDeliveries >= snapshot.totalDeliveries
  ) return 0;
  return snapshot.quantityPerDelivery;
}

function deadlineFor(snapshot) {
  if (snapshot.status === 'open' && Number.isFinite(snapshot.offerExpiresAt)) {
    return snapshot.offerExpiresAt;
  }
  if (snapshot.status !== 'active') return null;
  if (Number.isFinite(snapshot.graceEndsAt)) return snapshot.graceEndsAt;
  return Number.isFinite(snapshot.nextDueAt) ? snapshot.nextDueAt : null;
}

function recordBuild(world) {
  const current = diagnosticsByWorld.get(world) || { builds: 0 };
  current.builds += 1;
  diagnosticsByWorld.set(world, current);
}

export function resetContractRuntimeIndexDiagnostics(world) {
  diagnosticsByWorld.set(world, { builds: 0 });
  runtimeByWorld.delete(world);
}

export function getContractRuntimeIndexDiagnostics(world) {
  return { ...(diagnosticsByWorld.get(world) || { builds: 0 }) };
}

export function invalidateContractRuntimeIndex(world) {
  runtimeByWorld.delete(world);
}

function buildContractRuntimeIndex(world) {
  recordBuild(world);
  const byId = new Map();
  const snapshots = new Map();
  const openCountByPublisher = new Map();
  const activeCountByParticipant = new Map();
  const reservedIncomingByBuyer = new Map();
  const ownedByPlayer = new Map();
  const openContracts = [];
  const activeContracts = [];
  const endedContracts = [];

  function addOwnership(snapshot, contract) {
    for (const userId of uniqueIds(snapshot.publisherId, snapshot.buyerId, snapshot.supplierId)) {
      const owned = ownedByPlayer.get(userId) || new Set();
      owned.add(contract);
      ownedByPlayer.set(userId, owned);
    }
  }

  function removeOwnership(snapshot, contract) {
    for (const userId of uniqueIds(snapshot.publisherId, snapshot.buyerId, snapshot.supplierId)) {
      const owned = ownedByPlayer.get(userId);
      if (!owned) continue;
      owned.delete(contract);
      if (owned.size === 0) ownedByPlayer.delete(userId);
    }
  }

  function addCounters(snapshot) {
    if (snapshot.status === 'open') {
      increment(openCountByPublisher, snapshot.publisherId, 1);
    }
    if (snapshot.status === 'active') {
      for (const userId of uniqueIds(snapshot.buyerId, snapshot.supplierId)) {
        increment(activeCountByParticipant, userId, 1);
      }
      increment(
        reservedIncomingByBuyer,
        snapshot.buyerId,
        reservationQuantity(snapshot),
      );
    }
  }

  function removeCounters(snapshot) {
    if (snapshot.status === 'open') {
      increment(openCountByPublisher, snapshot.publisherId, -1);
    }
    if (snapshot.status === 'active') {
      for (const userId of uniqueIds(snapshot.buyerId, snapshot.supplierId)) {
        increment(activeCountByParticipant, userId, -1);
      }
      increment(
        reservedIncomingByBuyer,
        snapshot.buyerId,
        -reservationQuantity(snapshot),
      );
    }
  }

  function addContract(contract) {
    const snapshot = contractSnapshot(contract);
    if (!snapshot.id) return contract;
    byId.set(snapshot.id, contract);
    snapshots.set(snapshot.id, snapshot);
    addCounters(snapshot);
    addOwnership(snapshot, contract);
    if (snapshot.status === 'open') openContracts.push(contract);
    else if (snapshot.status === 'active') activeContracts.push(contract);
    else endedContracts.push(contract);
    return contract;
  }

  function transition(contract, mutate) {
    const id = String(contract?.id || '');
    const previous = snapshots.get(id) || contractSnapshot(contract);
    removeCounters(previous);
    removeOwnership(previous, contract);
    let value;
    try {
      value = mutate();
    } finally {
      const next = contractSnapshot(contract);
      byId.set(next.id, contract);
      snapshots.set(next.id, next);
      addCounters(next);
      addOwnership(next, contract);
      if (previous.status !== next.status) {
        if (next.status === 'open') openContracts.push(contract);
        else if (next.status === 'active') activeContracts.push(contract);
        else endedContracts.push(contract);
      }
    }
    return value;
  }

  function removeContract(contract) {
    const id = String(contract?.id || '');
    const previous = snapshots.get(id);
    if (!previous) return false;
    removeCounters(previous);
    removeOwnership(previous, contract);
    snapshots.delete(id);
    byId.delete(id);
    return true;
  }

  for (const contract of world.productionContracts || []) addContract(contract);

  function reservedContractIncomingForBuyer(userId, exceptContractId = null) {
    const normalizedUserId = Number(userId);
    let reserved = Number(reservedIncomingByBuyer.get(normalizedUserId) || 0);
    if (exceptContractId) {
      const except = snapshots.get(String(exceptContractId));
      if (except?.buyerId === normalizedUserId) reserved -= reservationQuantity(except);
    }
    return Math.max(0, reserved);
  }

  return {
    byId,
    openContracts,
    activeContracts,
    endedContracts,
    addContract,
    transition,
    removeContract,
    contractById(contractId) {
      return byId.get(String(contractId || '')) || null;
    },
    openCountForPublisher(userId) {
      return Number(openCountByPublisher.get(Number(userId)) || 0);
    },
    activeCountForParticipant(userId) {
      return Number(activeCountByParticipant.get(Number(userId)) || 0);
    },
    reservedContractIncomingForBuyer,
    reservedIncomingForBuyer(userId, exceptContractId = null) {
      return reservedContractIncomingForBuyer(userId, exceptContractId)
        + nonContractWarehouseReservation(world, userId);
    },
    ownContractsFor(userId) {
      return [...(ownedByPlayer.get(Number(userId)) || [])]
        .filter((contract) => byId.get(String(contract.id)) === contract);
    },
    currentOpenContracts() {
      return openContracts.filter((contract) => (
        byId.get(String(contract.id)) === contract && contract.status === 'open'
      ));
    },
    currentActiveContracts() {
      return activeContracts.filter((contract) => (
        byId.get(String(contract.id)) === contract && contract.status === 'active'
      ));
    },
    nextDeadlineAt() {
      let next = null;
      for (const contract of byId.values()) {
        const deadline = deadlineFor(contractSnapshot(contract));
        if (deadline === null) continue;
        if (next === null || deadline < next) next = deadline;
      }
      return next;
    },
  };
}

export function createContractRuntimeIndex(world) {
  world.productionContracts ||= [];
  const contracts = world.productionContracts;
  const cached = runtimeByWorld.get(world);
  const lastContract = contracts.length > 0 ? contracts[contracts.length - 1] : null;
  if (
    cached
    && cached.contractsRef === contracts
    && cached.indexedLength === contracts.length
    && cached.lastContract === lastContract
  ) return cached.index;

  const index = buildContractRuntimeIndex(world);
  runtimeByWorld.set(world, {
    contractsRef: contracts,
    indexedLength: contracts.length,
    lastContract,
    index,
  });
  return index;
}
