import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createContractRuntimeIndex,
  getContractRuntimeIndexDiagnostics,
  resetContractRuntimeIndexDiagnostics,
} from '../src/contract-runtime-index.js';

function activeContract(id, buyerId, supplierId, overrides = {}) {
  return {
    id, publisherId: buyerId, buyerId, supplierId, status: 'active',
    completedDeliveries: 0, totalDeliveries: 4,
    nextDueAt: 2_000_000 + Number(id.replace(/D/g, '') || 0),
    ...overrides,
  };
}

test('contract runtime index caches counts for large contract sets without warehouse reservations', () => {
  const world = { productionContracts: [] };
  for (let index = 0; index < 2_000; index += 1) {
    const status = index % 11 === 0 ? 'open' : index % 13 === 0 ? 'completed' : 'active';
    world.productionContracts.push(activeContract(
      'contract-' + index, index % 40 + 1, index % 60 + 101,
      {
        status,
        offerExpiresAt: status === 'open' ? 3_000_000 + index : undefined,
        nextDueAt: status === 'active' ? 2_000_000 + index : null,
      },
    ));
  }
  resetContractRuntimeIndexDiagnostics(world);
  const runtimeIndex = createContractRuntimeIndex(world);
  assert.equal(createContractRuntimeIndex(world), runtimeIndex);
  assert.equal(getContractRuntimeIndexDiagnostics(world).builds, 1);
  assert.equal(typeof runtimeIndex.reservedIncomingForBuyer, 'undefined');
  assert.equal(typeof runtimeIndex.reservedContractIncomingForBuyer, 'undefined');
  assert.ok(runtimeIndex.activeCountForParticipant(1) >= 0);
});

test('contract runtime transitions update participant and publisher counts without rebuilding', () => {
  const active = activeContract('active-1', 1, 2);
  const open = { id: 'open-1', publisherId: 3, buyerId: 3, supplierId: null, status: 'open', offerExpiresAt: 5_000 };
  const world = { productionContracts: [active, open] };
  resetContractRuntimeIndexDiagnostics(world);
  const runtimeIndex = createContractRuntimeIndex(world);
  assert.equal(runtimeIndex.activeCountForParticipant(1), 1);
  assert.equal(runtimeIndex.openCountForPublisher(3), 1);
  runtimeIndex.transition(active, () => { active.status = 'completed'; active.completedDeliveries = 4; });
  assert.equal(runtimeIndex.activeCountForParticipant(1), 0);
  runtimeIndex.transition(open, () => { open.status = 'active'; open.supplierId = 4; open.nextDueAt = 4_000; });
  assert.equal(runtimeIndex.openCountForPublisher(3), 0);
  assert.equal(runtimeIndex.activeCountForParticipant(3), 1);
  assert.equal(runtimeIndex.activeCountForParticipant(4), 1);
  assert.equal(runtimeIndex.nextDeadlineAt(), 4_000);
  assert.equal(getContractRuntimeIndexDiagnostics(world).builds, 1);
});

test('contract runtime deadline reads a live grace deadline without rebuilding', () => {
  const contract = activeContract('active-1', 1, 2, { nextDueAt: 1_000 });
  const world = { productionContracts: [contract] };
  resetContractRuntimeIndexDiagnostics(world);
  const runtimeIndex = createContractRuntimeIndex(world);
  assert.equal(runtimeIndex.nextDeadlineAt(), 1_000);
  contract.graceEndsAt = 5_000;
  assert.equal(createContractRuntimeIndex(world), runtimeIndex);
  assert.equal(runtimeIndex.nextDeadlineAt(), 5_000);
});
