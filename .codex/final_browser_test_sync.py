from pathlib import Path


def replace(path: str, old: str, new: str, count: int | None = 1) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    actual = text.count(old)
    expected = actual if count is None else count
    if actual != expected:
        raise SystemExit(f'{path}: expected {expected} occurrences, found {actual}: {old[:100]!r}')
    target.write_text(text.replace(old, new), encoding='utf-8')


replace(
    'tests/browser/player-page-geometry.spec.ts',
    "  await expect(page.getByRole('heading', { level: 1, name: '概览' })).toBeVisible();\n",
    "  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);\n  await expect(page.getByTestId('us-mainland-map')).toHaveAttribute('data-map-ready', 'true');\n  await expect(page.locator('[data-player-page-navigation=\"true\"]')).toHaveCount(0);\n",
)

replace(
    'tests/browser/global-operation-pages.spec.ts',
    "  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();\n",
    '',
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
    count=None,
)
replace(
    'tests/browser/market-runtime.spec.ts',
    "page.getByRole('textbox', { name: '价格' })",
    "page.getByRole('textbox', { name: '价格', exact: true })",
    count=None,
)

replace(
    'tests/browser/all-pages-preview.spec.ts',
    "    const heading = page.locator('[data-player-page-navigation=\"true\"]');\n    const back = heading.getByRole('button', { name: '返回上一页面' });\n    const close = heading.getByRole('button', { name: '关闭当前页面并显示地图' });\n    await expect(heading).toBeVisible();\n    await expect(back.locator('svg')).toHaveCount(1);\n    await expect(close.locator('svg')).toHaveCount(1);\n",
    "    const heading = page.locator('[data-player-page-navigation=\"true\"]:visible');\n    await expect(heading).toHaveCount(1);\n    const back = heading.getByRole('button', { name: '返回上一页面', exact: true });\n    const close = heading.getByRole('button', { name: '关闭当前页面并显示地图', exact: true });\n    await expect(heading).toBeVisible();\n    await expect(back.locator(':scope > .game-icon')).toHaveCount(1);\n    await expect(close.locator(':scope > .game-icon')).toHaveCount(1);\n",
)
replace(
    'tests/browser/all-pages-preview.spec.ts',
    "  await expect(page.locator('[data-leaderboard-board=\"wealth\"] .leaderboard-board-card').getByText('本地预览玩家', { exact: true })).toBeVisible();\n",
    "  const wealthCurrentPlayer = page.locator('[data-leaderboard-board=\"wealth\"] .leaderboard-board-current strong');\n  await expect(wealthCurrentPlayer).toHaveText('本地预览玩家', { timeout: 15_000 });\n",
)

print('final browser regression sync applied')
