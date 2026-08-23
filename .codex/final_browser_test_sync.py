from pathlib import Path


def replace(path: str, old: str, new: str, expected: int = 1) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    actual = text.count(old)
    if actual != expected:
        raise SystemExit(f'{path}: expected {expected} occurrences, found {actual}: {old[:100]!r}')
    target.write_text(text.replace(old, new), encoding='utf-8')


replace(
    'tests/browser/player-page-geometry.spec.ts',
    "  await expect(page.getByRole('heading', { level: 1, name: '概览' })).toBeVisible();\n",
    "  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);\n  await expect(page.getByTestId('us-mainland-map')).toHaveAttribute('data-map-ready', 'true');\n",
)

replace(
    'tests/browser/scroll-input-modality.spec.ts',
    "  const layout = await page.locator('.market-catalog-panel').evaluate((panel) => ({\n",
    "  const layout = await page.locator('.market-catalog-surface').evaluate((panel) => ({\n",
)
replace(
    'tests/browser/scroll-input-modality.spec.ts',
    "  await expect(page.getByRole('heading', { name: '加利福尼亚州 · 小麦', exact: true })).toBeVisible();\n",
    "  await expect(page.locator('.regional-entity-title__name')).toHaveText('小麦');\n  await expect(page.locator('.regional-entity-title__region')).toHaveText('加利福尼亚州');\n",
)

replace(
    'tests/browser/market-order-entry-compact.spec.ts',
    "page.getByRole('textbox', { name: '价格' })",
    "page.getByRole('textbox', { name: '价格', exact: true })",
    expected=2,
)
replace(
    'tests/browser/market-runtime.spec.ts',
    "page.getByRole('textbox', { name: '价格' })",
    "page.getByRole('textbox', { name: '价格', exact: true })",
    expected=2,
)

print('final browser regression sync applied')
