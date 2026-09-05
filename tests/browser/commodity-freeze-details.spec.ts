import { expect, test, type Page } from '@playwright/test';

const freezeTooltip = (page: Page) => page.getByRole('tooltip').filter({ hasText: '冻结明细' });

async function readLayout(page: Page) {
  return page.evaluate(() => {
    const selectors = ['.market-detail-trade-summary', '.market-detail-product-icon-card', '.market-chart-card', '.market-trade-card'];
    return selectors.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector)!;
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
  });
}

async function expectStableLayout(page: Page, before: Awaited<ReturnType<typeof readLayout>>) {
  const after = await readLayout(page);
  after.forEach((box, index) => {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(box[key] - before[index][key]), `浮层不能改变第 ${index + 1} 个区域的 ${key}`).toBeLessThanOrEqual(1);
    }
  });
  await expect(page.locator('.market-detail-trade-summary > *')).toHaveCount(4);
  await expect(page.getByRole('region', { name: '冻结明细' })).toHaveCount(0);
  await expect(page.locator('.commodity-freeze-disclosure__expanded')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function expectAlignedInventory(page: Page) {
  const alignment = await page.locator('.market-detail-trade-summary').evaluate((element) => {
    const available = element.children[2];
    const frozen = element.children[3];
    const labelA = available.querySelector('small')!.getBoundingClientRect();
    const labelB = frozen.querySelector('small')!.getBoundingClientRect();
    const valueA = available.querySelector('strong')!.getBoundingClientRect();
    const valueB = frozen.querySelector('button strong')!.getBoundingClientRect();
    return { labels: Math.abs(labelA.y - labelB.y), values: Math.abs(valueA.bottom - valueB.bottom) };
  });
  expect(alignment.labels, '可用库存与冻结库存标题必须对齐').toBeLessThanOrEqual(1);
  expect(alignment.values, '可用库存与冻结库存数值必须对齐').toBeLessThanOrEqual(1);
}

async function expectSafePopup(page: Page) {
  const popup = freezeTooltip(page);
  const box = await popup.boundingBox();
  const safe = await page.locator('[data-workspace-tooltip-layer="true"]').boundingBox();
  expect(box).not.toBeNull(); expect(safe).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(safe!.x - 1);
  expect(box!.y).toBeGreaterThanOrEqual(safe!.y - 1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(safe!.x + safe!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(safe!.y + safe!.height + 1);
  expect(await popup.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + Math.min(20, rect.height / 2));
    return hit === element || (hit !== null && element.contains(hit));
  }), '明细必须实际可命中，不能藏在 Sheet 后面').toBe(true);
}

for (const width of [320, 390, 960]) {
  test(`source-backed commodity freezes stay floating without layout shifts at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    const writes: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (request.method() === 'POST') writes.push(request.url()); });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('market-runtime-test.html?scenario=freeze-details');
    const trigger = page.getByRole('button', { name: '查看冻结库存 320 的来源明细' });
    await expect(trigger).toBeVisible();
    await expect(page.locator('.market-history-echart')).toHaveAttribute('data-echarts-ready', 'true');
    await expect(page.getByText('正在加载当前市场行情…')).toHaveCount(0);
    await expectAlignedInventory(page);
    const before = await readLayout(page);
    await trigger.hover();
    const preview = freezeTooltip(page);
    await expect(preview).toBeVisible();
    for (const text of ['生产冻结', '经营冻结', '合同冻结', '拍卖冻结', '磨坊', '120', '饲料厂', '80', 'supply-123', '70']) {
      await expect(preview).toContainText(text);
    }
    await expectStableLayout(page, before);
    await preview.hover();
    await expect(preview).toBeVisible();
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(preview).toHaveAttribute('data-pinned', 'true');
    await preview.click();
    await expect(preview).toBeVisible();
    await expect(preview).not.toContainText('保障目标');
    await expect(preview).not.toContainText('缺口');
    await page.evaluate(() => window.__updateFreezeFixture?.());
    await expect(preview).toContainText('325');
    await expect(preview).toContainText('125');
    await expect(page.getByRole('button', { name: '查看冻结库存 325 的来源明细' })).toHaveAttribute('aria-expanded', 'true');
    await expectStableLayout(page, before);
    await expectSafePopup(page);
    await page.screenshot({ path: `test-results/commodity-freezes-${width}.png`, fullPage: false });
    await page.getByRole('button', { name: '查看冻结库存 325 的来源明细' }).focus();
    await page.keyboard.press('Escape');
    await expect(preview).toHaveCount(0);
    await expect(trigger.or(page.getByRole('button', { name: '查看冻结库存 325 的来源明细' }))).toBeVisible();
    await expectStableLayout(page, before);
    expect(errors).toEqual([]); expect(writes).toEqual([]);
  });
}

for (const width of [320, 390]) {
  test.describe(`frozen inventory actual touch ${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
    test('first tap pins, second tap closes and Escape does not close the mobile Sheet', async ({ page }) => {
      await page.goto('market-runtime-test.html?scenario=freeze-details');
      await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; window.dispatchEvent(new Event('resize')); });
      const trigger = page.getByRole('button', { name: '查看冻结库存 320 的来源明细' });
      await expect(trigger).toBeVisible();
      await expect(page.locator('.market-history-echart')).toHaveAttribute('data-echarts-ready', 'true');
      await expect(page.getByText('正在加载当前市场行情…')).toHaveCount(0);
      await expectAlignedInventory(page);
      const before = await readLayout(page);
      await trigger.tap();
      await expect(freezeTooltip(page)).toHaveAttribute('data-pinned', 'true');
      await expectSafePopup(page);
      await expectStableLayout(page, before);
      await trigger.tap();
      await expect(freezeTooltip(page)).toHaveCount(0);
      await expectStableLayout(page, before);
      await trigger.tap();
      await page.keyboard.press('Escape');
      await expect(freezeTooltip(page)).toHaveCount(0);
      await expect(page.locator('.mobile-detail-sheet')).toBeVisible();
      await expect(trigger).toBeVisible();
      await trigger.tap();
      await page.locator('.market-detail-product-icon-card').tap();
      await expect(freezeTooltip(page)).toHaveCount(0);
      await expectStableLayout(page, before);
    });
  });
}

test('unknown or zero frozen state never invents a source or renders a shortage target', async ({ page }) => {
  await page.goto('market-runtime-test.html?scenario=freeze-unknown');
  await page.getByRole('button', { name: '查看冻结库存 320 的来源明细' }).click();
  await expect(freezeTooltip(page)).toContainText('冻结来源明细暂不可用');
  await expect(freezeTooltip(page)).not.toContainText('生产冻结');
  await page.goto('market-runtime-test.html');
  await page.getByRole('button', { name: '查看冻结库存 0 的来源明细' }).click();
  await expect(freezeTooltip(page)).toContainText('暂无冻结');
  await expect(page.getByRole('region', { name: '冻结明细' })).toHaveCount(0);
});
