import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1600, height: 900 } });

function provinceRegion(page: import('@playwright/test').Page, provinceName: string) {
  return page.locator(`.province-map-region[data-province-name="${provinceName}"]`);
}

async function strokeWidth(locator: import('@playwright/test').Locator) {
  return locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).strokeWidth));
}

test('transport route editor picks ordered stops directly on the strategic map and supports loops', async ({ page }) => {
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^运输/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '运输' })).toBeVisible();

  await page.locator('.transport-page-footer').getByRole('button', { name: '增加路线', exact: true }).click();
  const map = page.getByTestId('us-mainland-map');
  const viewport = map.locator('.province-map-static-viewport');
  const pickingBar = page.locator('.transport-map-picking-bar');
  await expect(map).toHaveAttribute('data-route-picking', 'true');
  await expect(pickingBar).toBeVisible();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '0');
  await expect(page.locator('.transport-route-draft-panel')).toHaveCount(0);
  await expect(page.locator('.province-map-region[data-route-pickable="true"]')).not.toHaveCount(0);

  await provinceRegion(page, '加利福尼亚').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '1');
  await provinceRegion(page, '得克萨斯').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '2');
  await provinceRegion(page, '俄克拉何马').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '3');

  const draftRoute = page.locator('.province-map-route[data-route-kind="draft"]');
  const draftRouteNodes = page.locator('.province-map-route-node-entry[data-route-kind="draft"]');
  const routePathLayer = page.locator('.province-map-route-path-layer');
  const routeNodeLayer = page.locator('.province-map-route-node-layer');
  const routeNodeMask = page.locator('.province-map-route-node-cutout-mask');
  await expect(draftRoute).toHaveAttribute('data-route-stop-count', '3');
  expect(await draftRoute.getAttribute('data-route-closed')).toBeNull();
  await expect(draftRouteNodes.locator('.province-map-route-stop')).toHaveCount(3);
  await expect(routePathLayer).toHaveAttribute('mask', /^url\(#province-map-route-node-mask-/);
  await expect(routeNodeMask).toHaveAttribute('data-route-node-cutout-count', '3');
  const routeLayerOrder = await page.locator('.province-map-routes').evaluate((routes) => {
    const pathLayer = routes.querySelector('.province-map-route-path-layer');
    const nodeLayer = routes.querySelector('.province-map-route-node-layer');
    if (!pathLayer || !nodeLayer) return false;
    return Boolean(pathLayer.compareDocumentPosition(nodeLayer) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(routeLayerOrder).toBe(true);
  await expect(routeNodeLayer.locator('.province-map-route-stop')).toHaveCount(3);

  await provinceRegion(page, '加利福尼亚').click();
  expect(await draftRoute.getAttribute('data-route-closed')).toBeNull();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '4');
  await expect(draftRoute).toHaveAttribute('data-route-stop-count', '4');
  await expect(draftRouteNodes.locator('.province-map-route-stop')).toHaveCount(4);
  await expect(routeNodeMask).toHaveAttribute('data-route-node-cutout-count', '3');

  await provinceRegion(page, '得克萨斯').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '4');
  await expect(page.getByText('该州已在线路中')).toBeVisible();

  await pickingBar.getByRole('button', { name: '完成选择', exact: true }).click();
  await expect(map).toHaveAttribute('data-route-picking', 'false');
  await expect(pickingBar).toHaveCount(0);

  // Finishing map selection is read-only: the preserved draft allows comparing
  // all three modes before the explicit create action can charge any funds.
  const pendingDraft = page.locator('.transport-route-draft-panel');
  await expect(pendingDraft).toBeVisible();
  await expect(pendingDraft.locator('.transport-route-path-stop')).toHaveCount(4);
  await expect(pendingDraft.getByText('环线', { exact: true })).toBeVisible();
  await expect(draftRoute).toHaveAttribute('data-route-stop-count', '4');
  expect(await draftRoute.getAttribute('data-route-closed')).toBeNull();

  await expect.poll(async () => Number(await viewport.getAttribute('data-map-route-stroke-scale'))).toBeCloseTo(0.5, 3);
  await expect.poll(async () => Number(await viewport.getAttribute('data-map-boundary-stroke-scale'))).toBeCloseTo(0.65, 3);
  const lowZoomRouteStroke = await strokeWidth(draftRoute.locator('.province-map-route-path'));
  const lowZoomBoundaryStroke = await strokeWidth(provinceRegion(page, '加利福尼亚'));
  expect(lowZoomRouteStroke).toBeCloseTo(1.25, 1);
  expect(lowZoomBoundaryStroke).toBeCloseTo(0.65, 1);

  await viewport.evaluate((container) => {
    const bounds = container.getBoundingClientRect();
    for (let index = 0; index < 6; index += 1) {
      container.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + bounds.width * 0.5,
        clientY: bounds.top + bounds.height * 0.5,
        deltaY: -120,
      }));
    }
  });
  await expect.poll(async () => Number(await viewport.getAttribute('data-map-zoom-current'))).toBeGreaterThan(2);
  await expect.poll(async () => Number(await viewport.getAttribute('data-map-route-stroke-scale'))).toBeGreaterThan(0.65);
  await expect.poll(async () => Number(await viewport.getAttribute('data-map-boundary-stroke-scale'))).toBeGreaterThan(0.75);
  const highZoomRouteStroke = await strokeWidth(draftRoute.locator('.province-map-route-path'));
  const highZoomBoundaryStroke = await strokeWidth(provinceRegion(page, '加利福尼亚'));
  expect(highZoomRouteStroke).toBeGreaterThan(lowZoomRouteStroke);
  expect(highZoomBoundaryStroke).toBeGreaterThan(lowZoomBoundaryStroke);

  await pendingDraft.getByRole('button', { name: '取消', exact: true }).click();
  await expect(pendingDraft).toHaveCount(0);
  await expect(page.locator('.province-map-route[data-route-kind="draft"]')).toHaveCount(0);
  await expect(page.locator('.province-map-route-node-entry[data-route-kind="draft"]')).toHaveCount(0);
});
