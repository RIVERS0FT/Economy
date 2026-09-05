import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { selectCiPlan } from '../../scripts/select-ci-tests.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('page source contracts conservatively select complete validation before business domain inference', () => {
  for (const path of [
    'server/test/commercial-page-contract.test.js',
    'server/test/market-page-contract.test.js',
    'server/test/banking-page-contract.test.js',
  ]) {
    const plan = selectCiPlan([path, 'src/pages/ProvincePage.tsx'], { root });
    assert.equal(plan.mode, 'full', path);
    assert.equal(plan.needsDependencies, true, path);
    assert.deepEqual(plan.browser, { mode: 'all', tests: [] }, path);
    assert.deepEqual(plan.reasons, [`ambiguous-page-contract:${path}`], path);
  }
});

test('ordinary business contracts retain their existing targeted domain tests', () => {
  const plan = selectCiPlan(['server/src/production-contracts.js'], { root });
  assert.equal(plan.mode, 'targeted');
  assert.ok(plan.it.tests.some((path: string) => path.includes('contract')));
  assert.equal(plan.reasons.some((reason: string) => reason.startsWith('ambiguous-page-contract:')), false);
});

test('documentation wording does not create page-contract executable impact', () => {
  const plan = selectCiPlan(['docs/commercial-page-contract.md'], { root });
  assert.equal(plan.mode, 'targeted');
  assert.deepEqual(plan.it.tests, []);
  assert.equal(plan.browser.mode, 'none');
  assert.ok(plan.reasons.includes('documentation-only'));
});

test('high-risk selector changes continue to require the complete suite', () => {
  const plan = selectCiPlan(['scripts/select-ci-tests.mjs', 'server/test/commercial-page-contract.test.js'], { root });
  assert.equal(plan.mode, 'full');
  assert.deepEqual(plan.reasons, ['high-risk:scripts/select-ci-tests.mjs']);
  assert.equal(plan.browser.mode, 'all');
});
