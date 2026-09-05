import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { selectCiPlan } from '../../scripts/select-ci-tests.mjs';

for (const removed of ['tests/dt/removed.test.ts', 'server/test/removed.test.js', 'tests/browser/removed.spec.ts']) {
  test(`removed test retains full validation: ${removed}`, (t) => {
    const root = mkdtempSync(join(tmpdir(), 'economy-removed-tests-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const plan = selectCiPlan([removed], { root });
    assert.equal(plan.mode, 'full');
    assert.deepEqual(plan.reasons, [`removed-test:${removed}`]);
    assert.equal(plan.needsDependencies, true);
    assert.equal(plan.browser.mode, 'all');
    assert.deepEqual(plan.it.tests, []);
  });
}

test('moving source-only page checks to DT preserves assertions and uses full migration validation', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'economy-moved-tests-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const destination = 'tests/dt/commercial-page.test.ts';
  mkdirSync(dirname(join(root, destination)), { recursive: true });
  writeFileSync(join(root, destination), '// retained page assertions');
  const migration = selectCiPlan(['server/test/commercial-page-contract.test.js', destination], { root });
  assert.equal(migration.mode, 'full');
  assert.equal(migration.browser.mode, 'all');
  const followup = selectCiPlan([destination], { root });
  assert.equal(followup.mode, 'targeted');
  assert.deepEqual(followup.it.tests, []);
  assert.ok(followup.dt.commands.some((command) => command.args[0] === 'scripts/run-code-coverage.mjs' && command.args[1] === 'dt'));
});
