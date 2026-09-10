import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.route(/\/transport-business-harness$/, (route) => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Transport business</title><div id="root"></div><script type="module" src="/economy/tests/browser/transport-business-harness.tsx"></script></html>' }));
  await page.goto('transport-business-harness');
  await page.waitForFunction(() => Boolean(window.transportBusinessFixture));
}

test('route details separate fixed task delivery and actual cash income from speculative trade', async ({ page }) => {
  await open(page);
  const panel = page.locator('[data-transport-business="business-route"]');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-transport-task-id="freight-one"]')).toContainText('已收运费');
  await expect(page.locator('[data-transport-task-dispatch]')).toContainText('计划交付');
  await expect(page.locator('[data-transport-task-dispatch]')).not.toContainText('预计增益');
  await page.evaluate(() => window.transportBusinessFixture.patch({ active: true }));
  await expect(page.locator('.transport-shipment-cargo .transport-manifest-list')).toContainText('得克萨斯');
  await expect(page.locator('.transport-shipment-meta')).toContainText('已收委托运费');
  await expect(page.getByRole('button', { name: /手动发车|领取收益|编辑路线|更换运输方式/ })).toHaveCount(0);
});

test('supply controls are scoped to route consumers, validate quantities and reset with the save', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '新增产业补给', exact: true }).click();
  const form = page.getByRole('form', { name: '新增产业补给', exact: true });
  // SelectInput exposes an accessible rich combobox; its native select is only
  // a compatibility bridge, so assert the choices actually shown to the user.
  await expect(form.getByRole('combobox', { name: '供货地区', exact: true })).toHaveText('加利福尼亚');
  await expect(form.getByRole('combobox', { name: '收货地区', exact: true })).toHaveText('得克萨斯');
  await expect(form.getByRole('combobox', { name: '补给商品', exact: true })).toHaveText('小麦');
  await expect(form.getByRole('button', { name: '建立补给' })).toBeEnabled();
  await form.getByLabel('保障数量上限').fill('0');
  await expect(form.getByRole('button', { name: '建立补给' })).toBeDisabled();
  await form.getByLabel('保障数量上限').fill('250');
  await form.getByLabel('累计运费预算').fill('0');
  await expect(form.getByRole('button', { name: '建立补给' })).toBeDisabled();
  await page.evaluate(() => window.transportBusinessFixture.patch({ saveEpoch: 2 }));
  await expect(form).toHaveCount(0);
  await page.getByRole('button', { name: '新增产业补给', exact: true }).click();
  await expect(form.getByLabel('保障数量上限')).toHaveValue('200');
});

test('business controls and help fit desktop and mobile without changing the page layout', async ({ page }) => {
  await open(page);
  const panel = page.locator('[data-transport-business="business-route"]');
  await page.getByRole('button', { name: '新增产业补给', exact: true }).click();
  for (const width of [1200, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    await expect(panel).toBeVisible();
    await expect(async () => {
      const dimensions = await panel.evaluate((element) => ({ width: element.clientWidth, content: element.scrollWidth,
        page: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
      expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
    }).toPass();
  }
  const before = await panel.boundingBox();
  await panel.getByRole('button', { name: '运输保障', exact: true }).click();
  await expect(page.getByRole('tooltip')).toContainText('不会自动买货或买油');
  const after = await panel.boundingBox();
  expect(Math.abs(before!.height - after!.height)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.transportBusinessFixture.patch({ deletionPending: true }));
  await expect(panel.getByRole('button', { name: '承接委托' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '建立补给' })).toBeDisabled();
});
