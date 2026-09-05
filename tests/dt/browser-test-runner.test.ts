import assert from 'node:assert/strict';
import test from 'node:test';
import { browserTestPlan, MAP_PERFORMANCE_PATTERN } from '../../scripts/run-browser-tests.mjs';

const perfFile = 'tests/browser/map-zoom-transient.spec.ts';

test('full browser run isolates map performance after functional tests', () => {
  const plan = browserTestPlan([]);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].kind, 'functional');
  assert.deepEqual(plan[0].args, ['--grep-invert', MAP_PERFORMANCE_PATTERN, '--pass-with-no-tests']);
  assert.deepEqual(plan[1], {
    kind: 'map-performance',
    args: [perfFile, '--grep', MAP_PERFORMANCE_PATTERN, '--workers=1'],
  });
});

test('only final full shard owns the isolated performance gate', () => {
  const first = browserTestPlan(['--shard=1/4']);
  assert.equal(first.length, 1);
  assert.equal(first[0].kind, 'functional');
  const final = browserTestPlan(['--shard=4/4']);
  assert.equal(final.length, 2);
  assert.equal(final[1].kind, 'map-performance');
});

test('targeted non-map browser selection does not add an unrelated performance gate', () => {
  const plan = browserTestPlan(['tests/browser/bank-runtime.spec.ts', '--shard=4/4']);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'functional');
});

test('targeted map selection keeps performance isolated on the final shard', () => {
  const plan = browserTestPlan([perfFile, '--shard=4/4']);
  assert.equal(plan.length, 2);
  assert.equal(plan[1].kind, 'map-performance');
});

test('explicit grep remains a direct developer-controlled Playwright run', () => {
  const args = [perfFile, '--grep', MAP_PERFORMANCE_PATTERN, '--workers=1'];
  assert.deepEqual(browserTestPlan(args), [{ kind: 'direct', args }]);
});
