import { expect, test, type Locator, type Page } from '@playwright/test';

async function capturePageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
  return pageErrors;
}

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function selectRichOption(page: Page, label: string, optionName: string) {
  const combobox = page.getByRole('combobox', { name: label });
  await combobox.click();
  await page.getByRole('listbox', { name: label })
    .getByRole('option', { name: optionName, exact: true })
    .click();
  await expect(combobox).toContainText(optionName);
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

test('market desktop layout keeps market context and chart above the combined trade card in the compact page', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  await expect(page.locator('.regional-entity-title__name')).toHaveText('小麦');
  await expect(page.locator('.regional-entity-title__region')).toHaveText('加利福尼亚州');
  await expect(page.locator('.market-catalog-panel')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '商品列表', exact: true })).toHaveCount(0);
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
  expect(tradeBox.y).toBeGreaterThan(chartCardBox.y + chartCardBox.height - 2);
  expect(Math.abs(chartCardBox.x - tradeBox.x)).toBeLessThan(3);
  expect(Math.abs(chartCardBox.width - tradeBox.width)).toBeLessThan(3);
  expect(Math.abs(orderBox.y - bookBox.y)).toBeLessThan(3);
  expect(bookBox.x).toBeGreaterThan(orderBox.x + orderBox.width - 3);
  expect(orderBox.x).toBeGreaterThanOrEqual(tradeBox.x - 1);
  expect(bookBox.x + bookBox.width).toBeLessThanOrEqual(tradeBox.x + tradeBox.width + 1);
  expect(chartBox.width).toBeGreaterThanOrEqual(chartCardBox.width - 36);
  expect(chartBox.width).toBeLessThanOrEqual(chartCardBox.width);
  await expect(chart).toHaveAttribute('data-chart-fill-mode', 'natural');
  expect(chartBox.y + chartBox.height).toBeGreaterThan(chartCardBox.y + chartCardBox.height - 28);
  await expect(tradeCard.getByRole('heading', { name: /交易$/ })).toBeVisible();
  await expect(tradeCard.getByRole('heading', { name: '下单', exact: true })).toBeVisible();
  await expect(tradeCard.getByRole('heading', { name: '订单簿', exact: true })).toBeVisible();
  await expect(tradeCard.locator('.order-book-columns')).toHaveCount(0);
  await expect(tradeCard.locator('.order-book-midpoint')).toHaveCount(0);
  await expect(tradeCard.locator('.market-trade-summary')).toContainText(/最近成交.*24h 变化.*24h 成交量/);
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
  await chart.scrollIntoViewIfNeeded();
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
  const tooltip = chart.locator('.economy-chart-tooltip');

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
  expect(tradeBox.y).toBeGreaterThan(chartBox.y + chartBox.height - 2);
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
  await expect.poll(async () => {
    const trade = await tradeCard.boundingBox();
    const chart = await page.locator('.market-chart-card').boundingBox();
    if (!trade || !chart) return -Infinity;
    return trade.y - (chart.y + chart.height);
  }).toBeGreaterThanOrEqual(-1);
  const narrowOrder = await requireBox(orderEntry);
  const narrowBook = await requireBox(orderBook);
  expect(Math.abs(narrowOrder.y - narrowBook.y)).toBeLessThan(3);
  expect(narrowBook.x).toBeGreaterThan(narrowOrder.x + narrowOrder.width - 3);
  expect(narrowOrder.width / narrowBook.width).toBeGreaterThan(1.4);
  expect(narrowOrder.width / narrowBook.width).toBeLessThan(1.7);

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
  await surface.evaluate((element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.style.width = '';
    htmlElement.style.maxWidth = '';
  });
  await expect(orderEntry).toBeVisible();
  await expect(orderBook).toBeVisible();
  const mobileOrder = await requireBox(orderEntry);
  const mobileBook = await requireBox(orderBook);
  expect(Math.abs(mobileOrder.y - mobileBook.y)).toBeLessThan(3);
  expect(mobileBook.x).toBeGreaterThan(mobileOrder.x + mobileOrder.width - 3);
  await expect(page.getByRole('button', { name: '挂单', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '成交', exact: true })).toHaveCount(0);
  const accountSections = page.locator('.market-account-grid > section');
  await expect(accountSections).toHaveCount(2);
  await expect(accountSections.nth(0)).toContainText('已有订单');
  await expect(accountSections.nth(1)).toContainText('本地成交');
  const ordersBox = await requireBox(accountSections.nth(0));
  const tradesBox = await requireBox(accountSections.nth(1));
  expect(tradesBox.y).toBeGreaterThan(ordersBox.y + ordersBox.height - 2);

  const mobileAxis = await inspectChartAxis(page.locator('.market-history-chart.full'));
  for (const label of mobileAxis.allLabels) {
    expect(label.left, `移动端 ${label.text} 不得越出图表左侧`).toBeGreaterThanOrEqual(-1);
    expect(label.right, `移动端 ${label.text} 不得越出图表右侧`).toBeLessThanOrEqual(mobileAxis.width + 1);
  }

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.getByRole('button', { name: '下单', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '盘口', exact: true })).toHaveCount(0);
  await expect(orderEntry).toBeVisible();
  await expect(orderBook).toBeVisible();
  await expect(orderBook.locator('.order-book-columns')).toHaveCount(0);
  await expect(orderBook.locator('.order-book-midpoint')).toHaveCount(0);
  const compactOrder = await requireBox(orderEntry);
  const compactBook = await requireBox(orderBook);
  expect(Math.abs(compactOrder.y - compactBook.y)).toBeLessThan(3);
  expect(compactBook.x).toBeGreaterThan(compactOrder.x + compactOrder.width - 3);
  const compactLayout = await inspectMarketLayoutBounds(surface);
  expect(compactLayout.pageScrollScrollWidth).toBeLessThanOrEqual(compactLayout.pageScrollClientWidth + 1);
  expect(compactLayout.directChildren.every((child) => child.left >= -1 && child.right <= compactLayout.surfaceWidth + 1)).toBe(true);

  const firstAsk = orderBook.locator('.book-order-row.ask').first();
  const firstAskLabel = await firstAsk.getAttribute('aria-label');
  const priceMatch = firstAskLabel?.match(/价格 ([\d,.]+)/);
  expect(priceMatch).not.toBeNull();
  const expectedPrice = Number(priceMatch![1].replaceAll(',', ''));
  await firstAsk.click();
  await expect.poll(async () => Number(await page.getByRole('textbox', { name: '价格', exact: true }).inputValue())).toBe(expectedPrice);
  expect(await firstAsk.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(43);
  expect(pageErrors).toEqual([]);
});

test('market trend uses neutral semantics for zero', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=zero-trend');

  const trend = page.locator('.market-chart-card .market-trend-tag');
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
  await expect(page.getByRole('spinbutton', { name: '数量' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '资金不足，无法买入小麦' })).toBeDisabled();
  await expect(page.getByText('当前没有可出售的', { exact: false })).toHaveCount(0);

  await page.goto('market-runtime-test.html?scenario=sell-empty');
  await expect(page.getByRole('button', { name: '暂无小麦可卖' })).toBeDisabled();
  await expect(page.getByText('当前没有可出售的', { exact: false })).toHaveCount(0);
  await expect(page.getByText('当前最多可卖', { exact: false })).toHaveCount(0);

  await page.goto('market-runtime-test.html?scenario=active');
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: '数量' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '买入小麦' })).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test('market steppers and compact quick quantities preserve price and quantity limits', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const priceInput = page.getByRole('textbox', { name: '价格', exact: true });
  const quantityInput = page.getByRole('spinbutton', { name: '数量' });
  await expect(priceInput).toHaveValue('2');
  await page.getByRole('button', { name: '价格增加 0.01' }).click();
  await expect(priceInput).toHaveValue('2.01');
  await page.getByRole('button', { name: '价格减少 0.01' }).click();
  await expect(priceInput).toHaveValue('2');
  await page.getByRole('button', { name: '数量增加 1' }).click();
  await expect(quantityInput).toHaveValue('2');
  await page.getByRole('button', { name: '数量减少 1' }).click();
  await expect(quantityInput).toHaveValue('1');

  await expect(page.getByRole('button', { name: '填写四分之一可交易数量' })).toBeVisible();
  await expect(page.getByRole('button', { name: '填写二分之一可交易数量' })).toBeVisible();
  await expect(page.getByRole('button', { name: '填写最大可交易数量' })).toBeVisible();
  await expect(page.getByText('当前价格下最多可买 500。', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '填写最大可交易数量' }).click();
  await expect(quantityInput).toHaveValue('500');
  await quantityInput.fill('501');
  await expect(page.getByRole('alert')).toHaveText('当前价格下最多可买 500。');
  await expect(page.getByText('当前价格下最多可买 500。', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '买入小麦' })).toBeDisabled();

  await page.getByRole('button', { name: '卖出', exact: true }).click();
  await page.getByRole('button', { name: '填写最大可交易数量' }).click();
  await expect(quantityInput).toHaveValue('8');
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('market commodity catalog keeps compact core metrics and opens a focused detail', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active&view=catalog');

  await expect(page.getByRole('heading', { name: '加利福尼亚州市场', exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  const filters = page.locator('.market-catalog-filter-disclosure');
  expect(await filters.getAttribute('open')).toBeNull();
  await filters.locator('summary').click();
  await selectRichOption(page, '分类', '原材料');
  await selectRichOption(page, '市场状态', '有真实成交');

  const wheatRow = page.getByRole('button', { name: '查看小麦详情' });
  await expect(wheatRow).toBeVisible();
  await expect(wheatRow.locator('.product-artwork')).toHaveAttribute('data-product-artwork', 'wheat');
  await expect(wheatRow.locator('.market-commodity-row__name strong')).toHaveText('小麦');
  await expect(wheatRow.locator('.market-commodity-row__name small')).toHaveText('原材料');
  const catalogHeader = page.locator('.market-commodity-row-header');
  await expect(catalogHeader).toHaveCount(1);
  for (const label of ['商品', '卖单量', '买单量', '24h成交量', '市场价', '24h价格变化']) {
    await expect(catalogHeader.getByText(label, { exact: true })).toBeVisible();
  }
  const priceSortButton = catalogHeader.getByRole('button', { name: '市场价' });
  await priceSortButton.click();
  await expect(catalogHeader.locator('[aria-sort="descending"]')).toHaveText('市场价');
  await priceSortButton.click();
  await expect(catalogHeader.locator('[aria-sort="ascending"]')).toHaveText('市场价');
  await priceSortButton.click();
  await expect(catalogHeader.locator('[aria-sort="ascending"], [aria-sort="descending"]')).toHaveCount(0);
  for (const label of ['卖单量', '买单量', '24h成交量', '市场价', '24h价格变化', '挂单差额', '基准偏离', '挂单状态']) {
    await expect(wheatRow.getByText(label, { exact: true })).toHaveCount(0);
  }
  await wheatRow.click();

  await expect(page.locator('.regional-entity-title__name')).toHaveText('小麦');
  await expect(page.locator('.regional-entity-title__region')).toHaveText('加利福尼亚州');
  await expect(page.getByRole('heading', { name: '商品基本面', exact: true })).toBeVisible();
  await expect(page.getByText('基准偏离', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('挂单差额', { exact: true })).toBeVisible();
  await expect(page.locator('.market-trade-card')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('market commodity detail owns fixed auto-trade and catalog has no workspace switch', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active&view=catalog');

  await expect(page.getByRole('button', { name: '工厂', exact: true })).toHaveCount(0);
  await expect(page.locator('.market-catalog-list .facility-icon')).toHaveCount(0);
  await expect(page.locator('.market-workspace-switch')).toHaveCount(0);
  await expect(page.locator('.market-overview-metrics')).toHaveCount(0);
  await expect(page.locator('.market-catalog-panel')).toHaveCount(0);
  expect(await page.locator('.market-catalog-list .product-artwork').count()).toBeGreaterThan(0);

  await page.getByRole('button', { name: '查看小麦详情' }).click();
  await expect(page.locator('.market-auto-trade-workspace--fixed')).toBeVisible();
  await expect(page.locator('.market-auto-trade-card')).toBeVisible();
  await expect(page.getByRole('combobox', { name: '自动交易商品' })).toHaveCount(0);
  await expect(page.locator('.market-auto-trade-products')).toHaveCount(0);
  await expect(page.locator('.market-auto-trade-card')).toContainText('小麦 · 自动交易');
  await expect(page.locator('.market-auto-trade-card').getByLabel('目标自由库存')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('market detail back action restores the filtered catalog', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active&view=catalog');

  const filters = page.locator('.market-catalog-filter-disclosure');
  expect(await filters.getAttribute('open')).toBeNull();
  await filters.locator('summary').click();
  await selectRichOption(page, '分类', '原材料');
  await selectRichOption(page, '市场状态', '有真实成交');
  const catalogHeader = page.locator('.market-commodity-row-header');
  await catalogHeader.getByRole('button', { name: '市场价' }).click();
  await page.getByRole('button', { name: '查看小麦详情' }).click();
  await page.getByRole('button', { name: '返回商品列表' }).click();

  await filters.locator('summary').click();
  await expect(page.getByRole('combobox', { name: '分类' })).toContainText('原材料');
  await expect(page.getByRole('combobox', { name: '市场状态' })).toContainText('有真实成交');
  await expect(page.locator('.market-commodity-row-header [aria-sort="descending"]')).toHaveText('市场价');
  await expect(page.getByRole('button', { name: '查看小麦详情' })).toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('mobile market catalog keeps one compact row without horizontal overflow', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active&view=catalog');

  const wheatRow = page.getByRole('button', { name: '查看小麦详情' });
  await expect(wheatRow).toBeVisible();
  const inspect = () => page.locator('.market-catalog-surface').evaluate((panel) => {
    const row = panel.querySelector<HTMLElement>('.market-commodity-row');
    const identity = row?.querySelector<HTMLElement>('.market-commodity-row__identity');
    const metrics = row ? [...row.querySelectorAll<HTMLElement>('.market-commodity-row__metric')] : [];
    if (!row || !identity || metrics.length !== 5) throw new Error('mobile market catalog fixture is incomplete');
    const identityRect = identity.getBoundingClientRect();
    return {
      panelClientWidth: panel.clientWidth,
      panelScrollWidth: panel.scrollWidth,
      rowClientWidth: row.clientWidth,
      rowScrollWidth: row.scrollWidth,
      rowColumns: getComputedStyle(row).gridTemplateColumns.split(' ').filter(Boolean).length,
      identityCenter: identityRect.top + identityRect.height / 2,
      metricCenters: metrics.map((metric) => {
        const rect = metric.getBoundingClientRect();
        return rect.top + rect.height / 2;
      }),
    };
  });
  let layout = await inspect();
  expect(layout.panelScrollWidth).toBeLessThanOrEqual(layout.panelClientWidth + 1);
  expect(layout.rowScrollWidth).toBeLessThanOrEqual(layout.rowClientWidth + 1);
  expect(layout.rowColumns).toBe(7);
  for (const center of layout.metricCenters) expect(Math.abs(center - layout.identityCenter)).toBeLessThan(6);
  const catalogHeader = page.locator('.market-commodity-row-header');
  await expect(catalogHeader).toHaveCount(1);
  for (const label of ['商品', '卖单量', '买单量', '24h成交量', '市场价', '24h价格变化']) await expect(catalogHeader.getByText(label, { exact: true })).toBeVisible();
  for (const label of ['卖单量', '买单量', '24h成交量', '市场价', '24h价格变化', '挂单差额', '基准偏离', '挂单状态']) await expect(wheatRow.getByText(label, { exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 720 });
  layout = await inspect();
  expect(layout.panelScrollWidth).toBeLessThanOrEqual(layout.panelClientWidth + 1);
  expect(layout.rowScrollWidth).toBeLessThanOrEqual(layout.rowClientWidth + 1);
  expect(layout.rowColumns).toBe(7);
  expect(pageErrors).toEqual([]);
});

test('market order book keeps sell five to buy five sequence and fills price without submitting', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  const askRow = page.locator('.book-order-row.ask').first();
  const bidRow = page.locator('.book-order-row.bid').first();
  const askBox = await requireBox(askRow);
  const bidBox = await requireBox(bidRow);
  expect(askBox.y).toBeLessThan(bidBox.y);
  await expect(page.locator('.order-book-columns')).toHaveCount(0);
  await expect(page.locator('.order-book-midpoint')).toHaveCount(0);
  await expect(askRow.locator('.market-book-level')).toHaveText('卖1');
  await expect(bidRow.locator('.market-book-level')).toHaveText('买1');

  const priceInput = page.getByRole('textbox', { name: '价格', exact: true });
  await expect(priceInput).toHaveValue('2');
  await askRow.click();
  await expect(priceInput).toHaveValue('13');
  await expect(page.getByRole('button', { name: '买入小麦' })).toBeEnabled();

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

  await expect(page.locator('.order-book-columns')).toHaveCount(0);
  await expect(page.locator('.order-book-midpoint')).toHaveCount(0);

  const askLevels = page.locator('.book-order-row.ask');
  const bidLevels = page.locator('.book-order-row.bid');
  await expect(askLevels).toHaveCount(1);
  await expect(bidLevels).toHaveCount(1);
  await expect(askLevels).toHaveAttribute('data-order-count', '2');
  await expect(bidLevels).toHaveAttribute('data-order-count', '5');
  await expect(askLevels).toHaveAttribute('aria-label', '卖1，价格 13.00，合计剩余 4，点击填入价格');
  await expect(bidLevels).toHaveAttribute('aria-label', '买1，价格 2.00，合计剩余 5，点击填入价格');
  expect(pageErrors).toEqual([]);
});

test('market product artwork keeps compact catalog and detail slots without stretching', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active&view=catalog');

  const wheatRow = page.getByRole('button', { name: '查看小麦详情' });
  const catalogMetrics = await wheatRow.evaluate((element) => {
    const slot = element.querySelector<HTMLElement>('.market-commodity-row__artwork');
    const artwork = slot?.querySelector<HTMLElement>('.product-artwork');
    if (!slot || !artwork) throw new Error('market product catalog artwork is missing');
    const surface = element.closest<HTMLElement>('.market-page-surface');
    return {
      surfaceWidth: Math.round(surface?.getBoundingClientRect().width ?? 0),
      slot: [Math.round(slot.getBoundingClientRect().width), Math.round(slot.getBoundingClientRect().height)],
      artwork: [Math.round(artwork.getBoundingClientRect().width), Math.round(artwork.getBoundingClientRect().height)],
      backgroundSize: getComputedStyle(artwork).backgroundSize,
    };
  });
  const compactCatalog = catalogMetrics.surfaceWidth <= 620;
  expect(catalogMetrics.slot).toEqual(compactCatalog ? [34, 34] : [42, 42]);
  expect(catalogMetrics.artwork).toEqual(compactCatalog ? [29, 29] : [34, 34]);
  expect(catalogMetrics.backgroundSize).toBe('contain');

  await wheatRow.click();
  const detailMetrics = await page.locator('.market-detail-hero__artwork').evaluate((slot) => {
    const artwork = slot.querySelector<HTMLElement>('.product-artwork');
    if (!artwork) throw new Error('market product detail artwork is missing');
    return {
      slot: [Math.round(slot.getBoundingClientRect().width), Math.round(slot.getBoundingClientRect().height)],
      artwork: [Math.round(artwork.getBoundingClientRect().width), Math.round(artwork.getBoundingClientRect().height)],
    };
  });
  expect(detailMetrics).toEqual({ slot: [76, 76], artwork: [58, 58] });

  await page.getByRole('button', { name: '返回商品列表' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => wheatRow.evaluate((element) => {
    const slot = element.querySelector<HTMLElement>('.market-commodity-row__artwork');
    const artwork = slot?.querySelector<HTMLElement>('.product-artwork');
    if (!slot || !artwork) throw new Error('mobile market product catalog artwork is missing');
    return [Math.round(slot.getBoundingClientRect().width), Math.round(artwork.getBoundingClientRect().width)];
  })).toEqual([34, 29]);
  await wheatRow.click();
  await expect.poll(() => page.locator('.market-detail-hero__artwork > .product-artwork').evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(50);
  expect(pageErrors).toEqual([]);
});
