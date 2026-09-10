import { expect, test, type Page, type Route } from '@playwright/test';

async function open(page: Page) {
  await page.route(/\/transport-fleet-harness$/, (route) => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Transport fleet</title><div id="root"></div><script type="module" src="/economy/tests/browser/transport-fleet-harness.tsx"></script></html>' }));
  await page.goto('transport-fleet-harness');
  await page.waitForFunction(() => Boolean(window.transportFleet));
}
async function patch(page: Page, value: Record<string, unknown>) {
  await page.evaluate((value) => window.transportFleet.patch(value), value);
}

test('batch expansion is explicit, submitted once, and leaves active capacity unchanged', async ({ page }) => {
  const requests: Route[] = [];
  await page.route('**/fleet-write', (route) => { requests.push(route); });
  await open(page);
  await expect(page.getByRole('button', { name: '公路运输', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /编辑路线|更换运输方式|发运/ })).toHaveCount(0);
  await page.getByRole('button', { name: '增加运力', exact: true }).click();
  const form = page.getByRole('form', { name: '增加运力' });
  await form.getByRole('spinbutton').fill('3');
  await expect(form.locator('[data-transport-expansion-cost]')).toHaveAttribute('data-transport-expansion-cost', '240');
  await expect(form.locator('[data-transport-expanded-capacity]')).toHaveAttribute('data-transport-expanded-capacity', '800');
  expect(requests).toHaveLength(0);
  await form.getByRole('button', { name: '确认增购', exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  await expect(form.getByRole('button', { name: '确认增购' })).toBeDisabled();
  expect(requests[0].request().postDataJSON()).toEqual({ routeId: 'route-1', quantity: 3, expectedVehicleCount: 1 });
  await requests[0].fulfill({ json: { ok: true, message: '运力增购完成', count: 4, credits: 9760 } });
  await expect(form).toHaveCount(0);
  await expect(page.locator('[data-transport-owned-count]')).toHaveAttribute('data-transport-owned-count', '4');
  await expect(page.locator('[data-transport-route-capacity]')).toHaveAttribute('data-transport-route-capacity', '800');
  await expect(page.locator('[data-transport-capacity]')).toHaveAttribute('data-transport-capacity', '200');
  await expect(page.locator('[data-transport-dispatched-count]')).toHaveAttribute('data-transport-dispatched-count', '1');
  await expect(page.getByText('运力增购完成', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.transportFleet.notices)).toEqual(['运力增购完成']);
  expect(requests).toHaveLength(1);
});

test('stale forms cannot become second purchases, drafts reset across save generations', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '增加运力', exact: true }).click();
  const form = page.getByRole('form', { name: '增加运力' });
  await form.getByRole('spinbutton').fill('2');
  await patch(page, { count: 3 });
  await expect(form.getByRole('button', { name: '运力已变化，请重新确认' })).toBeDisabled();
  await expect(form.getByRole('spinbutton')).toBeDisabled();
  expect(await page.evaluate(() => window.transportFleet.writes.length)).toBe(0);
  await patch(page, { saveEpoch: 2 });
  await expect(form).toHaveCount(0);
  await page.getByRole('button', { name: '增加运力', exact: true }).click();
  await expect(form.getByRole('spinbutton')).toHaveValue('1');
  await form.getByRole('button', { name: '取消增购' }).click();
  expect(await page.evaluate(() => window.transportFleet.writes.length)).toBe(0);
});

test('funds, count limits and failures stay local to the form without success-result layout changes', async ({ page }) => {
  await page.route('**/fleet-write', (route) => route.fulfill({ json: { ok: false, message: '增购被服务端拒绝' } }));
  await open(page);
  await patch(page, { credits: 79 });
  await page.getByRole('button', { name: '增加运力', exact: true }).click();
  const form = page.getByRole('form', { name: '增加运力' });
  await expect(form.getByRole('button', { name: '确认增购' })).toBeDisabled();
  await patch(page, { credits: 10000 });
  await form.getByRole('spinbutton').fill('100');
  await expect(form.getByRole('button', { name: '确认增购' })).toBeDisabled();
  await form.getByRole('spinbutton').fill('2');
  const before = await form.boundingBox();
  await form.getByRole('button', { name: '确认增购' }).click();
  await expect.poll(() => page.evaluate(() => window.transportFleet.notices.length)).toBe(1);
  await expect(form).toBeVisible();
  await expect(page.getByText('增购被服务端拒绝', { exact: true })).toHaveCount(0);
  const after = await form.boundingBox();
  expect(Math.abs(before!.height - after!.height)).toBeLessThanOrEqual(1);
  await form.getByRole('button', { name: '取消增购' }).click();
  await patch(page, { count: 100 });
  await expect(page.getByRole('button', { name: '增加运力', exact: true })).toBeDisabled();
});

test('fleet confirmation fits desktop and 320px/mobile, deletion discloses removal without refunds', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '增加运力', exact: true }).click();
  const form = page.getByRole('form', { name: '增加运力' });
  for (const width of [1200, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(form).toBeVisible();
    await expect(async () => {
      const size = await form.evaluate((element) => ({ width: element.clientWidth, content: element.scrollWidth,
        page: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(size.content).toBeLessThanOrEqual(size.width + 1);
      expect(size.page).toBeLessThanOrEqual(size.viewport + 1);
    }).toPass();
  }
  await form.getByRole('button', { name: '取消增购' }).click();
  await page.getByRole('button', { name: '本趟完成后删除', exact: true }).click();
  await expect(page.locator('.transport-delete-confirmation')).toContainText('增购费用不退还');
  await expect(page.getByRole('button', { name: '确认本趟完成后删除' })).toBeVisible();
});
