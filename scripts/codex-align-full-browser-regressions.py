from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:100]!r}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


all_pages = 'tests/browser/all-pages-preview.spec.ts'
replace_once(
    all_pages,
    "await page.getByRole('button', { name: '返回商品全局详情' }).click();",
    "await page.getByRole('button', { name: '返回上一页面' }).click();",
)
replace_once(
    all_pages,
    "await expect(reveal).toHaveAttribute('data-page-transition-key', 'market');",
    "await expect(reveal).toHaveAttribute('data-page-transition-key', 'tab:market');",
)
replace_once(
    all_pages,
    "test('player page return skips the map and restores the previous business page', async ({ page }) => {",
    "test('player page return follows history while close clears the stack to map', async ({ page }) => {",
)
replace_once(
    all_pages,
    """  await sidebar.getByRole('button', { name: /^银行/ }).click();
  await returnButton.focus();
  await expect(returnButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: '市场' })).toBeVisible();
""",
    """  await sidebar.getByRole('button', { name: /^银行/ }).click();
  await returnButton.focus();
  await expect(returnButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
  await expect(page.locator('[data-player-page-navigation=\"true\"]')).toHaveCount(0);
""",
)

operation_pages = 'tests/browser/global-operation-pages.spec.ts'
for old in [
    "await page.getByRole('button', { name: '返回商品全局详情' }).click();",
    "await page.getByRole('button', { name: '返回商品列表' }).click();",
    "await page.getByRole('button', { name: '返回地区工厂' }).click();",
    "await page.getByRole('button', { name: '返回工厂列表' }).click();",
]:
    replace_once(operation_pages, old, "await page.getByRole('button', { name: '返回上一页面' }).click();")

order_entry = 'tests/browser/market-order-entry-compact.spec.ts'
replace_once(
    order_entry,
    """  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet')).toBeVisible();
  await expect(entry).toBeVisible();
""",
    """  await page.setViewportSize({ width: 390, height: 844 });
  const mobileSheet = page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet');
  await expect(mobileSheet).toBeVisible();
  await expect(mobileSheet).toHaveAttribute('data-entry-animation-complete', 'true');
  await expect(entry).toBeVisible();
""",
)

scroll_modality = 'tests/browser/scroll-input-modality.spec.ts'
old_click = "  await page.getByRole('button', { name: '成交', exact: true }).click();\n"
source = Path(scroll_modality).read_text(encoding='utf-8')
if source.count(old_click) != 2:
    raise SystemExit(f'{scroll_modality}: expected two stale trade-switch clicks, found {source.count(old_click)}')
source = source.replace(old_click, '')
Path(scroll_modality).write_text(source, encoding='utf-8')
