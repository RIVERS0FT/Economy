import { expect, test } from '@playwright/test';

const pages = [
  { navigation: /^概览/, heading: '概览' },
  { navigation: /^市场/, heading: '市场' },
  { navigation: /^建筑/, heading: '建筑' },
  { navigation: /^运输/, heading: '运输' },
  { navigation: /^研发/, heading: '研发' },
  { navigation: /^拍卖/, heading: '拍卖' },
  { navigation: /^合同/, heading: '合同' },
  { navigation: /^银行/, heading: '银行' },
  { navigation: /^排行/, heading: '排行榜' },
  { navigation: /^商店/, heading: '商店' },
  { navigation: /^设置/, heading: '设置' },
] as const;

async function clickMapProvinceLabel(page: import('@playwright/test').Page, provinceName: string) {
  const label = page.locator('.province-map-label').filter({ hasText: new RegExp(`^${provinceName}$`) });
  await expect(label).toBeVisible();
  const point = await label.evaluate((element) => {
    const x = Number(element.getAttribute('data-label-center-x'));
    const y = Number(element.getAttribute('data-label-center-y'));
    const matrix = element.ownerSVGElement?.getScreenCTM();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) {
      throw new Error('province label center transform is missing');
    }
    return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
  });
  await page.mouse.click(point.x, point.y);
}

async function openPersistentLayoutPreview(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');
  const workspace = page.locator('.workspace');
  const workspaceCard = page.locator('.signed-in-shell__primary-card');
  const outliner = page.locator('.strategic-outliner');
  await expect(workspaceCard).toHaveCount(1);
  await expect(workspaceCard.locator(':scope .desktop-sidebar')).toHaveCount(1);
  await expect(workspaceCard.locator(':scope .strategic-page-host')).toHaveCount(1);
  await expect(outliner).toBeVisible();
  await outliner.evaluate((element) => element.setAttribute('data-preview-outliner-sentinel', 'persistent'));
  return { sidebar, workspace, workspaceCard, outliner };
}

test('account-free mode redirects into the complete game shell without API traffic', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/economy-api')) apiRequests.push(request.url());
  });

  await page.goto('all-pages-preview.html');

  await expect(page).toHaveURL(/\/economy\/\?preview=game$/);
  await expect(page.locator('html')).toHaveAttribute('data-local-game-preview', 'true');
  await expect(page.locator('.game-shell')).toBeVisible();
  await expect(page.locator('.desktop-sidebar .sidebar-nav-button')).toHaveCount(10);
  await expect(page.locator('.desktop-sidebar .sidebar-footer').getByRole('button', { name: '设置' })).toHaveCount(1);
  await expect(page.locator('.desktop-sidebar').getByRole('button', { name: /^地图/ })).toHaveCount(0);
  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
  await expect(page.locator('[data-player-page-navigation="true"]')).toHaveCount(0);
  expect(apiRequests).toEqual([]);
});

test('account-free game shell navigates all eleven visible business pages and closes to the map', async ({ page }) => {
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');

  for (const target of pages) {
    const navigation = sidebar.getByRole('button', { name: target.navigation });
    await navigation.click();
    await expect(navigation).toHaveAttribute('aria-current', 'page');
    if ('heading' in target) {
      await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: '返回上一页面' })).toBeVisible();
    await expect(page.getByRole('button', { name: '关闭当前页面并显示地图' })).toBeVisible();
  }

  await expect(page.getByText('紧凑数字', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '状态刷新频率' })).toBeVisible();

  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
  await expect(page.locator('.province-map-page')).toHaveCount(1);
  await expect(page.locator('[data-player-page-navigation="true"]')).toHaveCount(0);
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  await clickMapProvinceLabel(page, '得克萨斯');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', 'US-TX');
  await expect(page.getByRole('heading', { level: 1, name: '得克萨斯' })).toBeVisible();
  await expect(page.locator('.province-overview-content')).toBeVisible();
  await expect(page.locator('.province-overview-panel')).toHaveCount(0);
  await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-presentation', 'building');
  const provinceTabs = page.getByRole('tablist', { name: '得克萨斯页面分区' });
  await expect(provinceTabs.getByRole('tab')).toHaveCount(5);
  await expect(provinceTabs.getByRole('tab', { name: '商业', exact: true })).toBeVisible();
  await expect(provinceTabs.getByRole('tab', { name: '工业', exact: true })).toBeVisible();
  await expect(page.getByText('当前经营地区', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
});

test('global market drills from commodity to regional quotes and existing trade detail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();

  const catalogFilters = page.locator('.global-market-filter-disclosure').first();
  expect(await catalogFilters.getAttribute('open')).toBeNull();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await page.getByRole('button', { name: '打开小麦全局详情' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '小麦' })).toBeVisible();
  await expect(page.locator('.global-market-product-region-list')).toBeVisible();

  const regionalRow = page.getByRole('button', { name: '打开加利福尼亚小麦详情' });
  await expect(regionalRow).toBeVisible();
  const regionalHeader = page.locator('.market-commodity-row-header');
  await expect(regionalHeader).toHaveCount(1);
  for (const label of ['地区', '今日价格', '24h成交量', '24h价格变化']) await expect(regionalHeader.getByText(label, { exact: true })).toBeVisible();
  for (const label of ['卖单量', '买单量', '今日价格', '24h成交量', '24h价格变化', '挂单差额', '基准偏离', '挂单状态']) await expect(regionalRow.getByText(label, { exact: true })).toHaveCount(0);
  const geometry = await regionalRow.evaluate((row) => ({ clientWidth: row.clientWidth, scrollWidth: row.scrollWidth }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);

  await regionalRow.click();
  await expect(page.locator('.regional-entity-title__name')).toHaveText('小麦');
  await expect(page.locator('.regional-entity-title__region')).toHaveText('加利福尼亚');
  await expect(page.locator('.market-trade-card')).toBeVisible();
  await page.getByRole('button', { name: '返回上一页面' }).click();
  await expect(page.locator('.global-market-product-region-list')).toBeVisible();
});

test('market and building entity lists share surface geometry with registered density exceptions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');

  const inspect = async (selector: string) => {
    const surface = page.locator(selector);
    await expect(surface).toBeVisible();
    await expect(surface.locator(':scope > .entity-list-header')).toBeVisible();
    await expect(surface.locator(':scope > .entity-list-rows .entity-list-row').first()).toBeVisible();
    return surface.evaluate((element) => {
      const header = element.querySelector<HTMLElement>(':scope > .entity-list-header');
      const rows = element.querySelector<HTMLElement>(':scope > .entity-list-rows');
      const row = rows?.querySelector<HTMLElement>('.entity-list-row');
      const primary = row?.querySelector<HTMLElement>('strong');
      const chevron = row?.querySelector<HTMLElement>('.global-market-goods-row__chevron, .market-commodity-row__chevron, .global-facility-catalog-row__chevron, .global-facility-region-row__chevron') ?? null;
      if (!header || !rows || !row || !primary || !chevron) throw new Error('entity list fixture is incomplete');
      const surfaceStyle = getComputedStyle(element);
      const rowsStyle = getComputedStyle(rows);
      const rowStyle = getComputedStyle(row);
      const headerBox = header.getBoundingClientRect();
      const rowsBox = rows.getBoundingClientRect();
      return {
        surfaceGap: surfaceStyle.rowGap,
        rowsGap: rowsStyle.rowGap,
        headerToRows: Math.round((rowsBox.top - headerBox.bottom) * 100) / 100,
        columnGap: rowStyle.columnGap,
        paddingLeft: rowStyle.paddingLeft,
        paddingRight: rowStyle.paddingRight,
        paddingTop: rowStyle.paddingTop,
        paddingBottom: rowStyle.paddingBottom,
        borderRadius: rowStyle.borderRadius,
        minHeight: rowStyle.minHeight,
        fontSize: getComputedStyle(primary).fontSize,
        chevronColumn: rowStyle.getPropertyValue('--entity-list-chevron-column').trim(),
        chevronWidth: Math.round(chevron.getBoundingClientRect().width * 100) / 100,
      };
    });
  };

  await sidebar.getByRole('button', { name: /^市场/ }).click();
  const marketSamples = [await inspect('.global-market-goods-surface')];
  const marketArtworkSize = await page.locator('.global-market-goods-row__artwork > .product-artwork').first().evaluate(
    (element) => getComputedStyle(element).width,
  );
  await page.locator('.global-market-goods-row').first().click();
  marketSamples.push(await inspect('.global-market-product-region-surface'));

  await sidebar.getByRole('button', { name: /^建筑/ }).click();
  const hasOwnedFacilityRows = await page.locator('.global-facility-catalog-row').count() > 0;
  if (!hasOwnedFacilityRows) {
    // The generated preview may legitimately represent a player with no facilities.
    // Static verifiers lock the production wrappers; this local DOM fixture only lets
    // the browser compare the production CSS geometry without changing game state.
    await page.locator('.global-facility-catalog').evaluate((surface) => {
      surface.innerHTML = `
        <div class="entity-list-header global-facility-catalog-header">
          <span>工厂</span><span>平均利润／分钟</span><span>拥有</span><span></span>
        </div>
        <ul class="entity-list-rows global-facility-catalog-list">
          <li>
            <div class="entity-list-row global-facility-catalog-row">
              <svg class="global-facility-catalog-row__artwork"></svg>
              <button class="global-facility-catalog-row__open" type="button">
                <span class="global-facility-catalog-row__identity"><strong>测试工厂</strong></span>
                <strong class="entity-list-value global-facility-catalog-row__metric global-facility-catalog-row__profit is-positive">1</strong>
                <strong class="global-facility-catalog-row__metric">1</strong>
                <span class="global-facility-catalog-row__chevron"><svg class="game-icon"></svg></span>
              </button>
              <span class="global-facility-catalog-row__quick-controls">
                <span class="global-facility-catalog-row__quick-selector" data-quick-production="product"><span class="ui-rich-select" data-variant="production-config"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__visual"><span class="product-artwork"></span></span></button></span></span>
                <span class="global-facility-catalog-row__quick-selector" data-quick-production="method"><span class="ui-rich-select" data-variant="production-config"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__visual"><svg class="game-icon"></svg></span></button></span></span>
              </span>
            </div>
          </li>
        </ul>`;
    });
    await page.locator('.global-buildings-page').evaluate((container) => {
      const surface = document.createElement('section');
      surface.className = 'entity-list-surface global-facility-region-surface';
      surface.dataset.browserGeometryFixture = 'true';
      surface.innerHTML = `
        <div class="entity-list-header global-facility-region-header">
          <span>地区</span><span>利润／分钟</span><span>拥有</span><span>状态</span><span></span>
        </div>
        <ul class="entity-list-rows global-facility-region-list">
          <li>
            <div class="entity-list-row global-facility-region-row">
              <button class="global-facility-region-row__open" type="button">
                <span class="global-facility-region-row__identity"><strong>测试地区</strong></span>
                <strong class="entity-list-value global-facility-region-row__profit is-positive">1</strong>
                <strong class="global-facility-region-row__metric">1</strong>
                <strong class="global-facility-region-row__status">运行中</strong>
                <span class="global-facility-region-row__chevron"><svg class="game-icon"></svg></span>
              </button>
              <span class="global-facility-region-row__quick-controls">
                <span class="global-facility-region-row__quick-selector" data-quick-production="product"><span class="ui-rich-select" data-variant="production-config"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__visual"><span class="product-artwork"></span></span></button></span></span>
                <span class="global-facility-region-row__quick-selector" data-quick-production="method"><span class="ui-rich-select" data-variant="production-config"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__visual"><svg class="game-icon"></svg></span></button></span></span>
              </span>
            </div>
          </li>
        </ul>`;
      container.append(surface);
    });
  }
  const facilitySamples = [await inspect('.global-facility-catalog')];
  const facilityArtworkSize = await page.locator('.global-facility-catalog-row__artwork').first().evaluate(
    (element) => getComputedStyle(element).width,
  );
  expect(parseFloat(marketArtworkSize)).toBeLessThan(parseFloat(facilityArtworkSize));
  if (hasOwnedFacilityRows) await page.locator('.global-facility-catalog-row__open').first().click();
  facilitySamples.push(await inspect('.global-facility-region-surface'));

  const samples = [...marketSamples, ...facilitySamples];
  const densityKeys = new Set<keyof typeof samples[number]>(['paddingTop', 'paddingBottom']);
  for (const sample of facilitySamples) {
    expect(sample.paddingTop).toBe(sample.paddingBottom);
    expect(sample.paddingLeft).toBe(sample.paddingRight);
    expect(parseFloat(sample.paddingTop)).toBeLessThan(parseFloat(sample.paddingRight));
  }
  for (const key of Object.keys(samples[0]) as Array<keyof typeof samples[number]>) {
    if (key === 'minHeight') {
      expect(new Set(marketSamples.map((sample) => String(sample[key]))).size, 'minHeight should match inside commodity lists').toBe(1);
      expect(new Set(facilitySamples.map((sample) => String(sample[key]))).size, 'facility two-line heights should match').toBe(1);
      expect(String(marketSamples[0][key]), 'commodity density remains distinct from regional facilities').not.toBe(String(facilitySamples[1][key]));
      continue;
    }
    if (key === 'fontSize') {
      expect(new Set(marketSamples.map((sample) => String(sample[key]))).size, 'fontSize should match inside commodity lists').toBe(1);
      expect(new Set(facilitySamples.map((sample) => String(sample[key]))).size, 'fontSize should match inside facility two-line lists').toBe(1);
      expect(parseFloat(String(facilitySamples[0][key])), 'facility primary identity should be visually stronger than commodity rows').toBeGreaterThan(parseFloat(String(marketSamples[0][key])));
      continue;
    }
    if (key === 'borderRadius') {
      expect(new Set(marketSamples.map((sample) => String(sample[key]))).size, 'borderRadius should match inside commodity lists').toBe(1);
      expect(new Set(facilitySamples.map((sample) => String(sample[key]))).size, 'borderRadius should match inside facility object cards').toBe(1);
      expect(String(marketSamples[0][key]), 'facility object-card radius should remain distinct from commodity rows').not.toBe(String(facilitySamples[0][key]));
      continue;
    }
    if (densityKeys.has(key)) {
      expect(new Set(marketSamples.map((sample) => String(sample[key]))).size, `${key} should match inside commodity lists`).toBe(1);
      expect(new Set(facilitySamples.map((sample) => String(sample[key]))).size, `${key} should match inside facility two-line lists`).toBe(1);
      expect(String(marketSamples[0][key]), `${key} should keep the commodity density exception`).not.toBe(String(facilitySamples[0][key]));
      continue;
    }
    expect(new Set(samples.map((sample) => String(sample[key]))).size, `${key} should stay shared`).toBe(1);
  }
});

test('player page heading keeps SVG back, centered title, and SVG close in that order', async ({ page }) => {
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^概览/ }).click();

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const heading = page.locator('[data-player-page-navigation="true"]');
    const back = heading.getByRole('button', { name: '返回上一页面' });
    const close = heading.getByRole('button', { name: '关闭当前页面并显示地图' });
    await expect(heading).toBeVisible();
    await expect(back.locator('svg')).toHaveCount(1);
    await expect(close.locator('svg')).toHaveCount(1);
    await expect(back).toHaveText('');
    await expect(close).toHaveText('');

    const layout = await heading.evaluate((element) => {
      const children = [...element.children] as HTMLElement[];
      const rect = (target: HTMLElement) => {
        const box = target.getBoundingClientRect();
        return { left: box.left, top: box.top, width: box.width, height: box.height };
      };
      return {
        order: children.map((child) => (
          child.classList.contains('page-navigation-button--back')
            ? 'back'
            : child.classList.contains('page-heading-title')
              ? 'title'
              : child.classList.contains('page-navigation-button--close')
                ? 'close'
                : 'unknown'
        )),
        heading: rect(element),
        back: rect(children[0]),
        title: rect(children[1]),
        close: rect(children[2]),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        padding: [
          getComputedStyle(element).paddingTop,
          getComputedStyle(element).paddingRight,
          getComputedStyle(element).paddingBottom,
          getComputedStyle(element).paddingLeft,
        ],
      };
    });
    expect(layout.order).toEqual(['back', 'title', 'close']);
    expect(layout.back.width).toBeCloseTo(40, 0);
    expect(layout.back.height).toBeCloseTo(44, 0);
    expect(layout.close.width).toBeCloseTo(40, 0);
    expect(layout.close.height).toBeCloseTo(44, 0);
    expect(layout.title.left + layout.title.width / 2).toBeCloseTo(
      layout.heading.left + layout.heading.width / 2,
      0,
    );
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    expect(new Set(layout.padding).size).toBe(1);
  }
});

test('province, overview, market, buildings, transport, and settings share a one-third card width with one persistent strategic outliner', async ({ page }) => {
  const { sidebar, workspaceCard, outliner } = await openPersistentLayoutPreview(page);
  const compactWidths: number[] = [];
  const compactCardWidths: number[] = [];

  await clickMapProvinceLabel(page, '得克萨斯');
  const provinceHost = page.locator('.strategic-page-host');
  const provinceContent = provinceHost.locator(':scope > .page-content:not(.page-loading)');
  await expect(provinceHost).toHaveAttribute('data-strategic-presentation', 'building');
  await expect(provinceHost.locator(':scope > .page-loading')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: '得克萨斯' })).toBeVisible();
  await expect(provinceContent).toBeVisible();
  await expect(outliner).toHaveAttribute('data-preview-outliner-sentinel', 'persistent');
  const provinceContentBox = await provinceContent.boundingBox();
  const provinceCardBox = await workspaceCard.boundingBox();
  expect(provinceContentBox).not.toBeNull();
  expect(provinceCardBox).not.toBeNull();
  compactWidths.push(provinceContentBox!.width);
  compactCardWidths.push(provinceCardBox!.width);

  for (const label of ['概览', '市场', '建筑', '运输', '设置']) {
    const button = label === '设置'
      ? sidebar.locator('.sidebar-footer').getByRole('button', { name: '设置', exact: true })
      : sidebar.getByRole('button', { name: new RegExp(`^${label}`) });
    await button.click();
    const host = page.locator('.strategic-page-host');
    await expect(host.locator(':scope > .page-loading')).toHaveCount(0);
    const content = host.locator(':scope > .page-content:not(.page-loading)');
    await expect(host).toHaveAttribute('data-strategic-presentation', 'building');
    await expect(content).toBeVisible();
    await expect(outliner).toBeVisible();
    await expect(outliner).toHaveAttribute('data-preview-outliner-sentinel', 'persistent');
    await expect(content.locator('.strategic-outliner')).toHaveCount(0);
    const contentBox = await content.boundingBox();
    const cardBox = await workspaceCard.boundingBox();
    const outlinerBox = await outliner.boundingBox();
    expect(contentBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect(outlinerBox).not.toBeNull();
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(outlinerBox!.x - 8);
    compactWidths.push(contentBox!.width);
    compactCardWidths.push(cardBox!.width);
  }
  expect(Math.max(...compactWidths) - Math.min(...compactWidths)).toBeLessThanOrEqual(1);
  expect(Math.max(...compactCardWidths) - Math.min(...compactCardWidths)).toBeLessThanOrEqual(1);
  expect(compactCardWidths[0]).toBeLessThanOrEqual(1684 / 3);
  expect(compactCardWidths[0]).toBeCloseTo(1684 / 3, 0);
});

test('transport route picking keeps the persistent strategic outliner and compact page geometry', async ({ page }) => {
  const { sidebar, workspaceCard, outliner } = await openPersistentLayoutPreview(page);
  await sidebar.getByRole('button', { name: /^运输/ }).click();
  const host = page.locator('.strategic-page-host');
  await expect(host.locator(':scope > .page-loading')).toHaveCount(0);
  await expect(host).toHaveAttribute('data-strategic-presentation', 'building');
  const transportContent = page.locator('.transport-page-content');
  await expect(transportContent).toBeVisible();
  await expect(outliner).toBeVisible();
  await expect(outliner).toHaveAttribute('data-preview-outliner-sentinel', 'persistent');
  const cardBox = await workspaceCard.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cardBox!.width).toBeCloseTo(1684 / 3, 0);

  const transportHeader = page.locator('.page-fixed-header');
  const addRouteButton = transportContent.locator('.transport-page-footer').getByRole('button', { name: '增加路线', exact: true });
  await expect(transportHeader.getByRole('button')).toHaveCount(2);
  await expect(transportHeader.getByRole('button', { name: '增加路线', exact: true })).toHaveCount(0);
  await expect(addRouteButton).toBeVisible();
  const transportOverflow = await transportContent.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(transportOverflow.scrollWidth).toBeLessThanOrEqual(transportOverflow.clientWidth + 1);
  await addRouteButton.click();
  const transportMapPickingBar = page.locator('.transport-map-picking-bar');
  await expect(page.getByTestId('us-mainland-map')).toHaveAttribute('data-route-picking', 'true');
  await expect(transportMapPickingBar).toBeVisible();
  await expect(page.locator('.transport-route-draft-panel')).toHaveCount(0);
  await expect(outliner).toBeVisible();
  await expect(outliner).toHaveAttribute('data-preview-outliner-sentinel', 'persistent');
  await transportMapPickingBar.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByTestId('us-mainland-map')).toHaveAttribute('data-route-picking', 'false');
});

test('research, auction, contracts, bank, leaderboard, and shop stay full-area with one persistent strategic outliner', async ({ page }) => {
  const { sidebar, workspace, workspaceCard, outliner } = await openPersistentLayoutPreview(page);
  await sidebar.getByRole('button', { name: /^概览/ }).click();
  const compactHost = page.locator('.strategic-page-host');
  await expect(compactHost.locator(':scope > .page-loading')).toHaveCount(0);
  const compactContent = compactHost.locator(':scope > .page-content:not(.page-loading)');
  await expect(compactHost).toHaveAttribute('data-strategic-presentation', 'building');
  await expect(compactContent).toBeVisible();
  await expect(outliner).toBeVisible();
  await expect(outliner).toHaveAttribute('data-preview-outliner-sentinel', 'persistent');
  const compactContentBox = await compactContent.boundingBox();
  expect(compactContentBox).not.toBeNull();

  const fullAreaWidths = new Map<string, number>();
  for (const label of ['研发', '拍卖', '合同', '银行', '排行', '商店']) {
    await sidebar.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    const host = page.locator('.strategic-page-host');
    await expect(host.locator(':scope > .page-loading')).toHaveCount(0);
    const content = host.locator(':scope > .page-content:not(.page-loading)');
    await expect(host).toHaveAttribute('data-strategic-presentation', 'fullscreen');
    await expect(content).toBeVisible();
    await expect(outliner).toBeHidden();
    await expect(outliner).toHaveAttribute('data-preview-outliner-sentinel', 'persistent');
    const hostBox = await host.boundingBox();
    const contentBox = await content.boundingBox();
    const cardBox = await workspaceCard.boundingBox();
    const workspaceBox = await workspace.boundingBox();
    expect(hostBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    expect(contentBox!.width).toBeCloseTo(hostBox!.width, 0);
    expect(contentBox!.width).toBeGreaterThan(compactContentBox!.width + 200);
    expect(workspaceBox!.x + workspaceBox!.width - (cardBox!.x + cardBox!.width)).toBeCloseTo(8, 0);
    fullAreaWidths.set(label, contentBox!.width);
  }
  expect(fullAreaWidths.get('排行')).toBeCloseTo(fullAreaWidths.get('商店')!, 0);
});

test('page navigation unfolds only the active page while the persistent map keeps its instance and geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-map-ready', 'true');

  const before = await map.evaluate((element) => {
    (element as HTMLElement).dataset.transitionProbe = 'stable';
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  });
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();

  const reveal = page.locator('.signed-in-shell__page-reveal');
  await expect(reveal).toHaveAttribute('data-page-transition-key', 'tab:market');
  await expect(reveal).toHaveCSS('animation-name', 'strategic-page-unfold');
  await expect(map).toHaveAttribute('data-transition-probe', 'stable');
  const after = await map.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  });
  expect(after).toEqual(before);
});

test('reduced motion disables card width and page unfold animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();

  const transitionDurationSeconds = await page.locator('.signed-in-shell__primary-card').evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).transitionDuration),
  );
  expect(transitionDurationSeconds).toBeLessThanOrEqual(0.001);
  await expect(page.locator('.signed-in-shell__page-reveal')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.strategic-map-stage')).toHaveCSS('transform', 'none');
});

test('player page return follows history while close clears the stack to map', async ({ page }) => {
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');

  await sidebar.getByRole('button', { name: /^市场/ }).click();
  await sidebar.getByRole('button', { name: /^建筑/ }).click();
  const returnButton = page.getByRole('button', { name: '返回上一页面' });
  await returnButton.focus();
  await expect(returnButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: '市场' })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /^市场/ })).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
  await expect(page.locator('[data-player-page-navigation="true"]')).toHaveCount(0);
  await sidebar.getByRole('button', { name: /^银行/ }).click();
  await returnButton.focus();
  await expect(returnButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
  await expect(page.locator('[data-player-page-navigation="true"]')).toHaveCount(0);
});

test('leaderboard and local-only service summaries are populated in the full shell', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');

  await sidebar.getByRole('button', { name: /^排行/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '排行榜' })).toBeVisible();
  const leaderboardSwitch = page.locator('.leaderboard-board-switch');
  const leaderboardLayout = page.locator('.leaderboard-responsive-layout');
  await expect(leaderboardSwitch.locator('button')).toHaveCount(4);
  await expect(leaderboardLayout).toBeVisible();
  expect(await leaderboardLayout.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(72 * 16);
  await expect(leaderboardSwitch).toBeHidden();
  await expect(page.locator('.leaderboard-board-card:visible')).toHaveCount(4);
  const wealthCard = page.locator('[data-leaderboard-board="wealth"] .leaderboard-board-card');
  await expect(wealthCard.getByText('本地预览玩家', { exact: true })).toBeVisible();
  await expect(wealthCard.locator('.leaderboard-board-heading p')).toHaveCount(0);
  await expect(wealthCard.locator('.leaderboard-board-heading .ui-status-tag')).toHaveCount(0);
  await expect(wealthCard.locator('.leaderboard-column-labels span')).toHaveText(['排名', '玩家', '成绩', '奖励']);
  const wealthRow = wealthCard.locator('.leaderboard-row').first();
  await expect(wealthRow.locator('.leaderboard-avatar')).toHaveCount(1);
  await expect(wealthRow.locator('.leaderboard-reward')).toHaveText('—');
  const rowCenterSpread = await wealthRow.evaluate((element) => {
    const centers = [...element.children].map((child) => {
      const box = child.getBoundingClientRect();
      return box.top + box.height / 2;
    });
    return Math.max(...centers) - Math.min(...centers);
  });
  expect(rowCenterSpread).toBeLessThanOrEqual(2);

  for (const viewport of [{ width: 900, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(leaderboardSwitch).toBeVisible();
    await expect(leaderboardSwitch).toHaveAttribute('role', 'group');
    await expect(leaderboardSwitch).toHaveAttribute('aria-label', '选择排行榜');
    await expect(page.locator('.leaderboard-board-card:visible')).toHaveCount(1);
    const switchGeometry = await leaderboardSwitch.evaluate((element) => {
      const buttons = [...element.querySelectorAll<HTMLElement>('button')].map((button) => button.getBoundingClientRect());
      return {
        rowSpread: Math.max(...buttons.map((button) => button.top)) - Math.min(...buttons.map((button) => button.top)),
        hasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      };
    });
    expect(switchGeometry.rowSpread).toBeLessThanOrEqual(1);
    expect(switchGeometry.hasHorizontalOverflow).toBe(false);
  }
  await page.setViewportSize({ width: 900, height: 900 });
  await leaderboardSwitch.getByRole('button', { name: '增长榜', exact: true }).click();
  await expect(leaderboardSwitch.getByRole('button', { name: '增长榜', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.leaderboard-board-card:visible')).toHaveCount(1);
  await expect(page.locator('[data-leaderboard-board="growth"] .leaderboard-board-card')).toBeVisible();

  await sidebar.getByRole('button', { name: /^商店/ }).click();
  await expect(page.getByText('1 宝石 = 1,280.00 货币', { exact: true })).toBeVisible();
  await expect(page.getByLabel('永久邀请码')).toHaveValue('LOCAL2026');
});