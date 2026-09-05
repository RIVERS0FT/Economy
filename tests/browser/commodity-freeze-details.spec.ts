import { expect, test, type Page } from '@playwright/test';

const tooltipFor = (page: Page) => page.getByRole('tooltip').filter({ hasText: '冻结明细' });
async function layout(page: Page) {
  return page.evaluate(() => {
    const selectors = ['.market-detail-product-summary', '.market-detail-product-icon-card', '.market-detail-trade-summary', '.market-chart-card', '.market-immediate-trade-card'];
    return selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing layout element: ${selector}`);
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
  });
}
async function expectUnchanged(page: Page, before: Awaited<ReturnType<typeof layout>>) {
  const after = await layout(page);
  for (let index = 0; index < before.length; index += 1) {
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(after[index][key] - before[index][key])).toBeLessThanOrEqual(1);
  }
  await expect(page.locator('.commodity-freeze-disclosure__expanded')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '冻结明细', exact: true })).toHaveCount(0);
}
async function expectAligned(page: Page) {
  const metrics = await page.locator('.market-detail-trade-summary').evaluate((element) => {
    const items = element.querySelectorAll(':scope > span');
    const available = items[2]; const frozen = items[3];
    const top = (item: Element, selector: string) => item.querySelector(selector)!.getBoundingClientRect().top;
    return { titles: Math.abs(top(available, 'small') - top(frozen, 'small')), values: Math.abs(top(available, 'strong') - top(frozen, 'strong')) };
  });
  expect(metrics.titles).toBeLessThanOrEqual(1);
  expect(metrics.values).toBeLessThanOrEqual(1);
}

for (const width of [320, 390, 960]) {
  test(`frozen source tooltip keeps the existing layout at ${width}px`, async ({ page }) => {
    const errors: string[] = []; const writes: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (request.method() === 'POST') writes.push(request.url()); });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('market-runtime-test.html?scenario=freeze-details');
    const trigger = page.getByRole('button', { name: '查看冻结库存 320 的来源明细' });
    await expect(page.locator('.market-history-chart .economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
    await trigger.scrollIntoViewIfNeeded();
    await expectAligned(page);
    const before = await layout(page);
    const preview = tooltipFor(page);
    await trigger.hover();
    await expect(preview).toBeVisible();
    for (const text of ['生产冻结', '经营冻结', '合同冻结', '拍卖冻结', '磨坊', '120', '饲料厂', '80', 'supply-123', '70']) await expect(preview).toContainText(text);
    await expectUnchanged(page, before);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(preview).toHaveAttribute('data-pinned', 'true');
    await preview.hover();
    await expect(preview).toBeVisible();
    await expect(preview).not.toContainText('保障目标');
    await expect(preview).not.toContainText('缺口');
    await page.evaluate(() => window.__updateFreezeFixture?.());
    await expect(preview).toContainText('325');
    await expect(preview).toContainText('125');
    await expectUnchanged(page, before);
    const bounds = await preview.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await expect(preview).toContainText('冻结商品只供对应业务使用');
    await page.keyboard.press('Escape');
    await expect(preview).toHaveCount(0);
    await expectUnchanged(page, before);
    if (width <= 720) await expect(page.locator('[data-mobile-workspace-sheet-host="true"]')).toBeVisible();
    const updatedTrigger = page.getByRole('button', { name: '查看冻结库存 325 的来源明细' });
    await updatedTrigger.click();
    await expect(preview).toBeVisible();
    await updatedTrigger.click();
    await expect(preview).toHaveCount(0);
    expect(errors).toEqual([]); expect(writes).toEqual([]);
    await page.screenshot({ path: `test-results/commodity-freezes-${width}.png`, fullPage: false });
  });
}

test.describe('real touch frozen disclosures', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const width of [320, 390]) {
    test(`tap, long content and enlarged text remain floating at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('market-runtime-test.html?scenario=freeze-long');
      await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; window.dispatchEvent(new Event('resize')); });
      const trigger = page.getByRole('button', { name: '查看冻结库存 320 的来源明细' });
      await trigger.scrollIntoViewIfNeeded();
      await expectAligned(page);
      const before = await layout(page);
      await trigger.tap();
      const preview = tooltipFor(page);
      await expect(preview).toHaveAttribute('data-pinned', 'true');
      await expectUnchanged(page, before);
      const dimensions = await preview.evaluate((element) => ({ scroll: element.scrollHeight, height: element.clientHeight, hostEvents: getComputedStyle(element.parentElement!).pointerEvents }));
      expect(dimensions.scroll).toBeGreaterThan(dimensions.height);
      expect(dimensions.hostEvents).toBe('none');
      await preview.tap();
      await expect(preview).toBeVisible();
      await preview.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect.poll(() => preview.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expectUnchanged(page, before);
      await trigger.tap();
      await expect(preview).toHaveCount(0);
      await trigger.tap();
      await expect(preview).toBeVisible();
      await page.locator('.market-detail-product-icon-card').tap();
      await expect(preview).toHaveCount(0);
      await expectUnchanged(page, before);
    });
  }
});

test('unknown or zero frozen state never invents a source or a shortage target', async ({ page }) => {
  await page.goto('market-runtime-test.html?scenario=freeze-unknown');
  await page.getByRole('button', { name: '查看冻结库存 320 的来源明细' }).click();
  await expect(tooltipFor(page)).toContainText('冻结来源明细暂不可用');
  await expect(tooltipFor(page)).not.toContainText('生产冻结');
  await page.goto('market-runtime-test.html');
  await page.getByRole('button', { name: '查看冻结库存 0 的来源明细' }).click();
  await expect(tooltipFor(page)).toContainText('暂无冻结');
});
