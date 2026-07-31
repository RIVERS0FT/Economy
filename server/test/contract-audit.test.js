import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/runtime-store.js';
import { EconomyStore as PersistentEconomyStore } from '../src/storage.js';

function request(action, path, requestKey, payload = {}) {
  return { action, path, requestKey, payload, method: 'POST' };
}

function seedPlayers(store, now) {
  const buyerUser = { id: 501, email: 'audit-buyer@example.com', name: '审计采购方' };
  const supplierUser = { id: 502, email: 'audit-supplier@example.com', name: '审计供应方' };
  store.transaction(() => {
    const { revision, stateJson, world } = store.loadWorld(now);
    const buyer = ensurePlayer(world, buyerUser, now);
    const supplier = ensurePlayer(world, supplierUser, now);
    buyer.credits = 100_000;
    supplier.credits = 100_000;
    supplier.inventories.wheat.available = 1_000;
    store.saveWorldIfChanged(revision, world, now, stateJson);
  });
  return { buyerUser, supplierUser };
}

function processAt(store, now) {
  store.transaction(() => {
    const { revision, stateJson, world } = store.loadWorld(now);
    store.processWorldIfDue(world, now, undefined, { force: true, auditTrigger: 'test_scheduler' });
    store.saveWorldIfChanged(revision, world, now, stateJson);
  });
}

test('合同审计与世界状态在同一事务提交，逐批资产转移可查询且幂等重试不重复', () => {
  const now = 1_900_000_000_000;
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  const { buyerUser, supplierUser } = seedPlayers(store, now);

  const createKey = 'contract-audit-create-0001';
  const created = store.apply(buyerUser, request('createProductionContract', '/api/game/contracts', createKey, {
    publisherRole: 'buyer',
    productId: 'wheat',
    quantityPerDelivery: 100,
    unitPrice: 3,
    deliveryIntervalMs: 10 * 60 * 1000,
    totalDeliveries: 2,
    firstDeliveryDelayMs: 10 * 60 * 1000,
  }), now + 1);
  assert.equal(created.result.ok, true);

  const contractId = store.transaction(() => store.loadWorld(now + 2).world.productionContracts[0].id, { immediate: false });
  const acceptKey = 'contract-audit-accept-0001';
  const accepted = store.apply(supplierUser, request(
    'acceptProductionContract',
    `/api/game/contracts/${contractId}/accept`,
    acceptKey,
    { contractId },
  ), now + 2);
  assert.equal(accepted.result.ok, true);

  const detailAfterAccept = store.getContractAuditDetail(buyerUser, contractId, { limit: 100 });
  assert.deepEqual(
    detailAfterAccept.events.map((event) => event.eventType),
    ['contract_published', 'contract_accepted'],
  );
  assert.equal(detailAfterAccept.events[1].transfers.length, 4);

  const repeated = store.apply(supplierUser, request(
    'acceptProductionContract',
    `/api/game/contracts/${contractId}/accept`,
    acceptKey,
    { contractId },
  ), now + 3);
  assert.equal(repeated.result.ok, true);
  assert.equal(store.getContractAuditDetail(buyerUser, contractId, { limit: 100 }).events.length, 2);

  processAt(store, now + 10 * 60 * 1000 + 10);
  processAt(store, now + 20 * 60 * 1000 + 20);

  const history = store.listContractAuditHistory(buyerUser, { limit: 20 });
  assert.equal(history.items.length, 1);
  assert.equal(history.items[0].auditCompleteness, 'full');
  assert.equal(history.items[0].status, 'completed');
  assert.equal(history.items[0].grossTotal, 600);
  assert.equal(history.items[0].feeTotal, 6);
  assert.equal(history.items[0].netTotal, 594);
  assert.equal(history.items[0].transferredGoods, 200);

  const detail = store.getContractAuditDetail(buyerUser, contractId, { limit: 100 });
  assert.equal(detail.events.filter((event) => event.eventType === 'delivery_completed').length, 2);
  assert.equal(detail.events.at(-1).eventType, 'contract_completed');
  const delivery = detail.events.find((event) => event.eventType === 'delivery_completed');
  assert.ok(delivery);
  assert.equal(delivery.transfers.find((item) => item.purpose === 'delivery_goods')?.quantity, 100);
  assert.equal(delivery.transfers.find((item) => item.purpose === 'delivery_net_payment')?.quantity, 297);
  assert.equal(delivery.transfers.find((item) => item.purpose === 'market_service_fee')?.quantity, 3);
  assert.equal('revisionBefore' in delivery, false, '普通玩家响应不得暴露内部世界修订号');

  assert.throws(
    () => store.getContractAuditDetail({ id: 999 }, contractId, { limit: 100 }),
    (error) => error?.statusCode === 404,
  );
  assert.throws(
    () => store.database.prepare('UPDATE economy_contract_audit_events SET event_type = ? WHERE contract_id = ?').run('tampered', contractId),
    /append-only/,
  );
  assert.throws(
    () => store.database.prepare('DELETE FROM economy_contract_audit_transfers WHERE transfer_id = (SELECT MIN(transfer_id) FROM economy_contract_audit_transfers)').run(),
    /append-only/,
  );

  store.close();
});

test('审计写入失败时世界状态和审计事件一起回滚', () => {
  const now = 1_910_000_000_000;
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  const { buyerUser } = seedPlayers(store, now);
  store.database.exec(`
    CREATE TRIGGER fail_contract_audit_insert
    BEFORE INSERT ON economy_contract_audit_events BEGIN
      SELECT RAISE(ABORT, 'forced contract audit failure');
    END;
  `);

  assert.throws(() => store.apply(buyerUser, request('createProductionContract', '/api/game/contracts', 'contract-audit-fail-0001', {
    publisherRole: 'buyer',
    productId: 'wheat',
    quantityPerDelivery: 10,
    unitPrice: 3,
    deliveryIntervalMs: 10 * 60 * 1000,
    totalDeliveries: 2,
    firstDeliveryDelayMs: 0,
  }), now + 1), /forced contract audit failure/);

  const world = store.transaction(() => store.loadWorld(now + 2).world, { immediate: false });
  assert.equal(world.productionContracts.length, 0);
  assert.equal(store.database.prepare('SELECT COUNT(*) AS count FROM economy_contract_audit_events').get().count, 0);
  store.close();
});

test('上线前已有合同只导入部分完整摘要，不伪造逐批事件', () => {
  const databasePath = join(tmpdir(), `economy-contract-audit-${randomUUID()}.sqlite`);
  const now = 1_920_000_000_000;
  try {
    const legacyStore = new PersistentEconomyStore(databasePath, { scheduledProcessing: false });
    legacyStore.transaction(() => {
      const { revision, world } = legacyStore.loadWorld(now);
      const buyer = ensurePlayer(world, { id: 601, email: 'legacy-buyer@example.com', name: '旧采购方' }, now);
      const supplier = ensurePlayer(world, { id: 602, email: 'legacy-supplier@example.com', name: '旧供应方' }, now);
      buyer.credits = 1_000;
      supplier.credits = 1_000;
      world.productionContracts = [{
        id: 'legacy-contract-1',
        publisherId: buyer.userId,
        publisherName: buyer.playerName,
        publisherRole: 'buyer',
        buyerId: buyer.userId,
        buyerName: buyer.playerName,
        supplierId: supplier.userId,
        supplierName: supplier.playerName,
        productId: 'wheat',
        quantityPerDelivery: 20,
        unitPrice: 4,
        deliveryIntervalMs: 60 * 60 * 1000,
        totalDeliveries: 4,
        completedDeliveries: 4,
        firstDeliveryDelayMs: 0,
        createdAt: now - 10_000,
        offerExpiresAt: now - 9_000,
        acceptedAt: now - 8_000,
        nextDueAt: null,
        status: 'completed',
        roundStatus: 'ready',
        buyerEscrowCredits: 0,
        supplierReservedQuantity: 0,
        buyerBondCredits: 0,
        supplierBondCredits: 0,
        buyerAutoFund: true,
        supplierAutoReserve: true,
        marketSellFeeGross: 320,
        marketSellFeeCharged: 3,
        completedAt: now - 1_000,
      }];
      legacyStore.saveWorld(revision, world, now);
    });
    legacyStore.close();

    const store = new EconomyStore(databasePath, { scheduledProcessing: false });
    const history = store.listContractAuditHistory({ id: 601 }, { limit: 20 });
    assert.equal(history.items.length, 1);
    assert.equal(history.items[0].auditCompleteness, 'legacy_partial');
    const detail = store.getContractAuditDetail({ id: 601 }, 'legacy-contract-1', { limit: 100 });
    assert.equal(detail.events.length, 1);
    assert.equal(detail.events[0].eventType, 'legacy_snapshot_imported');
    assert.equal(detail.events[0].reasonCode, 'history_before_audit_unavailable');
    store.close();
  } finally {
    rmSync(databasePath, { force: true });
    rmSync(`${databasePath}-shm`, { force: true });
    rmSync(`${databasePath}-wal`, { force: true });
  }
});

test('合同审计按整数微单位保留小数单价、手续费和转账', () => {
  const now = 1_930_000_000_000;
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  const { buyerUser, supplierUser } = seedPlayers(store, now);
  const created = store.apply(buyerUser, request('createProductionContract', '/api/game/contracts', 'contract-audit-decimal-create', {
    publisherRole: 'buyer', productId: 'wheat', quantityPerDelivery: 3, unitPrice: 3.33,
    deliveryIntervalMs: 10 * 60 * 1000, totalDeliveries: 2, firstDeliveryDelayMs: 0,
  }), now + 1);
  assert.equal(created.result.ok, true);
  const contractId = store.transaction(() => store.loadWorld(now + 2).world.productionContracts[0].id, { immediate: false });
  assert.equal(store.apply(supplierUser, request(
    'acceptProductionContract', `/api/game/contracts/${contractId}/accept`,
    'contract-audit-decimal-accept', { contractId },
  ), now + 2).result.ok, true);
  processAt(store, now + 3);
  processAt(store, now + 10 * 60 * 1000 + 3);
  const history = store.listContractAuditHistory(buyerUser, { limit: 20 });
  assert.equal(history.items[0].unitPrice, 3.33);
  assert.equal(history.items[0].grossTotal, 19.98);
  assert.equal(history.items[0].feeTotal, 0.1998);
  assert.equal(history.items[0].netTotal, 19.7802);
  const detail = store.getContractAuditDetail(buyerUser, contractId, { limit: 100 });
  const delivery = detail.events.find((event) => event.eventType === 'delivery_completed');
  assert.equal(delivery.transfers.find((item) => item.purpose === 'delivery_net_payment')?.quantity, 9.8901);
  assert.equal(delivery.transfers.find((item) => item.purpose === 'market_service_fee')?.quantity, 0.0999);
  const stored = store.database.prepare(`
    SELECT gross_total, fee_total, money_precision_version
    FROM economy_contract_audit_contracts WHERE contract_id = ?
  `).get(contractId);
  assert.equal(stored.gross_total, 19_980_000);
  assert.equal(stored.fee_total, 199_800);
  assert.equal(stored.money_precision_version, 2);
  store.close();
});
