from pathlib import Path
p=Path('scripts/select-ci-tests.mjs');s=p.read_text();s=s.replace('const getReferenceTokens = (path) => {', 'const getReferenceTokens = (path, includeStem = true) => {').replace('if (stem.length >= 5)', 'if (includeStem && stem.length >= 5)').replace('const candidateReferencesAnyChangedFile = (root, candidate, changedFiles) => {', 'const candidateReferencesAnyChangedFile = (root, candidate, changedFiles, includeStem = true) => {').replace('getReferenceTokens(changedFile).some(', 'getReferenceTokens(changedFile, includeStem).some(')
s=s.replace('if (isItDomainCandidate(candidate) || isReferenceCandidate(candidate)) selectedServerTests.add(candidate);', '''// Server ESM imports include their extension. A CSS/TS basename stem is not
    // a direct reference to a same-named server .js module.
    if (isItDomainCandidate(candidate) || candidateReferencesAnyChangedFile(root, candidate, executableChanges, false)) selectedServerTests.add(candidate);''');p.write_text(s)
p=Path('docs/CI_EXECUTION_DESIGN.md');s=p.read_text().replace('服务器测试对改动文件存在直接引用时仍可按引用关系选择；', '服务器测试对改动文件存在直接引用时仍可按引用关系选择，但 IT 引用匹配必须保留实际文件路径或含后缀文件名，不能把省略后缀的词干当作直接引用，例如 `commodity-freezes.css` 不得命中服务器对 `commodity-freezes.js` 的导入。前端 TypeScript／TSX 的无后缀导入匹配不受此 IT 限制影响；');p.write_text(s)
p=Path('tests/dt/ci-direct-reference-selection.test.ts');p.write_text('''import assert from 'node:assert/strict';
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
''')
p=Path('tests/browser/market-chart-pointer.spec.ts');s=p.read_text().replace("const scroll = page.locator('.mobile-detail-sheet-scroll');", "const scroll = page.locator('[data-mobile-workspace-sheet-host=\"true\"] .page-card-scroll');");p.write_text(s)
