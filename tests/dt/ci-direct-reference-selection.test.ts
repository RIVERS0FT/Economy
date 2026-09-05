import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { selectCiPlan } from '../../scripts/select-ci-tests.mjs';

test('IT selection does not confuse a UI stylesheet with a same-stem server module', () => {
  const plan = selectCiPlan(['src/styles/commodity-freezes.css']);
  assert.equal(plan.mode, 'targeted');
  assert.deepEqual(plan.it.tests, []);
  assert.equal(plan.browser.mode, 'selected');
  assert.ok(plan.browser.tests.includes('tests/browser/commodity-freeze-details.spec.ts'));
  const serverPlan = selectCiPlan(['server/src/commodity-freezes.js']);
  assert.ok(serverPlan.it.tests.includes('server/test/commodity-freezes.test.js'));
  assert.ok(serverPlan.it.tests.includes('server/test/cycle-auto-runtime.test.js'));
});

test('exact cross-layer file references still select IT while basename stems do not', () => {
  const root = mkdtempSync(join(tmpdir(), 'economy-ci-reference-'));
  try {
    for (const dir of ['src/styles', 'server/test']) mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, 'src/styles/widget.css'), '.widget {}');
    writeFileSync(join(root, 'server/test/exact.test.js'), "readFileSync('src/styles/widget.css');");
    writeFileSync(join(root, 'server/test/unrelated.test.js'), "import '../src/widget.js';");
    const plan = selectCiPlan(['src/styles/widget.css'], { root });
    assert.equal(plan.mode, 'targeted');
    assert.deepEqual(plan.it.tests, ['server/test/exact.test.js']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
