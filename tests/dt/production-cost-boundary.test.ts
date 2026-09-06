import assert from 'node:assert/strict';
import test from 'node:test';
import { productionOperatingCostForCycle } from '../../shared/production-settlement.js';

test('production settlement presentation uses the old cycle cost without changing the catalog', () => {
  const group = { status: 'running', activeRecipeId: 'wheat-crop', cycleStartedAt: 100,
    productionLegacyRecipeId: 'wheat-crop', productionCostChangeAt: 200, productionLegacyOperatingCost: 1 };
  assert.equal(productionOperatingCostForCycle(group, group.activeRecipeId, 0.97), 1);
  assert.equal(productionOperatingCostForCycle({ ...group, cycleStartedAt: 200 }, group.activeRecipeId, 0.97), 0.97);
  assert.equal(productionOperatingCostForCycle({ ...group, status: 'stopped' }, group.activeRecipeId, 0.97), 0.97);
  assert.equal(productionOperatingCostForCycle(group, 'rice-crop', 0.97), 0.97);
  assert.equal(productionOperatingCostForCycle({ ...group, productionLegacyOperatingCost: -1 }, group.activeRecipeId, 0.97), 0.97);
  assert.equal(productionOperatingCostForCycle({}, group.activeRecipeId, 0.97), 0.97);
  assert.equal(group.productionLegacyOperatingCost, 1);
});
