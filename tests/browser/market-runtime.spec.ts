import { expect, test, type Locator, type Page } from '@playwright/test';

async function capturePageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function inspectHorizontalOverflow(locator: Locator) {
  return locator.evaluate((element) => {
    const surface = element as HTMLElement;
    const surfaceRect = surface.getBoundingClientRect();
    const offenders = Array.from(surface.querySelectorAll<HTMLElement>('*'))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          selector: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${Array.from(node.classList).map((name) => `.${name}`).join('')}`,
          left: Math.round(rect.left - surfaceRect.left),
          right: Math.round(rect.right - surfaceRect.left),
          width: Math.round(rect.width),
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          position: getComputedStyle(node).position,
        };
      })
      .filter((item) => item.right > surface.clientWidth + 1 || item.left < -1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 12);
    return {
      clientWidth: surface.clientWidth,
      scrollWidth: surface.scrollWidth,
      offenders,
    };
  });
}

test('market desktop layout gives the full chart the dominant column and intrinsic ratio', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  await expect(page.getByRole('heading', { name: '市场', exact: true })).toBeVisible();
  const orderEntry = page.locator('.order-entry');
  const orderBook = page.locator('.single-order-book');
  const chartCard = page.locator('.market-chart-card');
  const chart = chartCard.locator('.market-history-chart.full');
  const orderBox = await requireBox(orderEntry);
  const bookBox = await requireBox(orderBook);
  const chartCardBox = await requireBox(chartCard);
  const chartBox = await requireBox(chart);

  expect(Math.max(orderBox.y, bookBox.y, chartCardBox.y) - Math.min(orderBox.y, bookBox.y, chartCardBox.y)).toBeLessThan(3);
  expect(chartCardBox.width).toBeGreaterThanOrEqual(620);
  expect(chartCardBox.width).toBeGreaterThan(orderBox.width * 1.7);
  expect(chartBox.width).toBeGreaterThan(chartCardBox.width * 0.94);
  expect(chartBox.width / chartBox.height).toBeGreaterThan(1.72);
  expect(chartBox.width / chartBox.height).toBeLessThan(1.82);
  expect(bookBox.height).toBeLessThan(chartCardBox.height * 0.8);
  await expect(chartCard.getByText('最近 24h 3 笔 · 6m × 240', { exact: true })).toBeVisible();

  const footerColumns = await chartCard.locator('.chart-footer').evaluate((element) => (
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
  ));
  expect(footerColumns).toBe(2);
  expect(await page.locator('.market-page-surface').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('market medium and narrow layouts follow the real content width without horizontal overflow', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const orderBox = await requireBox(page.locator('.order-entry'));
  const bookBox = await requireBox(page.locator('.single-order-book'));
  const chartBox = await requireBox(page.locator('.market-chart-card'));
  expect(Math.abs(orderBox.y - bookBox.y)).toBeLessThan(3);
  expect(chartBox.y).toBeGreaterThan(Math.max(orderBox.y + orderBox.height, bookBox.y + bookBox.height) - 2);
  expect(Math.abs(chartBox.x - orderBox.x)).toBeLessThan(3);
  expect(chartBox.width).toBeGreaterThan(orderBox.width + bookBox.width);

  await page.setViewportSize({ width: 900, height: 1000 });
  const surface = page.locator('.market-page-surface');
  await surface.evaluate((element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.style.width = '790px';
    htmlElement.style.maxWidth = '100%';
  });
  await expect.poll(() => surface.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(820);
  const stackedOrder = await requireBox(page.locator('.order-entry'));
  const stackedBook = await requireBox(page.locator('.single-order-book'));
  const stackedChart = await requireBox(page.locator('.market-chart-card'));
  expect(stackedBook.y).toBeGreaterThan(stackedOrder.y + stackedOrder.height - 2);
  expect(stackedChart.y).toBeGreaterThan(stackedBook.y + stackedBook.height - 2);
  const overflow = await inspectHorizontalOverflow(surface);
  expect(overflow, JSON.stringify(overflow, null, 2)).toMatchObject({
    scrollWidth: overflow.clientWidth,
    offenders: [],
  });
  expect(pageErrors).toEqual([]);
});

test('market trend uses neutral semantics for zero and counts only the current 24 hour window', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=zero-trend');

  const trend = page.locator('.market-trend-tag');
  await expect(trend).toHaveClass(/status-neutral/);
  await expect(trend).toContainText('0');
  expect((await trend.textContent())?.includes('+')).toBe(false);
  await expect(page.getByText('最近 24h 3 笔 · 6m × 240', { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('market order form explains why an order cannot be submitted', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });

  await page.goto('market-runtime-test.html?scenario=funds-empty');
  await expect(page.getByRole('status')).toHaveText('可用资金不足，当前价格至少需要 2。');
  await expect(page.getByRole('spinbutton', { name: '数量' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '提交小麦买单' })).toBeDisabled();

  await page.goto('market-runtime-test.html?scenario=warehouse-full');
  await expect(page.getByRole('status')).toHaveText('仓库剩余空间不足，无法提交商品买单。');
  await expect(page.getByRole('spinbutton', { name: '数量' })).toBeDisabled();

  await page.goto('market-runtime-test.html?scenario=sell-empty');
  await expect(page.getByRole('status')).toHaveText('当前没有可出售的小麦。');
  await expect(page.getByRole('button', { name: '提交小麦卖单' })).toBeDisabled();

  await page.goto('market-runtime-test.html?scenario=active');
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: '数量' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '提交小麦买单' })).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test('market asset directory uses two rows, explicit groups, controls and visible current state', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const directory = page.getByRole('tablist', { name: '选择交易资产' });
  const rowCount = await directory.evaluate((element) => (
    getComputedStyle(element).gridTemplateRows.split(' ').filter(Boolean).length
  ));
  expect(rowCount).toBe(2);
  await expect(page.locator('.asset-directory-divider')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '向前浏览资产' })).toBeVisible();
  await expect(page.getByRole('button', { name: '向后浏览资产' })).toBeVisible();

  await page.getByRole('button', { name: '向后浏览资产' }).click();
  await expect.poll(() => directory.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  const finalFacility = page.getByRole('tab', { name: /^电子工厂/ });
  await finalFacility.click();
  await expect(finalFacility).toHaveAttribute('aria-selected', 'true');
  await expect(finalFacility).toHaveAttribute('data-current', '当前');
  const directoryBox = await requireBox(directory);
  const facilityBox = await requireBox(finalFacility);
  expect(facilityBox.x).toBeGreaterThanOrEqual(directoryBox.x - 2);
  expect(facilityBox.x + facilityBox.width).toBeLessThanOrEqual(directoryBox.x + directoryBox.width + 2);
  expect(pageErrors).toEqual([]);
});

test('market order book headings precede their rows and sparse books keep natural height', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  const askLabel = await requireBox(page.locator('.ask-label'));
  const askRow = await requireBox(page.locator('.book-order-row.ask'));
  const divider = await requireBox(page.locator('.order-book-divider'));
  const bidLabel = await requireBox(page.locator('.bid-label'));
  const bidRow = await requireBox(page.locator('.book-order-row.bid'));
  expect(askLabel.y).toBeLessThan(askRow.y);
  expect(askRow.y).toBeLessThan(divider.y);
  expect(divider.y).toBeLessThan(bidLabel.y);
  expect(bidLabel.y).toBeLessThan(bidRow.y);

  const book = await requireBox(page.locator('.single-order-book'));
  const chart = await requireBox(page.locator('.market-chart-card'));
  expect(book.height).toBeLessThan(chart.height * 0.8);
  expect(pageErrors).toEqual([]);
});

test('market order book aggregates same-price orders into one price level', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 720, height: 1000 });
  await page.goto('market-runtime-test.html?scenario=active');

  await expect(page.getByText('最低价前 5 档', { exact: true })).toBeVisible();
  await expect(page.getByText('最高价前 5 档', { exact: true })).toBeVisible();

  const askLevels = page.locator('.book-order-row.ask');
  const bidLevels = page.locator('.book-order-row.bid');
  await expect(askLevels).toHaveCount(1);
  await expect(bidLevels).toHaveCount(1);
  await expect(askLevels).toHaveAttribute('data-order-count', '2');
  await expect(bidLevels).toHaveAttribute('data-order-count', '5');
  await expect(askLevels).toHaveAttribute('aria-label', '卖盘，价格 13，合计剩余 4，包含 2 笔订单');
  await expect(bidLevels).toHaveAttribute('aria-label', '买盘，价格 2，合计剩余 5，包含 5 笔订单');
  expect(pageErrors).toEqual([]);
});
