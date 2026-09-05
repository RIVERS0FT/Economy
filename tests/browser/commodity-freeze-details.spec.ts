import { expect, test, type Page } from '@playwright/test';

const frozenTooltip = (page: Page) => page.locator('.safe-tooltip[data-interactive="true"]');

async function geometry(page: Page) {
  return page.evaluate(() => Object.fromEntries([
    '.market-detail-product-summary', '.market-detail-product-icon-card',
    '.market-detail-trade-summary', '.market-chart-card', '.market-trade-card',
  ].map((selector) => {
    const rect = document.querySelector(selector)!.getBoundingClientRect();
    return [selector, [rect.x, rect.y, rect.width, rect.height]];
  })));
}

async function expectGeometry(page: Page, before: Awaited<ReturnType<typeof geometry>>) {
  const after = await geometry(page);
  for (const selector of Object.keys(before)) {
    for (let axis = 0; axis < 4; axis += 1) {
      expect(Math.abs(after[selector][axis] - before[selector][axis]), `${selector} geometry ${axis}`).toBeLessThanOrEqual(1);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function expectAligned(page: Page) {
  const alignment = await page.locator('.market-detail-trade-summary').evaluate((summary) => {
    const cells = summary.querySelectorAll(':scope > span');
    const availableLabel = cells[2].querySelector('small')!.getBoundingClientRect();
    const frozenLabel = cells[3].querySelector('small')!.getBoundingClientRect();
    const availableValue = cells[2].querySelector('strong')!.getBoundingClientRect();
    const frozenValue = cells[3].querySelector('strong')!.getBoundingClientRect();
    return { labels: Math.abs(availableLabel.top - frozenLabel.top), values: Math.abs(availableValue.bottom - frozenValue.bottom) };
  });
  expect(alignment.labels).toBeLessThanOrEqual(1);
  expect(alignment.values).toBeLessThanOrEqual(1);
}

for (const { width, scale, touch } of [
  { width: 320, scale: 1, touch: false },
  { width: 390, scale: 1, touch: false },
  { width: 960, scale: 1, touch: false },
  { width: 320, scale: 1.25, touch: true },
  { width: 390, scale: 1.25, touch: true },
]) {
  test.describe(`frozen inventory ${width}px ${scale * 100}% ${touch ? 'touch' : 'mouse'}`, () => {
    test.use({ viewport: { width, height: 960 }, hasTouch: touch, isMobile: touch });
    test('details only float, preserve geometry and survive refresh', async ({ page }, testInfo) => {
      const errors: string[] = [];
      const writes: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => { if (request.method() === 'POST') writes.push(request.url()); });
      await page.goto('/market-runtime-test.html?scenario=freeze-details');
      await page.evaluate((fontScale) => { document.documentElement.style.fontSize = `${16 * fontScale}px`; }, scale);
      await page.evaluate(() => document.fonts.ready);
      const trigger = page.getByRole('button', { name: '查看冻结库存 320 的来源明细' });
      await expect(page.locator('.market-history-echart')).toHaveAttribute('data-echarts-ready', 'true');
      await trigger.scrollIntoViewIfNeeded();
      await expect.poll(async () => (await trigger.boundingBox())?.height ?? 0).toBeGreaterThan(0);
      await expectAligned(page);
      const before = await geometry(page);
      const tooltip = frozenTooltip(page);

      if (touch) await trigger.tap();
      else {
        await trigger.hover();
        await expect(tooltip).toBeVisible();
        await expect(tooltip).not.toHaveAttribute('data-pinned', 'true');
        await trigger.click();
      }
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveAttribute('data-pinned', 'true');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(tooltip).toContainText('冻结明细 · 320');
      for (const text of ['生产冻结', '磨坊', '120', '饲料厂', '80', '经营冻结', '合同冻结', 'supply-123', '拍卖冻结']) {
        await expect(tooltip).toContainText(text);
      }
      await expect(page.locator('.commodity-freeze-disclosure__expanded')).toHaveCount(0);
      await expect(page.getByRole('region', { name: '冻结明细' })).toHaveCount(0);
      await expectGeometry(page, before);
      if (touch) await tooltip.tap({ position: { x: 12, y: 12 } });
      else { await tooltip.hover(); await tooltip.click({ position: { x: 12, y: 12 } }); }
      await expect(tooltip).toBeVisible();

      await page.evaluate(() => window.__updateFreezeFixture?.());
      await expect(tooltip).toContainText('冻结明细 · 325');
      await expect(tooltip).toContainText('125');
      await expectGeometry(page, before);
      await expectAligned(page);
      const safe = await page.locator('[data-workspace-tooltip-layer="true"]').boundingBox();
      const box = await tooltip.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(safe!.x + 7);
      expect(box!.y).toBeGreaterThanOrEqual(safe!.y + 7);
      expect(box!.x + box!.width).toBeLessThanOrEqual(safe!.x + safe!.width - 7);
      expect(box!.y + box!.height).toBeLessThanOrEqual(safe!.y + safe!.height - 7);
      await page.screenshot({ path: testInfo.outputPath('frozen-inventory-floating.png') });

      const updatedTrigger = page.getByRole('button', { name: '查看冻结库存 325 的来源明细' });
      if (touch) await updatedTrigger.tap();
      else await updatedTrigger.click();
      await expect(tooltip).toHaveCount(0);
      await expectGeometry(page, before);
      if (touch) await updatedTrigger.tap();
      else await updatedTrigger.click();
      await expect(tooltip).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(tooltip).toHaveCount(0);
      await expect(page.locator('.market-detail-trade-summary')).toBeVisible();
      if (width <= 720) await expect(page.locator('[data-mobile-workspace-sheet-host="true"]')).toBeVisible();
      await expectGeometry(page, before);
      expect(errors).toEqual([]);
      expect(writes).toEqual([]);
    });
  });
}

test('mouse preview bridges into the tooltip, outside click and context switches close it', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await page.goto('/market-runtime-test.html?scenario=freeze-details');
  const trigger = page.getByRole('button', { name: '查看冻结库存 320 的来源明细' });
  const tooltip = frozenTooltip(page);
  await trigger.hover();
  await expect(tooltip).toBeVisible();
  await tooltip.hover();
  await page.waitForTimeout(200);
  await expect(tooltip).toBeVisible();
  await page.mouse.move(2, 2);
  await expect(tooltip).toHaveCount(0);
  await trigger.focus();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(tooltip).toHaveAttribute('data-pinned', 'true');
  await page.locator('.market-detail-product-icon-card').click();
  await expect(tooltip).toHaveCount(0);
  for (const kind of ['province', 'save', 'asset']) {
    const current = page.locator('.commodity-freeze-disclosure__trigger');
    await current.click();
    await expect(tooltip).toBeVisible();
    await page.evaluate((value) => window.dispatchEvent(new CustomEvent('market-fixture-context', { detail: { kind: value } })), kind);
    await expect(tooltip).toHaveCount(0);
    await expect(page.locator('.commodity-freeze-disclosure__trigger')).toHaveAttribute('aria-expanded', 'false');
  }
});

test('long source names scroll only within the floating details', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/market-runtime-test.html?scenario=freeze-long');
  await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; });
  const trigger = page.locator('.commodity-freeze-disclosure__trigger');
  await trigger.scrollIntoViewIfNeeded();
  const before = await geometry(page);
  await trigger.click();
  const tooltip = frozenTooltip(page);
  await expect(tooltip).toBeVisible();
  expect(await tooltip.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  const scrollBefore = await page.locator('.page-card-scroll').evaluateAll((nodes) => nodes.map((node) => node.scrollTop));
  await tooltip.hover();
  await page.mouse.wheel(0, 700);
  await expect.poll(() => tooltip.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.page-card-scroll').evaluateAll((nodes) => nodes.map((node) => node.scrollTop))).toEqual(scrollBefore);
  await expectGeometry(page, before);
  await expect(tooltip).toHaveAttribute('data-pinned', 'true');
});

for (const [scenario, text] of [['freeze-unknown', '冻结来源明细暂不可用'], ['active', '暂无冻结']]) {
  test(`floating details handle ${scenario}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/market-runtime-test.html?scenario=${scenario}`);
    await page.locator('.commodity-freeze-disclosure__trigger').click();
    await expect(frozenTooltip(page)).toContainText(text);
    await expect(page.locator('.commodity-freeze-disclosure__expanded')).toHaveCount(0);
  });
}
