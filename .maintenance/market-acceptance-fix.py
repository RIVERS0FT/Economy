from pathlib import Path
p=Path('tests/browser/market-chart-pointer.spec.ts');s=p.read_text();assert s.count("await expect(page.locator('.economy-chart-tooltip')).toHaveText(text);")==1;s=s.replace("await expect(page.locator('.economy-chart-tooltip')).toHaveText(text);", "await expect(page.locator('.economy-chart-tooltip')).toHaveText(text, { useInnerText: true });\n    await expectForegroundTooltip(page);");p.write_text(s)
p=Path('scripts/select-ci-tests.mjs');s=p.read_text();assert s.count('candidateReferencesAnyChangedFile(root, candidate, [sourcePath])')==1;s=s.replace('candidateReferencesAnyChangedFile(root, candidate, [sourcePath])','candidateReferencesAnyChangedFile(root, candidate, [sourcePath], !isServerSource(sourcePath))');p.write_text(s)
p=Path('tests/dt/ci-direct-reference-selection.test.ts');s=p.read_text();s+='''

test('a same-stem non-reference cannot suppress full fallback for unclassified server code', () => {
  const root = mkdtempSync(join(tmpdir(), 'economy-ci-fallback-'));
  try {
    for (const dir of ['server/src', 'server/test']) mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, 'server/src/widget.js'), 'export const value = 1;');
    writeFileSync(join(root, 'server/test/unrelated.test.js'), "readFileSync('src/styles/widget.css');");
    const plan = selectCiPlan(['server/src/widget.js'], { root });
    assert.equal(plan.mode, 'full');
    assert.ok(plan.reasons.includes('unclassified-source:server/src/widget.js'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
''';p.write_text(s)
p=Path('docs/CI_EXECUTION_DESIGN.md');s=p.read_text().replace('前端 TypeScript／TSX 的无后缀导入匹配不受此 IT 限制影响；', '同一精确引用边界也用于未分类服务器源码的 full 回退判定，不能让同词干的非引用抑制保守回退。前端 TypeScript／TSX 的无后缀导入匹配不受此 IT 限制影响；');p.write_text(s)
