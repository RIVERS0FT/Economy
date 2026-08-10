import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  applyProductionContractAction,
  createProductionContractClientState,
  migrateProductionContractWorld,
  processProductionContracts,
} from '../src/contracts.js';
import { resolveAction } from '../src/game-routes.js';
import {
  getContractRuntimeIndexDiagnostics,
  resetContractRuntimeIndexDiagnostics,
} from '../src/contract-runtime-index.js';

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
  assert.equal(contract.status, 'active');
  assert.equal(contract.terminationReason, 'supplier_default');
  assert.ok(contract.breachedAt);
  assert.equal(buyer.frozenCredits, 0, '采购方货款与自身保证金应在违约确认时释放');
  assert.equal(supplier.frozenCredits, 100, '供应方违约保证金保持冻结，等待采购方主动领取');
  assert.equal(buyer.credits, 100_000, '违约确认时不得自动领取供应方保证金');
  assert.equal(supplier.stats.contractDefaults, 1);
  assert.equal(applyProductionContractAction(world, supplierUser, 'terminateProductionContractNow', { contractId: contract.id }, contract.breachedAt + 1).ok, false, '责任方不能主动解除逃避赔付');
  assert.equal(applyProductionContractAction(world, buyerUser, 'terminateProductionContractNow', { contractId: contract.id }, contract.breachedAt + 2).ok, true);
  contract = contractById(world, contract.id);
  assert.equal(contract.status, 'terminated');
  assert.equal(buyer.credits, 100_100, '采购方主动解除后才领取供应方保证金');
  assert.equal(supplier.frozenCredits, 0);
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

  resetContractRuntimeIndexDiagnostics(world);
  const client = createProductionContractClientState(world, buyerUser.id, now + 2);
  assert.equal(getContractRuntimeIndexDiagnostics(world).builds, 1);
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

test('合同最后三批可提出续签，双方确认后预留资产并在原合同完成时激活关联合同', () => {
  const { world, buyerUser, supplierUser, buyer, supplier, now } = setup();
  applyProductionContractAction(world, buyerUser, 'createProductionContract', {
    publisherRole: 'buyer',
    productId: 'wheat',
    quantityPerDelivery: 20,
    unitPrice: 3,
    deliveryIntervalMs: 10 * 60 * 1000,
    totalDeliveries: 4,
    firstDeliveryDelayMs: 10 * 60 * 1000,
  }, now);
  let contract = world.productionContracts[0];
  assert.equal(applyProductionContractAction(world, supplierUser, 'acceptProductionContract', { contractId: contract.id }, now + 1).ok, true);
  processProductionContracts(world, now + 10 * 60 * 1000 + 2);
  contract = contractById(world, contract.id);
  assert.equal(contract.completedDeliveries, 1);

  assert.equal(applyProductionContractAction(world, buyerUser, 'proposeProductionContractRenewal', {
    contractId: contract.id,
    quantityPerDelivery: 30,
    unitPrice: 4,
    deliveryIntervalMs: 30 * 60 * 1000,
    totalDeliveries: 3,
    firstDeliveryDelayMs: 10 * 60 * 1000,
  }, now + 10 * 60 * 1000 + 3).ok, true);
  contract = contractById(world, contract.id);
  assert.equal(contract.renewalProposal.status, 'proposed');
  assert.equal(contract.renewalProposal.buyerApprovedAt, undefined, '提出续签不应被视为提出方已经同意');
  assert.equal(contract.renewalProposal.supplierApprovedAt, undefined);

  const buyerCreditsBeforeApproval = buyer.credits;
  const supplierCreditsBeforeApproval = supplier.credits;
  assert.equal(applyProductionContractAction(world, supplierUser, 'acceptProductionContractRenewal', {
    contractId: contract.id,
  }, now + 10 * 60 * 1000 + 4).ok, true);
  contract = contractById(world, contract.id);
  assert.equal(contract.renewalProposal.status, 'proposed', '单方同意不得正式确认续签');
  assert.equal(contract.renewalProposal.supplierApprovedAt, now + 10 * 60 * 1000 + 4);
  assert.equal(contract.renewalProposal.buyerApprovedAt, undefined);
  assert.equal(contract.renewalProposal.buyerEscrowCredits, 0, '单方同意不得冻结续签货款');
  assert.equal(contract.renewalProposal.buyerBondCredits, 0, '单方同意不得冻结采购方保证金');
  assert.equal(contract.renewalProposal.supplierBondCredits, 0, '单方同意不得冻结供应方保证金');
  assert.equal(buyer.credits, buyerCreditsBeforeApproval);
  assert.equal(supplier.credits, supplierCreditsBeforeApproval);

  assert.equal(applyProductionContractAction(world, buyerUser, 'acceptProductionContractRenewal', {
    contractId: contract.id,
  }, now + 10 * 60 * 1000 + 5).ok, true);
  contract = contractById(world, contract.id);
  assert.equal(contract.renewalProposal.status, 'accepted');
  assert.equal(contract.renewalProposal.buyerApprovedAt, now + 10 * 60 * 1000 + 5);
  assert.equal(contract.renewalProposal.confirmedAt, now + 10 * 60 * 1000 + 5);
  assert.equal(contract.renewalProposal.buyerEscrowCredits, 120);
  assert.equal(contract.renewalProposal.buyerBondCredits, 24);
  assert.equal(contract.renewalProposal.supplierBondCredits, 24);
  assert.equal(contract.renewalProposal.supplierReservedQuantity, 30);

  processProductionContracts(world, now + 20 * 60 * 1000 + 6);
  processProductionContracts(world, now + 30 * 60 * 1000 + 7);
  processProductionContracts(world, now + 40 * 60 * 1000 + 8);
  contract = contractById(world, contract.id);
  assert.equal(contract.status, 'completed');
  assert.ok(contract.renewedToContractId);
  const renewed = contractById(world, contract.renewedToContractId);
  assert.equal(renewed.status, 'active');
  assert.equal(renewed.renewedFromContractId, contract.id);
  assert.equal(renewed.quantityPerDelivery, 30);
  assert.equal(renewed.unitPrice, 4);
  assert.equal(renewed.buyerEscrowCredits, 120);
  assert.equal(renewed.supplierReservedQuantity, 30);
  assert.ok(buyer.frozenCredits > 0);
  assert.ok(supplier.inventories.wheat.frozen >= 30);

  assert.equal(
    resolveAction('POST', `/api/game/contracts/${contract.id}/renewal/propose`).action,
    'proposeProductionContractRenewal',
  );
  assert.equal(
    resolveAction('POST', `/api/game/contracts/${contract.id}/renewal/accept`).action,
    'acceptProductionContractRenewal',
  );
});

test('采购与供应合同允许省略总批次形成长期合同，并在当前批完成后正常结束', () => {
  const { world, buyerUser, supplierUser, buyer, supplier, now } = setup();
  const createLongTerm = (publisher, role) => applyProductionContractAction(world, publisher, 'createProductionContract', {
    publisherRole: role,
    productId: 'wheat',
    quantityPerDelivery: 10,
    unitPrice: 3,
    deliveryIntervalMs: 10 * 60 * 1000,
    totalDeliveries: null,
    firstDeliveryDelayMs: 10 * 60 * 1000,
  }, now);

  assert.equal(createLongTerm(buyerUser, 'buyer').ok, true);
  let contract = world.productionContracts[0];
  assert.equal(contract.totalDeliveries, null);
  assert.equal(applyProductionContractAction(world, supplierUser, 'acceptProductionContract', { contractId: contract.id }, now + 1).ok, true);
  for (let batch = 1; batch <= 3; batch += 1) {
    processProductionContracts(world, now + batch * 10 * 60 * 1000 + batch + 1);
  }
  contract = contractById(world, contract.id);
  assert.equal(contract.completedDeliveries, 3);
  assert.equal(contract.status, 'active', '长期合同不应按完成批次数自动结束');
  assert.equal(applyProductionContractAction(world, buyerUser, 'proposeProductionContractRenewal', {
    contractId: contract.id,
    quantityPerDelivery: 10, unitPrice: 3, deliveryIntervalMs: 10 * 60 * 1000, totalDeliveries: 2, firstDeliveryDelayMs: 0,
  }, now + 31 * 60 * 1000).message, '长期合同无需续签');
  assert.equal(applyProductionContractAction(world, buyerUser, 'requestProductionContractTermination', { contractId: contract.id }, now + 31 * 60 * 1000 + 1).ok, true);
  processProductionContracts(world, now + 40 * 60 * 1000 + 5);
  contract = contractById(world, contract.id);
  assert.equal(contract.status, 'completed');
  assert.equal(contract.terminationReason, 'notice_completed');
  assert.equal(contract.completedDeliveries, 4);
  assert.ok(contract.completedAt);

  assert.equal(createLongTerm(supplierUser, 'supplier').ok, true, '供应方向也应允许长期合同');
  const supplierOffer = world.productionContracts.find((item) => item.status === 'open' && item.publisherRole === 'supplier');
  assert.ok(supplierOffer);
  assert.equal(supplierOffer.totalDeliveries, null);
  assert.equal(applyProductionContractAction(world, buyerUser, 'acceptProductionContract', { contractId: supplierOffer.id }, now + 50 * 60 * 1000).ok, true);
  assert.equal(contractById(world, supplierOffer.id).status, 'active');
  assert.ok(buyer.credits >= 0 && supplier.credits >= 0);
});

test('schema 9 迁移不会把旧 proposed 提出方隐式视为同意，旧 accepted 补齐双方确认', () => {
  const { world, buyerUser, supplierUser, now } = setup();
  const base = {
    id: 'legacy-renewal', publisherId: buyerUser.id, publisherName: '采购方', publisherRole: 'buyer',
    buyerId: buyerUser.id, buyerName: '采购方', supplierId: supplierUser.id, supplierName: '供应方',
    productId: 'wheat', quantityPerDelivery: 10, unitPrice: 2, deliveryIntervalMs: 10 * 60 * 1000,
    totalDeliveries: 2, completedDeliveries: 0, firstDeliveryDelayMs: 10 * 60 * 1000,
    createdAt: now - 1000, offerExpiresAt: now + 1000, acceptedAt: now - 500, nextDueAt: now + 1000,
    status: 'active', roundStatus: 'ready', buyerEscrowCredits: 20, supplierReservedQuantity: 10,
    buyerBondCredits: 4, supplierBondCredits: 4, buyerAutoFund: true, supplierAutoReserve: true,
  };
  const terms = { quantityPerDelivery: 12, unitPrice: 2.5, deliveryIntervalMs: 30 * 60 * 1000, totalDeliveries: 3, firstDeliveryDelayMs: 0 };

  world.productionContracts = [{
    ...base,
    renewalProposal: { id: 'legacy-proposed', status: 'proposed', proposedBy: buyerUser.id, proposedAt: now, expiresAt: now + 1000, terms },
  }];
  world.productionContractSchemaVersion = 7;
  migrateProductionContractWorld(world);
  assert.equal(world.productionContractSchemaVersion, 9);
  assert.equal(world.productionContracts[0].renewalProposal.buyerApprovedAt, undefined);
  assert.equal(world.productionContracts[0].renewalProposal.supplierApprovedAt, undefined);

  world.productionContracts = [{
    ...base,
    renewalProposal: {
      id: 'legacy-accepted', status: 'accepted', proposedBy: buyerUser.id, proposedAt: now, expiresAt: now + 1000,
      acceptedBy: supplierUser.id, acceptedAt: now + 1, terms, buyerEscrowCredits: 30, buyerBondCredits: 6, supplierBondCredits: 6,
    },
  }];
  world.productionContractSchemaVersion = 7;
  migrateProductionContractWorld(world);
  const migrated = world.productionContracts[0].renewalProposal;
  assert.equal(migrated.status, 'accepted');
  assert.equal(migrated.buyerApprovedAt, now);
  assert.equal(migrated.supplierApprovedAt, now + 1);
  assert.equal(migrated.confirmedAt, now + 1);
});

test('续签单方同意可撤销，双方未确认前不冻结资产', () => {
  const { world, buyerUser, supplierUser, buyer, supplier, now } = setup();
  applyProductionContractAction(world, buyerUser, 'createProductionContract', {
    publisherRole: 'buyer', productId: 'wheat', quantityPerDelivery: 10, unitPrice: 2,
    deliveryIntervalMs: 10 * 60 * 1000, totalDeliveries: 2, firstDeliveryDelayMs: 10 * 60 * 1000,
  }, now);
  const id = world.productionContracts[0].id;
  assert.equal(applyProductionContractAction(world, supplierUser, 'acceptProductionContract', { contractId: id }, now + 1).ok, true);
  assert.equal(applyProductionContractAction(world, buyerUser, 'proposeProductionContractRenewal', {
    contractId: id, quantityPerDelivery: 12, unitPrice: 2.5, deliveryIntervalMs: 30 * 60 * 1000,
    totalDeliveries: 3, firstDeliveryDelayMs: 10 * 60 * 1000,
  }, now + 2).ok, true);
  const buyerCredits = buyer.credits;
  const supplierCredits = supplier.credits;
  assert.equal(applyProductionContractAction(world, buyerUser, 'acceptProductionContractRenewal', { contractId: id }, now + 3).ok, true);
  let contract = contractById(world, id);
  assert.ok(contract.renewalProposal.buyerApprovedAt);
  assert.equal(contract.renewalProposal.status, 'proposed');
  assert.equal(applyProductionContractAction(world, buyerUser, 'revokeProductionContractRenewal', { contractId: id }, now + 4).ok, true);
  contract = contractById(world, id);
  assert.equal(contract.renewalProposal.buyerApprovedAt, undefined);
  assert.equal(contract.renewalProposal.status, 'proposed');
  assert.equal(buyer.credits, buyerCredits);
  assert.equal(supplier.credits, supplierCredits);
});


test('公开商品合同支持结构化议价，议价阶段不冻结资产，双方接受后按最终条款原子签约', () => {
  const { world, buyerUser, supplierUser, buyer, supplier, now } = setup();
  applyProductionContractAction(world, buyerUser, 'createProductionContract', {
    publisherRole: 'buyer',
    productId: 'wheat',
    quantityPerDelivery: 100,
    unitPrice: 3,
    deliveryIntervalMs: 30 * 60 * 1000,
    totalDeliveries: 6,
    firstDeliveryDelayMs: 30 * 60 * 1000,
  }, now);
  const contract = world.productionContracts[0];
  const buyerCreditsBefore = buyer.credits;
  const supplierCreditsBefore = supplier.credits;

  assert.equal(applyProductionContractAction(world, supplierUser, 'proposeProductionContractNegotiation', {
    contractId: contract.id,
    quantityPerDelivery: 80,
    unitPrice: 2.8,
    deliveryIntervalMs: 60 * 60 * 1000,
    totalDeliveries: 8,
    firstDeliveryDelayMs: 10 * 60 * 1000,
  }, now + 1).ok, true);
  assert.equal(contractById(world, contract.id).negotiations.length, 1);
  assert.equal(buyer.credits, buyerCreditsBefore);
  assert.equal(supplier.credits, supplierCreditsBefore);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(supplier.frozenCredits, 0);

  const negotiationId = contractById(world, contract.id).negotiations[0].id;
  assert.equal(applyProductionContractAction(world, buyerUser, 'counterProductionContractNegotiation', {
    contractId: contract.id,
    negotiationId,
    quantityPerDelivery: 90,
    unitPrice: 3.2,
    deliveryIntervalMs: 60 * 60 * 1000,
    totalDeliveries: 7,
    firstDeliveryDelayMs: 10 * 60 * 1000,
  }, now + 2).ok, true);
  assert.equal(contractById(world, contract.id).negotiations[0].revision, 2);

  assert.equal(applyProductionContractAction(world, supplierUser, 'acceptProductionContractNegotiation', {
    contractId: contract.id,
    negotiationId,
  }, now + 3).ok, true);
  const activeContract = contractById(world, contract.id);
  assert.equal(activeContract.status, 'active');
  assert.equal(activeContract.quantityPerDelivery, 90);
  assert.equal(activeContract.unitPrice, 3.2);
  assert.equal(activeContract.totalDeliveries, 7);
  assert.equal(activeContract.negotiations.length, 0);
  assert.equal(activeContract.buyerEscrowCredits, 288);
  assert.equal(activeContract.buyerBondCredits, 57.6);
  assert.equal(activeContract.supplierBondCredits, 57.6);
  assert.equal(activeContract.supplierReservedQuantity, 90);
});

test('商品合同议价最多同时三个线程、最多五轮，并只向发布者和对应发起者投影', () => {
  const { world, buyerUser, supplierUser, now } = setup();
  const thirdUser = { id: 303, email: 'third@example.com', name: '第三方' };
  const fourthUser = { id: 404, email: 'fourth@example.com', name: '第四方' };
  const fifthUser = { id: 505, email: 'fifth@example.com', name: '第五方' };
  for (const user of [thirdUser, fourthUser, fifthUser]) {
    const player = ensurePlayer(world, user, now);
    player.credits = 100_000;
    player.inventories.wheat.available = 1_000;
  }
  applyProductionContractAction(world, buyerUser, 'createProductionContract', {
    publisherRole: 'buyer',
    productId: 'wheat',
    quantityPerDelivery: 20,
    unitPrice: 3,
    deliveryIntervalMs: 30 * 60 * 1000,
    totalDeliveries: 6,
    firstDeliveryDelayMs: 0,
  }, now);
  const contract = world.productionContracts[0];
  const offer = (user, price, at) => applyProductionContractAction(world, user, 'proposeProductionContractNegotiation', {
    contractId: contract.id,
    quantityPerDelivery: 20,
    unitPrice: price,
    deliveryIntervalMs: 30 * 60 * 1000,
    totalDeliveries: 6,
    firstDeliveryDelayMs: 0,
  }, at);
  assert.equal(offer(supplierUser, 2.8, now + 1).ok, true);
  assert.equal(offer(thirdUser, 2.9, now + 2).ok, true);
  assert.equal(offer(fourthUser, 3.1, now + 3).ok, true);
  assert.equal(offer(fifthUser, 3.2, now + 4).ok, false);

  const publisherState = createProductionContractClientState(world, buyerUser.id, now + 5);
  const supplierState = createProductionContractClientState(world, supplierUser.id, now + 5);
  const outsiderState = createProductionContractClientState(world, fifthUser.id, now + 5);
  const publisherContract = publisherState.productionContracts.find((item) => item.id === contract.id);
  const supplierContract = supplierState.productionContracts.find((item) => item.id === contract.id);
  const outsiderContract = outsiderState.productionContracts.find((item) => item.id === contract.id);
  assert.equal(publisherContract.negotiations.length, 3);
  assert.equal(supplierContract.negotiations.length, 1);
  assert.equal(supplierContract.negotiations[0].isProposer, true);
  assert.equal('proposerId' in supplierContract.negotiations[0], false);
  assert.equal(outsiderContract.negotiations.length, 0);
  assert.equal(publisherState.productionContractSummary.needsAttention, 3);

  const negotiationId = contractById(world, contract.id).negotiations[0].id;
  let actor = buyerUser;
  for (let revision = 2; revision <= 5; revision += 1) {
    const response = applyProductionContractAction(world, actor, 'counterProductionContractNegotiation', {
      contractId: contract.id,
      negotiationId,
      quantityPerDelivery: 20,
      unitPrice: Number((2.8 + revision / 100).toFixed(2)),
      deliveryIntervalMs: 30 * 60 * 1000,
      totalDeliveries: 6,
      firstDeliveryDelayMs: 0,
    }, now + 10 + revision);
    assert.equal(response.ok, true);
    actor = actor.id === buyerUser.id ? supplierUser : buyerUser;
  }
  assert.equal(contractById(world, contract.id).negotiations[0].revision, 5);
  assert.equal(applyProductionContractAction(world, actor, 'counterProductionContractNegotiation', {
    contractId: contract.id,
    negotiationId,
    quantityPerDelivery: 20,
    unitPrice: 3,
    deliveryIntervalMs: 30 * 60 * 1000,
    totalDeliveries: 6,
    firstDeliveryDelayMs: 0,
  }, now + 20).ok, false);

  processProductionContracts(world, now + 24 * 60 * 60 * 1000 + 100);
  assert.equal(contractById(world, contract.id).negotiations.length, 0);
});

test('合同议价路由只解析结构化动作和稳定合同／议价 ID', () => {
  const contractId = 'contract-a';
  const negotiationId = 'negotiation-b';
  assert.equal(resolveAction('POST', `/api/game/contracts/${contractId}/negotiations`).action, 'proposeProductionContractNegotiation');
  assert.deepEqual(
    resolveAction('POST', `/api/game/contracts/${contractId}/negotiations/${negotiationId}/counter`),
    { action: 'counterProductionContractNegotiation', category: 'orders', routePayload: { contractId, negotiationId } },
  );
  assert.equal(resolveAction('POST', `/api/game/contracts/${contractId}/negotiations/${negotiationId}/accept`).action, 'acceptProductionContractNegotiation');
  assert.equal(resolveAction('POST', `/api/game/contracts/${contractId}/negotiations/${negotiationId}/reject`).action, 'rejectProductionContractNegotiation');
  assert.equal(resolveAction('POST', `/api/game/contracts/${contractId}/negotiations/${negotiationId}/revoke`).action, 'revokeProductionContractNegotiation');
});
