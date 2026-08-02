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

async function inspectMarketLayoutBounds(locator: Locator) {
  return locator.evaluate((element) => {
    const surface = element as HTMLElement;
    const surfaceRect = surface.getBoundingClientRect();
    const pageScroll = surface.closest<HTMLElement>('.page-scroll');
    const directChildren = Array.from(surface.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement)
      .map((child) => {
        const rect = child.getBoundingClientRect();
        return {
          selector: `${child.tagName.toLowerCase()}${Array.from(child.classList).map((name) => `.${name}`).join('')}`,
          left: Math.round(rect.left - surfaceRect.left),
          right: Math.round(rect.right - surfaceRect.left),
          width: Math.round(rect.width),
        };
      });
    const accountSections = Array.from(surface.querySelectorAll<HTMLElement>('.market-account-grid > section'))
      .map((section) => {
        const sectionRect = section.getBoundingClientRect();
        const scrollArea = section.querySelector<HTMLElement>('.table-scroll-area, .local-trades-scroll-area');
        const scrollRect = scrollArea?.getBoundingClientRect();
        return {
          sectionWidth: Math.round(sectionRect.width),
          scrollAreaWidth: Math.round(scrollRect?.width ?? 0),
          scrollAreaLeft: Math.round((scrollRect?.left ?? sectionRect.left) - sectionRect.left),
          scrollAreaRight: Math.round((scrollRect?.right ?? sectionRect.right) - sectionRect.left),
        };
      });
    return {
      surfaceWidth: Math.round(surfaceRect.width),
      directChildren,
      accountSections,
      pageScrollClientWidth: pageScroll?.clientWidth ?? 0,
      pageScrollScrollWidth: pageScroll?.scrollWidth ?? 0,
    };
  });
}

async function inspectChartAxis(chart: Locator) {
  return chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    const svg = wrapper.querySelector<SVGSVGElement>('.economy-chart__canvas svg');
    if (!svg) throw new Error('ECharts SVG is not ready');
    const allLabels = Array.from(svg.querySelectorAll<SVGTextElement>('text')).map((text) => {
      const rect = text.getBoundingClientRect();
      return { text: text.textContent?.trim() ?? '', left: rect.left - wrapperRect.left, right: rect.right - wrapperRect.left };
    });
    const readTicks = (name: string) => (wrapper.dataset[name] || '').split(',').filter(Boolean).map(Number);
    return {
      width: wrapperRect.width,
      priceTicks: readTicks('priceTicks'),
      volumeTicks: readTicks('volumeTicks'),
      allLabels,
      legendLabels: Array.from(wrapper.querySelectorAll<HTMLElement>('.market-chart-legend-item')).map((item) => item.textContent?.trim() ?? ''),
      ready: wrapper.querySelector('.economy-chart')?.getAttribute('data-echarts-ready'),
      timeAxisInterval: Number(wrapper.dataset.timeAxisInterval),
      priceTickCount: Number(wrapper.dataset.priceTickCount),
      volumeTickCount: Number(wrapper.dataset.volumeTickCount),
    };
  });
}

test('market desktop layout keeps order entry and order book in one trade card beside the chart', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  await expect(page.getByRole('heading', { name: '市场', exact: true })).toBeVisible();
  const tradeCard = page.locator('.market-trade-card');
  const orderEntry = tradeCard.locator('.order-entry');
  const orderBook = tradeCard.locator('.single-order-book');
  const chartCard = page.locator('.market-chart-card');
  const chart = chartCard.locator('.market-history-chart.full');
  const tradeBox = await requireBox(tradeCard);
  const orderBox = await requireBox(orderEntry);
  const bookBox = await requireBox(orderBook);
  const chartCardBox = await requireBox(chartCard);
  const chartBox = await requireBox(chart);

  await expect(page.locator('.market-trade-card')).toHaveCount(1);
  await expect(page.locator('.market-grid > .order-entry')).toHaveCount(0);
  await expect(page.locator('.market-grid > .single-order-book')).toHaveCount(0);
  expect(Math.abs(tradeBox.y - chartCardBox.y)).toBeLessThan(3);
  expect(tradeBox.width).toBeGreaterThanOrEqual(640);
  expect(chartCardBox.width).toBeGreaterThanOrEqual(620);
  expect(Math.abs(orderBox.y - bookBox.y)).toBeLessThan(3);
  expect(bookBox.x).toBeGreaterThan(orderBox.x + orderBox.width - 3);
  expect(orderBox.x).toBeGreaterThanOrEqual(tradeBox.x - 1);
  expect(bookBox.x + bookBox.width).toBeLessThanOrEqual(tradeBox.x + tradeBox.width + 1);
  expect(chartBox.width).toBeGreaterThan(chartCardBox.width * 0.94);
  expect(chartBox.width / chartBox.height).toBeGreaterThan(1.72);
  expect(chartBox.width / chartBox.height).toBeLessThan(1.82);
  await expect(tradeCard.getByRole('heading', { name: /交易$/ })).toBeVisible();
  await expect(tradeCard.getByRole('heading', { name: '下单', exact: true })).toBeVisible();
  await expect(tradeCard.getByRole('heading', { name: '订单簿', exact: true })).toBeVisible();
  await expect(tradeCard.locator('.order-book-columns')).toContainText(/方向\s*价格\s*数量/);
  await expect(chartCard.locator('.market-chart-footer')).toBeVisible();
  await expect(chartCard.locator('.chart-footer')).toHaveCount(0);
  await expect(chartCard.getByText('均衡／方向未知', { exact: true })).toHaveCount(0);

  const axis = await inspectChartAxis(chart);
  expect(axis.legendLabels).toEqual(['净主动买入', '净主动卖出']);
  expect(axis.ready).toBe('true');
  expect(axis.priceTicks.length).toBe(axis.priceTickCount);
  expect(axis.priceTicks.length).toBeGreaterThanOrEqual(3);
  expect(axis.priceTicks.length).toBeLessThanOrEqual(7);
  expect(axis.priceTicks.every((value) => Number.isInteger(value))).toBe(true);
  expect(axis.volumeTicks.every((value) => Number.isInteger(value))).toBe(true);
  for (const label of axis.allLabels) {
    expect(label.left, `${label.text} 不得越出图表左侧`).toBeGreaterThanOrEqual(-1);
    expect(label.right, `${label.text} 不得越出图表右侧`).toBeLessThanOrEqual(axis.width + 1);
  }

  const layout = await inspectMarketLayoutBounds(page.locator('.market-page-surface'));
  expect(layout.pageScrollScrollWidth).toBeLessThanOrEqual(layout.pageScrollClientWidth + 1);
  expect(layout.directChildren.every((child) => child.left >= -1 && child.right <= layout.surfaceWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('market chart uses one linked hover state and keeps the price line protected', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  const chart = page.locator('.market-history-chart.full');
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
  await expect(chart).toHaveAttribute('data-axis-pointer-linked', 'true');
  await expect(chart).toHaveAttribute('data-hover-emphasis-disabled', 'true');
  const bounds = await requireBox(chart);
  const geometry = await chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const read = (name: string) => Number(wrapper.dataset[name]);
    return {
      left: read('axisLeft'),
      right: read('axisRight'),
      priceTop: read('priceTop'),
      priceBottom: read('priceBottom'),
      volumeTop: read('volumeTop'),
      volumeBottom: read('volumeBottom'),
    };
  });
  const x = bounds.x + geometry.left + (bounds.width - geometry.left - geometry.right) * 0.44;
  const tooltip = page.locator('.economy-chart-tooltip');

  await page.mouse.move(x, bounds.y + (geometry.priceTop + geometry.priceBottom) / 2);
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('价格');
  await expect(tooltip).toContainText('总成交量');
  const priceHoverText = await tooltip.innerText();

  await page.mouse.move(x, bounds.y + (geometry.volumeTop + geometry.volumeBottom) / 2);
  await expect(tooltip).toBeVisible();
  const volumeHoverText = await tooltip.innerText();
  expect(volumeHoverText.replace(/\s+/g, ' ').trim()).toBe(priceHoverText.replace(/\s+/g, ' ').trim());
  expect(pageErrors).toEqual([]);
});

test('market medium and narrow layouts keep the trade card responsive without horizontal overflow', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const tradeCard = page.locator('.market-trade-card');
  const orderEntry = tradeCard.locator('.order-entry');
  const orderBook = tradeCard.locator('.single-order-book');
  const tradeBox = await requireBox(tradeCard);
  const orderBox = await requireBox(orderEntry);
  const bookBox = await requireBox(orderBook);
  const chartBox = await requireBox(page.locator('.market-chart-card'));
  expect(Math.abs(orderBox.y - bookBox.y)).toBeLessThan(3);
  expect(bookBox.x).toBeGreaterThan(orderBox.x + orderBox.width - 3);
  expect(chartBox.y).toBeGreaterThan(tradeBox.y + tradeBox.height - 2);
  expect(Math.abs(chartBox.x - tradeBox.x)).toBeLessThan(3);
  expect(Math.abs(chartBox.width - tradeBox.width)).toBeLessThan(3);

  await page.setViewportSize({ width: 900, height: 1000 });
  const surface = page.locator('.market-page-surface');
  await surface.evaluate((element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.style.width = '790px';
    htmlElement.style.maxWidth = '100%';
  });
  await expect.poll(() => surface.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(820);
  const narrowTrade = await requireBox(tradeCard);
  const stackedOrder = await requireBox(orderEntry);
  const stackedBook = await requireBox(orderBook);
  const stackedChart = await requireBox(page.locator('.market-chart-card'));
  expect(stackedBook.y).toBeGreaterThan(stackedOrder.y + stackedOrder.height - 2);
  expect(stackedChart.y).toBeGreaterThan(narrowTrade.y + narrowTrade.height - 2);

  const layout = await inspectMarketLayoutBounds(surface);
  expect(layout.pageScrollScrollWidth).toBeLessThanOrEqual(layout.pageScrollClientWidth + 1);
  expect(layout.directChildren.every((child) => child.left >= -1 && child.right <= layout.surfaceWidth + 1)).toBe(true);
  expect(layout.accountSections.length).toBe(2);
  for (const section of layout.accountSections) {
    expect(section.scrollAreaLeft).toBeGreaterThanOrEqual(-1);
    expect(section.scrollAreaRight).toBeLessThanOrEqual(section.sectionWidth + 1);
    expect(section.scrollAreaWidth).toBeLessThanOrEqual(section.sectionWidth + 1);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOrder = await requireBox(orderEntry);
  const mobileBook = await requireBox(orderBook);
  expect(mobileBook.y).toBeGreaterThan(mobileOrder.y + mobileOrder.height - 2);
  const mobileAxis = await inspectChartAxis(page.locator('.market-history-chart.full'));
  for (const label of mobileAxis.allLabels) {
    expect(label.left, `移动端 ${label.text} 不得越出图表左侧`).toBeGreaterThanOrEqual(-1);
    expect(label.right, `移动端 ${label.text} 不得越出图表右侧`).toBeLessThanOrEqual(mobileAxis.width + 1);
  }
  expect(pageErrors).toEqual([]);
});

test('market trend uses neutral semantics for zero', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=zero-trend');

  const trend = page.locator('.market-trend-tag');
  await expect(trend).toHaveClass(/status-neutral/);
  await expect(trend).toContainText('0');
  expect((await trend.textContent())?.includes('+')).toBe(false);
  await expect(page.locator('.market-chart-card .chart-footer')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('market order form explains why an order cannot be submitted', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });

  await page.goto('market-runtime-test.html?scenario=funds-empty');
  await expect(page.getByRole('status')).toHaveText('可用资金不足，当前价格至少需要 2.00。');
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

test('market quick quantities use funds, inventory and holdings without duplicate quantity errors', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const quantityInput = page.getByRole('spinbutton', { name: '数量' });
  await expect(page.getByRole('button', { name: '1/4 资金', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '1/2 资金', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '全部资金', exact: true })).toBeVisible();
  await expect(page.getByText('当前价格下最多可买 500。', { exact: true })).toHaveCount(1);

  await page.getByRole('button', { name: '全部资金', exact: true }).click();
  await expect(quantityInput).toHaveValue('500');
  await quantityInput.fill('501');
  await expect(page.getByRole('alert')).toHaveText('当前价格下最多可买 500。');
  await expect(page.getByText('当前价格下最多可买 500。', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '提交小麦买单' })).toBeDisabled();

  await page.getByRole('button', { name: '卖出', exact: true }).click();
  await expect(page.getByRole('button', { name: '1/4 库存', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '1/2 库存', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '全部库存', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '全部库存', exact: true }).click();
  await expect(quantityInput).toHaveValue('8');

  const machineryTab = page.getByRole('tab', { name: /^机械工厂/ });
  await machineryTab.click();
  await expect(machineryTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: '1/4 持有', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '1/2 持有', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '全部持有', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '全部持有', exact: true }).click();
  await expect(quantityInput).toHaveValue('18');
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('market product card renders icon layer before the data layer with independent stacking', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const wheatTab = page.getByRole('tab', { name: /^小麦/ });
  await expect(wheatTab).toHaveAttribute('aria-selected', 'true');

  const directLayers = await wheatTab.locator(':scope > span').evaluateAll((elements) => (
    elements.map((element) => element.className)
  ));
  expect(directLayers).toEqual([
    'market-asset-card__icon-layer',
    'market-asset-card__data-layer',
  ]);

  const iconLayer = wheatTab.locator(':scope > .market-asset-card__icon-layer');
  const dataLayer = wheatTab.locator(':scope > .market-asset-card__data-layer');
  await expect(iconLayer.locator(':scope > .product-icon')).toHaveCount(1);
  await expect(iconLayer.locator(':scope > :not(.product-icon)')).toHaveCount(0);
  await expect(dataLayer.locator(':scope > .market-asset-card__name')).toHaveText('小麦');
  await expect(dataLayer.locator(':scope > .market-asset-card__price')).toContainText('2');
  await expect(dataLayer.locator(':scope > .market-asset-card__current')).toHaveText('当前');
  await expect(dataLayer.locator(':scope > .market-asset-card__inventory')).toContainText('8');

  const stacking = await wheatTab.evaluate((element) => {
    const icon = element.querySelector<HTMLElement>(':scope > .market-asset-card__icon-layer');
    const data = element.querySelector<HTMLElement>(':scope > .market-asset-card__data-layer');
    if (!icon || !data) return null;
    const iconStyle = getComputedStyle(icon);
    const dataStyle = getComputedStyle(data);
    const tabRect = element.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    return {
      iconPosition: iconStyle.position,
      dataPosition: dataStyle.position,
      iconZIndex: iconStyle.zIndex,
      dataZIndex: dataStyle.zIndex,
      iconPointerEvents: iconStyle.pointerEvents,
      dataPointerEvents: dataStyle.pointerEvents,
      horizontalCenterDelta: Math.abs((iconRect.left + iconRect.width / 2) - (tabRect.left + tabRect.width / 2)),
      verticalCenterDelta: Math.abs((iconRect.top + iconRect.height / 2) - (tabRect.top + tabRect.height / 2)),
    };
  });
  expect(stacking).not.toBeNull();
  expect(stacking).toMatchObject({
    iconPosition: 'absolute',
    dataPosition: 'absolute',
    iconZIndex: '1',
    dataZIndex: '2',
    iconPointerEvents: 'none',
    dataPointerEvents: 'none',
  });
  expect(stacking!.horizontalCenterDelta).toBeLessThan(2);
  expect(stacking!.verticalCenterDelta).toBeLessThan(2);
  expect(pageErrors).toEqual([]);
});

test('market facility card uses the same layers with ID-mapped artwork and SVG fallback semantics', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const facilityTab = page.getByRole('tab', { name: /^机械工厂/ });
  const directLayers = await facilityTab.locator(':scope > span').evaluateAll((elements) => (
    elements.map((element) => element.className)
  ));
  expect(directLayers).toEqual([
    'market-asset-card__icon-layer',
    'market-asset-card__data-layer',
  ]);

  const artwork = facilityTab.locator(':scope > .market-asset-card__icon-layer > .facility-icon');
  await expect(artwork).toHaveAttribute('data-facility-icon', 'machine-factory');
  await expect.poll(() => artwork.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('machine-factory');
  await expect(facilityTab.locator('.market-asset-card__name > .market-asset-card__name-icon')).toHaveCount(1);
  await expect(facilityTab.locator('.market-asset-card__inventory > .game-icon')).toHaveCount(1);
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

  const finalFacility = page.getByRole('tab', { name: /^电子厂/ });
  await finalFacility.click();
  await expect(finalFacility).toHaveAttribute('aria-selected', 'true');
  await expect(finalFacility.locator('.market-asset-card__current')).toHaveText('当前');
  const directoryBox = await requireBox(directory);
  const facilityBox = await requireBox(finalFacility);
  expect(facilityBox.x).toBeGreaterThanOrEqual(directoryBox.x - 2);
  expect(facilityBox.x + facilityBox.width).toBeLessThanOrEqual(directoryBox.x + directoryBox.width + 2);
  expect(pageErrors).toEqual([]);
});

test('mobile market sticky asset divider stays below the status bar chrome', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active');

  const pageScroll = page.locator('.page-scroll');
  const statusBar = page.locator('.asset-bar');
  const directoryShell = page.locator('.asset-directory-shell');
  const divider = page.locator('.asset-directory-divider').first();
  await expect(statusBar).toBeVisible();
  await expect(directoryShell).toBeVisible();
  await expect(divider).toBeVisible();

  const localStacking = await directoryShell.evaluate((element) => {
    const style = getComputedStyle(element);
    return { position: style.position, zIndex: style.zIndex };
  });
  expect(localStacking.position).toBe('relative');
  expect(localStacking.zIndex).toBe('0');

  await pageScroll.evaluate((element) => {
    const status = document.querySelector<HTMLElement>('.asset-bar');
    const assetDivider = document.querySelector<HTMLElement>('.asset-directory-divider');
    if (!status || !assetDivider) throw new Error('mobile market stacking fixture is incomplete');
    const statusRect = status.getBoundingClientRect();
    const dividerRect = assetDivider.getBoundingClientRect();
    element.scrollTop += dividerRect.top - statusRect.top;
  });

  const stacking = await page.evaluate(() => {
    const status = document.querySelector<HTMLElement>('.asset-bar');
    const assetDivider = document.querySelector<HTMLElement>('.asset-directory-divider');
    if (!status || !assetDivider) throw new Error('mobile market stacking fixture is incomplete');
    const statusRect = status.getBoundingClientRect();
    const dividerRect = assetDivider.getBoundingClientRect();
    const x = Math.max(statusRect.left + 2, Math.min(dividerRect.right - 2, dividerRect.left + dividerRect.width / 2));
    const y = statusRect.top + statusRect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      overlaps: dividerRect.top < statusRect.bottom && dividerRect.bottom > statusRect.top,
      hitInsideStatus: hit instanceof Element && status.contains(hit),
      hitClassName: hit instanceof HTMLElement ? hit.className : hit?.nodeName ?? '',
    };
  });

  expect(stacking.overlaps).toBe(true);
  expect(stacking.hitInsideStatus, `命中元素应属于状态栏，实际为 ${stacking.hitClassName}`).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('market order book headings precede their rows and midpoint separates both sides', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  const askLabel = await requireBox(page.locator('.ask-label'));
  const askRow = await requireBox(page.locator('.book-order-row.ask'));
  const midpoint = await requireBox(page.locator('.order-book-midpoint'));
  const bidLabel = await requireBox(page.locator('.bid-label'));
  const bidRow = await requireBox(page.locator('.book-order-row.bid'));
  expect(askLabel.y).toBeLessThan(askRow.y);
  expect(askRow.y).toBeLessThan(midpoint.y);
  expect(midpoint.y).toBeLessThan(bidLabel.y);
  expect(bidLabel.y).toBeLessThan(bidRow.y);
  await expect(page.locator('.order-book-midpoint')).toContainText('最近成交');

  const tradeCard = await requireBox(page.locator('.market-trade-card'));
  const book = await requireBox(page.locator('.single-order-book'));
  expect(book.x).toBeGreaterThanOrEqual(tradeCard.x - 1);
  expect(book.x + book.width).toBeLessThanOrEqual(tradeCard.x + tradeCard.width + 1);
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
  await expect(askLevels).toHaveAttribute('aria-label', '卖盘，价格 13.00，合计剩余 4，包含 2 笔订单');
  await expect(bidLevels).toHaveAttribute('aria-label', '买盘，价格 2.00，合计剩余 5，包含 5 笔订单');
  expect(pageErrors).toEqual([]);
});

test('market product artwork uses 72px desktop and 56px mobile while preserving cards and corner spacing', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const wheatTab = page.getByRole('tab', { name: /^小麦/ });
  const desktopMetrics = await wheatTab.evaluate((element) => {
    const card = element as HTMLElement;
    const iconLayer = card.querySelector<HTMLElement>('.market-asset-card__icon-layer');
    const dataLayer = card.querySelector<HTMLElement>('.market-asset-card__data-layer');
    const artwork = iconLayer?.querySelector<HTMLElement>(':scope > .product-icon');
    const nameIcon = card.querySelector<HTMLElement>('.market-asset-card__name-icon');
    const directory = card.closest<HTMLElement>('.unified-asset-tabs');
    if (!iconLayer || !dataLayer || !artwork || !nameIcon || !directory) {
      throw new Error('market product card visual fixture is incomplete');
    }
    const cardRect = card.getBoundingClientRect();
    const artworkRect = artwork.getBoundingClientRect();
    const nameIconRect = nameIcon.getBoundingClientRect();
    const cardStyle = getComputedStyle(card);
    const iconLayerStyle = getComputedStyle(iconLayer);
    const dataLayerStyle = getComputedStyle(dataLayer);
    return {
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
      artworkWidth: artworkRect.width,
      artworkHeight: artworkRect.height,
      nameIconWidth: nameIconRect.width,
      nameIconHeight: nameIconRect.height,
      borderRadius: Number.parseFloat(cardStyle.borderTopLeftRadius),
      directoryGap: Number.parseFloat(getComputedStyle(directory).columnGap),
      transform: cardStyle.transform,
      iconInsetTop: Number.parseFloat(iconLayerStyle.top),
      iconInsetBottom: Number.parseFloat(iconLayerStyle.bottom),
      dataPaddingTop: Number.parseFloat(dataLayerStyle.paddingTop),
      dataPaddingRight: Number.parseFloat(dataLayerStyle.paddingRight),
      dataPaddingBottom: Number.parseFloat(dataLayerStyle.paddingBottom),
      dataPaddingLeft: Number.parseFloat(dataLayerStyle.paddingLeft),
      dataRowGap: Number.parseFloat(dataLayerStyle.rowGap),
      dataColumnGap: Number.parseFloat(dataLayerStyle.columnGap),
    };
  });
  expect(desktopMetrics.cardWidth).toBeCloseTo(138, 0);
  expect(desktopMetrics.cardHeight).toBeCloseTo(92, 0);
  expect(desktopMetrics.artworkWidth).toBeCloseTo(72, 0);
  expect(desktopMetrics.artworkHeight).toBeCloseTo(72, 0);
  expect(desktopMetrics.nameIconWidth).toBeCloseTo(14, 0);
  expect(desktopMetrics.nameIconHeight).toBeCloseTo(14, 0);
  expect(desktopMetrics.borderRadius).toBeCloseTo(12, 0);
  expect(desktopMetrics.directoryGap).toBeCloseTo(12, 0);
  expect(desktopMetrics.transform).toBe('none');
  expect(desktopMetrics.iconInsetTop).toBeCloseTo(14, 0);
  expect(desktopMetrics.iconInsetBottom).toBeCloseTo(14, 0);
  expect(desktopMetrics.dataPaddingTop).toBeCloseTo(7, 0);
  expect(desktopMetrics.dataPaddingRight).toBeCloseTo(9, 0);
  expect(desktopMetrics.dataPaddingBottom).toBeCloseTo(6, 0);
  expect(desktopMetrics.dataPaddingLeft).toBeCloseTo(9, 0);
  expect(desktopMetrics.dataRowGap).toBeCloseTo(2, 0);
  expect(desktopMetrics.dataColumnGap).toBeCloseTo(6, 0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => wheatTab.evaluate((element) => {
    const card = element as HTMLElement;
    const iconLayer = card.querySelector<HTMLElement>('.market-asset-card__icon-layer');
    const dataLayer = card.querySelector<HTMLElement>('.market-asset-card__data-layer');
    const artwork = iconLayer?.querySelector<HTMLElement>(':scope > .product-icon');
    if (!iconLayer || !dataLayer || !artwork) throw new Error('mobile market product artwork is missing');
    const cardRect = card.getBoundingClientRect();
    const artworkRect = artwork.getBoundingClientRect();
    const iconLayerStyle = getComputedStyle(iconLayer);
    const dataLayerStyle = getComputedStyle(dataLayer);
    return {
      cardWidth: Math.round(cardRect.width),
      cardHeight: Math.round(cardRect.height),
      artworkWidth: Math.round(artworkRect.width),
      artworkHeight: Math.round(artworkRect.height),
      iconInsetTop: Math.round(Number.parseFloat(iconLayerStyle.top)),
      iconInsetBottom: Math.round(Number.parseFloat(iconLayerStyle.bottom)),
      dataPaddingTop: Math.round(Number.parseFloat(dataLayerStyle.paddingTop)),
      dataPaddingRight: Math.round(Number.parseFloat(dataLayerStyle.paddingRight)),
      dataPaddingBottom: Math.round(Number.parseFloat(dataLayerStyle.paddingBottom)),
      dataPaddingLeft: Math.round(Number.parseFloat(dataLayerStyle.paddingLeft)),
      dataRowGap: Math.round(Number.parseFloat(dataLayerStyle.rowGap)),
      dataColumnGap: Math.round(Number.parseFloat(dataLayerStyle.columnGap)),
    };
  })).toEqual({
    cardWidth: 132,
    cardHeight: 88,
    artworkWidth: 56,
    artworkHeight: 56,
    iconInsetTop: 18,
    iconInsetBottom: 18,
    dataPaddingTop: 6,
    dataPaddingRight: 8,
    dataPaddingBottom: 6,
    dataPaddingLeft: 8,
    dataRowGap: 2,
    dataColumnGap: 5,
  });
  expect(pageErrors).toEqual([]);
});
