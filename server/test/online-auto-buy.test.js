import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyOnlineAutoBuy } from '../src/online-auto-buy.js';
import { freezeCommodity } from '../src/commodity-freezes.js';
import { inventoryForProvince } from '../src/provinces.js';

const now = 1_800_000_000_000;
const user = { id: 9301, name: 'Compatibility', email: 'compat-cycle@example.test' };
for (const [label, extra] of [
  ['old price policy', { price: 100, maxPrice: 100, minimumFreeInventory: 0, targetFreeInventory: 100 }],
  ['forged completed cycle', { cycleCompletedAt: now, completedCycles: 100, profit: 999 }],
  ['different region', { provinceId: '120000' }],
  ['invalid quantity', { quantity: -1 }],
  ['unbounded quantity', { quantity: Number.MAX_SAFE_INTEGER }],
  ['empty compatibility payload', {}],
]) test(`retired automatic buy rejects ${label} without an asset mutation`, () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  player.credits = 1000;
  const stock = inventoryForProvince(player, 'wheat', '110000');
  stock.available = 100;
  freezeCommodity(stock, 'contract', 'contract-custody', 25);
  const before = structuredClone(world);
  const result = applyOnlineAutoBuy(world, user, { provinceId: '110000', productId: 'wheat', ...extra }, now);
  assert.equal(result.ok, false);
  assert.match(result.message, /周期完成/);
  assert.deepEqual(world, before);
});
