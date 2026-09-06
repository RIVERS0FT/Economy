import { expect, test } from '@playwright/test';

async function openTransportDraft(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^运输/ }).click();
  await page.locator('.transport-page-footer').getByRole('button', { name: '增加路线', exact: true }).click();
  await page.locator('.province-map-region[data-province-name="加利福尼亚"]').click();
  await page.locator('.province-map-region[data-province-name="得克萨斯"]').click();
  await page.locator('.transport-map-picking-bar').getByRole('button', { name: '完成选择', exact: true }).click();
  return page.locator('.transport-route-draft-panel');
}

test('transport map completion preserves an unpaid draft with all three mode estimates', async ({ page }) => {
  const transportWrites: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/game/transport')) transportWrites.push(request.url());
  });
  const draft = await openTransportDraft(page);
  await expect(draft).toBeVisible();
  await expect(page.locator('.transport-route-card')).toHaveCount(0);
  await expect(draft.getByRole('group', { name: '运输方式比较' })).toBeVisible();
  await expect(draft.locator('[data-transport-mode-option]')).toHaveCount(3);
  await expect(draft.locator('[data-transport-mode-option="road"] [data-transport-mode-capacity]')).toHaveAttribute('data-transport-mode-capacity', '200');
  await expect(draft.locator('[data-transport-mode-option="rail"] [data-transport-mode-capacity]')).toHaveAttribute('data-transport-mode-capacity', '2000');
  await expect(draft.locator('[data-transport-mode-option="air"] [data-transport-mode-capacity]')).toHaveAttribute('data-transport-mode-capacity', '300');
  await expect(draft.locator('[data-transport-mode-option="road"]').getByRole('button', { name: '公路运输', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await draft.locator('[data-transport-mode-option="air"]').getByRole('button', { name: '航空运输', exact: true }).click();
  await expect(draft.locator('[data-transport-mode-option="air"]').getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await expect(draft.locator('[data-transport-mode-option="road"]').getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.province-map-route[data-route-kind="draft"]')).toHaveAttribute('data-route-id', 'draft-air-route');
  await expect(draft.getByRole('button', { name: '创建路线', exact: true })).toBeVisible();
  expect(transportWrites).toEqual([]);
  await draft.getByRole('button', { name: '取消', exact: true }).click();
  await expect(draft).toHaveCount(0);
  await expect(page.locator('.transport-route-card')).toHaveCount(0);
  expect(transportWrites).toEqual([]);
});

test('transport forecasts explain non-cash gains without resizing the card and fit mobile widths', async ({ page }) => {
  const draft = await openTransportDraft(page);
  const road = draft.locator('[data-transport-mode-option="road"]');
  await road.scrollIntoViewIfNeeded();
  const before = await road.boundingBox();
  await road.locator('[data-transport-gain-explanation]').hover();
  await expect(page.getByRole('tooltip').filter({ hasText: '不是已实现现金利润' })).toBeVisible();
  const after = await road.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
  await page.mouse.move(1590, 890);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await draft.scrollIntoViewIfNeeded();
    await expect(draft).toBeVisible();
    const measurements = await draft.evaluate((element) => ({
      pageWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      width: element.clientWidth,
      contentWidth: element.scrollWidth,
    }));
    expect(measurements.pageWidth).toBeLessThanOrEqual(measurements.viewport + 1);
    expect(measurements.contentWidth).toBeLessThanOrEqual(measurements.width + 1);
    await expect(draft.locator('[data-transport-mode-option="air"]')).toContainText('周期总费用');
    await expect(draft.locator('[data-transport-mode-option="rail"]')).toContainText('预计周期耗时');
  }
});
