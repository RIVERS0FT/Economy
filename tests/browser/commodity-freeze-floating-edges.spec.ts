import { expect, test } from '@playwright/test';

for (const width of [320, 390, 960]) {
  test(`long frozen sources remain out of flow and readable at ${width}px / 125%`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.goto('market-runtime-test.html?scenario=freeze-long');
    await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; window.dispatchEvent(new Event('resize')); });
    const trigger = page.getByRole('button', { name: '查看冻结库存 320 的来源明细' });
    await expect(trigger).toBeVisible();
    await expect(page.locator('.market-history-echart')).toHaveAttribute('data-echarts-ready', 'true');
    await expect(page.getByText('正在加载当前市场行情…')).toHaveCount(0);
    const geometry = () => page.locator('.market-detail-product-summary, .market-chart-card, .market-trade-card').evaluateAll((elements) => elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }));
    const before = await geometry();
    await trigger.click();
    const popup = page.getByRole('tooltip').filter({ hasText: '冻结明细' });
    await expect(popup).toHaveAttribute('data-pinned', 'true');
    await expect(popup).toContainText('供货合同 79');
    const bounded = await popup.evaluate((element) => {
      const popupRect = element.getBoundingClientRect();
      const safe = element.parentElement!.getBoundingClientRect();
      const anchor = document.querySelector('.commodity-freeze-disclosure__trigger')!.getBoundingClientRect();
      return { scrollable: element.scrollHeight > element.clientHeight,
        inSafeArea: popupRect.top >= safe.top && popupRect.bottom <= safe.bottom + 1,
        leavesTriggerClear: popupRect.bottom <= anchor.top || popupRect.top >= anchor.bottom };
    });
    expect(bounded).toEqual({ scrollable: true, inSafeArea: true, leavesTriggerClear: true });
    const scroller = page.locator('.mobile-detail-sheet__body, .page-scroll').first();
    const scrollBefore = await scroller.evaluate((element) => element.scrollTop);
    await popup.hover();
    await page.mouse.wheel(0, 180);
    await expect.poll(() => popup.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(scrollBefore);
    await popup.focus();
    await page.evaluate(() => window.__updateFreezeFixture?.());
    await expect(popup).toContainText('325');
    await expect(popup).toBeVisible();
    const after = await geometry();
    after.forEach((box, index) => {
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(box[key] - before[index][key])).toBeLessThanOrEqual(1);
    });
    await page.locator('.market-side-switch button').first().focus();
    await expect(popup).toHaveCount(0);
    await expect(page.locator('.market-detail-trade-summary > *')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
