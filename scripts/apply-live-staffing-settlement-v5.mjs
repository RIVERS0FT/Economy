import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

function update(path, transform) {
  const source = readFileSync(path, 'utf8');
  const next = transform(source);
  if (next === source) throw new Error(`${path}: no assertion update produced`);
  writeFileSync(path, next);
}

update('server/test/facility-groups.test.js', (source) => source
  .replaceAll('    cycleStaffingRateBps: 10_000,\n', '')
  .replaceAll('    cycleStaffingRateBps: 8_000,\n', '')
  .replaceAll('  assert.equal(farm.cycleStaffingRateBps, 8_000);\n', "  assert.equal(Object.hasOwn(farm, 'cycleStaffingRateBps'), false);\n")
  .replaceAll('  assert.equal(farm.cycleStaffingRateBps, 4_400);\n', "  assert.equal(Object.hasOwn(farm, 'cycleStaffingRateBps'), false);\n")
  .replace('  assert.equal(recovered.staffingRateBps, 4_999);', '  assert.equal(recovered.staffingRateBps, 5_000);'));

update('server/test/listed-factory-production.test.js', (source) => source
  .replace(', staffingUpdatedAt: now, cycleStaffingRateBps: 10_000,', ', staffingUpdatedAt: now,')
  .replace("  assert.equal(state.pendingJoinCount, 0);", "  assert.equal(Object.hasOwn(state, 'pendingJoinCount'), false);"));

unlinkSync('scripts/apply-live-staffing-settlement-v5.mjs');
console.log('Updated completion-time staffing server assertions.');
