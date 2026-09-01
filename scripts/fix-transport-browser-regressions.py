from pathlib import Path


def replace_once(path, old, new, label):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {count}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    "container.dataset.mapTooltipMode = width > MOBILE_MAP_MAX_WIDTH ? 'desktop' : 'touch';",
    "container.dataset.mapTooltipMode = width > MOBILE_MAP_MAX_WIDTH ? 'desktop' : 'hidden-mobile';",
    'mobile normal map tooltip metadata',
)

replace_once(
    'tests/browser/all-pages-preview.spec.ts',
    '''  await addRouteButton.click();\n  const transportEditorGrid = page.locator('.transport-route-editor-grid');\n  await expect(transportEditorGrid).toBeVisible();\n  const transportEditorColumns = await transportEditorGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(/\\s+/).filter(Boolean).length);\n  expect(transportEditorColumns).toBe(1);\n  await page.getByRole('button', { name: '取消', exact: true }).click();\n''',
    '''  await addRouteButton.click();\n  const transportMapPickingBar = page.locator('.transport-map-picking-bar');\n  await expect(page.getByTestId('us-mainland-map')).toHaveAttribute('data-route-picking', 'true');\n  await expect(transportMapPickingBar).toBeVisible();\n  await expect(page.locator('.transport-route-draft-panel')).toHaveCount(0);\n  await expect(outliner).toBeVisible();\n  await expect(outliner).toHaveAttribute('data-preview-outliner-sentinel', 'persistent');\n  await transportMapPickingBar.getByRole('button', { name: '取消', exact: true }).click();\n  await expect(page.getByTestId('us-mainland-map')).toHaveAttribute('data-route-picking', 'false');\n''',
    'all pages transport map editing flow',
)

Path('tests/browser/transport-map-picking.spec.ts').write_text('''import { expect, test } from '@playwright/test';\n\ntest.use({ viewport: { width: 1600, height: 900 } });\n\nfunction provinceRegion(page: import('@playwright/test').Page, provinceName: string) {\n  return page.locator(`.province-map-region[data-province-name="${provinceName}"]`);\n}\n\ntest('transport route editor picks ordered stops directly on the strategic map and supports loops', async ({ page }) => {\n  await page.goto('?preview=game');\n  await page.locator('.desktop-sidebar').getByRole('button', { name: /^运输/ }).click();\n  await expect(page.getByRole('heading', { level: 1, name: '运输' })).toBeVisible();\n\n  await page.locator('.transport-page-actions').getByRole('button', { name: '增加路线', exact: true }).click();\n  const map = page.getByTestId('us-mainland-map');\n  const pickingBar = page.locator('.transport-map-picking-bar');\n  await expect(map).toHaveAttribute('data-route-picking', 'true');\n  await expect(pickingBar).toBeVisible();\n  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '0');\n  await expect(page.locator('.transport-route-draft-panel')).toHaveCount(0);\n  await expect(page.locator('.province-map-region[data-route-pickable="true"]')).not.toHaveCount(0);\n\n  await provinceRegion(page, '加利福尼亚').click();\n  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '1');\n  await provinceRegion(page, '得克萨斯').click();\n  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '2');\n  await provinceRegion(page, '俄克拉何马').click();\n  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '3');\n\n  const draftRoute = page.locator('.province-map-route[data-route-kind="draft"]');\n  await expect(draftRoute).toHaveAttribute('data-route-stop-count', '3');\n  await expect(draftRoute).toHaveAttribute('data-route-closed', 'false');\n  await expect(draftRoute.locator('.province-map-route-stop')).toHaveCount(3);\n\n  await provinceRegion(page, '加利福尼亚').click();\n  await expect(draftRoute).toHaveAttribute('data-route-closed', 'true');\n  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '4');\n\n  await provinceRegion(page, '得克萨斯').click();\n  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '4');\n  await expect(page.getByText('该州已在线路中')).toBeVisible();\n\n  await pickingBar.getByRole('button', { name: '完成选择', exact: true }).click();\n  await expect(map).toHaveAttribute('data-route-picking', 'false');\n  await expect(pickingBar).toHaveCount(0);\n  const pendingDraft = page.locator('.transport-route-draft-panel');\n  await expect(pendingDraft).toBeVisible();\n  await expect(pendingDraft.locator('.transport-route-path-stop')).toHaveCount(4);\n  await expect(pendingDraft.getByText('环线', { exact: true })).toBeVisible();\n  await expect(draftRoute).toHaveAttribute('data-route-stop-count', '4');\n\n  await pendingDraft.getByRole('button', { name: '取消修改', exact: true }).click();\n  await expect(pendingDraft).toHaveCount(0);\n  await expect(page.locator('.province-map-route[data-route-kind="draft"]')).toHaveCount(0);\n});\n''', encoding='utf-8')

print('transport browser regressions aligned')
