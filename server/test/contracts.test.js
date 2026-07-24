import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  applyProductionContractAction,
  createProductionContractClientState,
  processProductionContracts,
} from '../src/contracts.js';
import { resolveAction } from '../src/game-routes.js';

function setup(now = 1_800_000_000_000) {
  const world = createWorld(now);
  const buyerUser = { id: 101, email: 'buyer@example.com', name: '采购方' };
  const supplierUser = { id: 202, email: 'supplier@example.com', name: '供应方' };
  const buyer = ensurePlayer(world, buyerUser, now);
  const supplier = ensurePlayer(world, supplierUser, now);
  buyer.credits = 100_000;
  supplier.credits = 100_000;
  supplier.inventories.wheat.available = 1_000;
  return { world, buyerUser, supplierUser, buyer, supplier, now };
}

function contractById(world, contractId) {
  const contract = world.productionContracts.find((item) => item.id === contractId);
  assert.ok(contract);
  return contract;
}

test('长期合同按批次冻结商品和货款并原子结算，不改变市场价格', () => {
  const { world, buyerUser, supplierUser, buyer, supplier, now } = setup();
  const marketPriceBefore = world.markets.wheat.lastTradePrice;
  const marketHistoryBefore = world.markets.wheat.priceHistory.length;

  assert.deepEqual(applyProductionContractAction(world, buyerUser, 'createProductionContract', {
    publisherRole: 'buyer',
    productId: 'wheat',
    quantityPerDelivery: 100,
    unitPrice: 3,
    deliveryIntervalMs: 10 * 60 * 1000,
    totalDeliveries: 2,
    firstDeliveryDelayMs: 10 * 60 * 1000,
  }, now), { ok: true, message: '长期供货合同已发布' });

  let contract = world.productionContracts[0];
  assert.equal(contract.status, 'open');
  assert.equal(contract.buyerId, buyerUser.id);
  assert.equal(contract.supplierId, null);

  const accepted = applyProductionContractAction(world, supplierUser, 'acceptProductionContract', {
    contractId: contract.id,
  }, now + 1);
  assert.equal(accepted.ok, true);
  contract = contractById(world, contract.id);
  assert.equal(contract.status, 'active');
  assert.equal(contract.buyerEscrowCredits, 300);
  assert.equal(contract.supplierReservedQuantity, 100);
  assert.equal(supplier.inventories.wheat.frozen, 100);

  processProductionContracts(world, now + 10 * 60 * 1000 + 1);
  contract = contractById(world, contract.id);
  assert.equal(contract.completedDeliveries, 1);
  assert.equal(contract.status, 'active');
  assert.equal(buyer.inventories.wheat.available, 100);
  assert.equal(contract.buyerEscrowCredits, 300, '下一批货款应自动补充');
  assert.equal(contract.supplierReservedQuantity, 100, '下一批商品应自动准备');

  processProductionContracts(world, now + 20 * 60 * 1000 + 2);
  contract = contractById(world, contract.id);
  assert.equal(contract.completedDeliveries, 2);
  assert.equal(contract.status, 'completed');
  assert.equal(buyer.inventories.wheat.available, 200);
  assert.equal(supplier.inventories.wheat.available, 800);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(supplier.frozenCredits, 0);
  assert.equal(supplier.credits, 100_594, '两批货款各扣除 1% 服务费后支付并退回保证金');
  assert.equal(world.markets.wheat.lastTradePrice, marketPriceBefore);
  assert.equal(world.markets.wheat.priceHistory.length, marketHistoryBefore);
  assert.equal(buyer.stats.contractGoodsPurchased, 200);
  assert.equal(supplier.stats.contractGoodsSupplied, 200);
});

test('合同忽略非商品资产字段，商品不足时进入宽限期并由供应方违约', () => {
  const { world, buyerUser, supplierUser, buyer, supplier, now } = setup();
  supplier.inventories.wheat.available = 0;

  applyProductionContractAction(world, buyerUser, 'createProductionContract', {
    publisherRole: 'buyer',
    productId: 'wheat',
    quantityPerDelivery: 50,
    unitPrice: 10,
    deliveryIntervalMs: 10 * 60 * 1000,
    totalDeliveries: 2,
    firstDeliveryDelayMs: 0,
    unsupportedAssetId: 'not-supported',
    facilityTypeId: 'farm',
  }, now);
  let contract = world.productionContracts[0];
  const accepted = applyProductionContractAction(world, supplierUser, 'acceptProductionContract', {
    contractId: contract.id,
  }, now + 1);
  assert.equal(accepted.ok, true);
  contract = contractById(world, contract.id);

  processProductionContracts(world, now + 2);
  contract = contractById(world, contract.id);
  assert.equal(contract.roundStatus, 'grace');
  assert.ok(contract.graceEndsAt > now);

  processProductionContracts(world, contract.graceEndsAt + 1);
  contract = contractById(world, contract.id);
  assert.equal(contract.status, 'terminated');
  assert.equal(contract.terminationReason, 'supplier_default');
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(supplier.frozenCredits, 0);
  assert.equal(buyer.credits, 100_100, '采购方收回货款与自己的保证金，并获得供应方保证金');
  assert.equal(supplier.stats.contractDefaults, 1);
  assert.equal(contract.unsupportedAssetId, undefined);
  assert.equal(contract.facilityTypeId, undefined);
});

test('客户端状态包含进行中合同摘要，路由解析所有合同动作', () => {
  const { world, buyerUser, supplierUser, buyer, supplier, now } = setup();
  buyer.inventories.wheat.available = 100;
  supplier.inventories.wheat.available = 0;
  applyProductionContractAction(world, buyerUser, 'createProductionContract', {
    publisherRole: 'supplier',
    productId: 'wheat',
    quantityPerDelivery: 10,
    unitPrice: 5,
    deliveryIntervalMs: 30 * 60 * 1000,
    totalDeliveries: 4,
    firstDeliveryDelayMs: 30 * 60 * 1000,
  }, now);
  let contract = world.productionContracts[0];
  assert.equal(applyProductionContractAction(world, supplierUser, 'acceptProductionContract', { contractId: contract.id }, now + 1).ok, true);
  contract = contractById(world, contract.id);

  const client = createProductionContractClientState(world, buyerUser.id, now + 2);
  assert.equal(client.productionContractSummary.active, 1);
  assert.equal(client.productionContracts[0].status, 'active');
  assert.equal(client.productionContracts[0].isSupplier, true);

  assert.equal(resolveAction('POST', '/api/game/contracts').action, 'createProductionContract');
  assert.deepEqual(
    resolveAction('POST', `/api/game/contracts/${contract.id}/prepare`),
    { action: 'prepareProductionContract', category: 'orders', routePayload: { contractId: contract.id } },
  );
  assert.equal(resolveAction('POST', `/api/game/contracts/${contract.id}/terminate-now`).action, 'terminateProductionContractNow');
});
