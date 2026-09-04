import { expect, test } from '@playwright/test';

async function ensureFacilityCatalogFixture(page: import('@playwright/test').Page) {
  const existingRows = page.locator('.global-facility-catalog-row');
  if (await existingRows.count()) return;

  await page.locator('.global-facility-catalog').evaluate((surface) => {
    surface.innerHTML = `
      <div class="entity-list-header global-facility-catalog-header">
        <span class="entity-list-header__cell">建筑</span>
        <span class="entity-list-header__cell">利润</span>
        <span class="entity-list-header__cell">拥有</span>
        <span class="entity-list-header__cell"></span>
      </div>
      <ul class="entity-list-rows global-facility-catalog-list">
        ${[1, 2].map((index) => `
        <li>
          <div class="entity-list-row global-facility-catalog-row">
            <svg class="global-facility-catalog-row__artwork"></svg>
            <button class="global-facility-catalog-row__open" type="button">
              <span class="global-facility-catalog-row__identity"><strong>测试工厂${index}</strong></span>
              <strong class="entity-list-value global-facility-catalog-row__metric global-facility-catalog-row__profit is-positive">1</strong>
              <strong class="global-facility-catalog-row__metric">1</strong>
              <span class="global-facility-catalog-row__chevron"><svg class="game-icon"></svg></span>
            </button>
            <span class="global-facility-catalog-row__quick-controls">
              <span class="global-facility-catalog-row__quick-selector" data-quick-production="product"><span class="ui-rich-select" data-variant="production-config"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__visual"><span class="product-artwork"></span></span></button></span></span>
              <span class="global-facility-catalog-row__quick-selector" data-quick-production="method"><span class="ui-rich-select" data-variant="production-config"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__visual"><svg class="game-icon"></svg></span></button></span></span>
            </span>
          </div>
        </li>`).join('')}
      </ul>`;
  });
}

async function ensureFacilityRegionFixture(page: import('@playwright/test').Page) {
  if (await page.locator('.global-facility-region-row').count()) return;

  await page.locator('body').evaluate((body) => {
    const fixture = document.createElement('div');
    fixture.className = 'global-operation-page global-facility-region-fixture';
    fixture.innerHTML = `
      <section class="entity-list-surface global-facility-region-page">
        <div class="entity-list-header global-facility-region-header">
          <span class="entity-list-header__cell">地区</span>
          <span class="entity-list-header__cell">利润</span>
          <span class="entity-list-header__cell">拥有</span>
          <span class="entity-list-header__cell">状态</span>
          <span class="entity-list-header__cell"></span>
        </div>
        <ul class="entity-list-rows global-facility-region-list">
          <li>
            <div class="entity-list-row global-facility-region-row">
              <button class="global-facility-region-row__open" type="button">
                <span class="global-facility-region-row__identity"><strong>测试地区</strong></span>
                <strong class="entity-list-value global-facility-region-row__profit is-positive">1</strong>
                <strong class="global-facility-region-row__metric">1</strong>
                <span class="global-facility-region-row__status">运行中</span>
                <span class="global-facility-region-row__chevron"><svg class="game-icon"></svg></span>
              </button>
              <span class="global-facility-region-row__quick-controls">
                <span class="global-facility-region-row__quick-selector" data-quick-production="product"><span class="ui-rich-select" data-variant="production-config"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__visual"><span class="product-artwork"></span></span></button></span></span>
                <span class="global-facility-region-row__quick-selector" data-quick-production="method"><span class="ui-rich-select" data-variant="production-config"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__visual"><svg class="game-icon"></svg></span></button></span></span>
              </span>
            </div>
          </li>
        </ul>
      </section>`;
    body.appendChild(fixture);
  });
}

async function inspectFacilityRow(page: import('@playwright/test').Page) {
  const row = page.locator('.global-facility-catalog-row').first();
  await expect(row).toBeVisible();
  return row.evaluate((element) => {
    const list = element.closest<HTMLElement>('.global-facility-catalog-list');
    const header = document.querySelector<HTMLElement>('.global-facility-catalog-header');
    const artwork = element.querySelector<HTMLElement>('.global-facility-catalog-row__artwork');
    const open = element.querySelector<HTMLElement>('.global-facility-catalog-row__open');
    const quick = element.querySelector<HTMLElement>('.global-facility-catalog-row__quick-controls');
    const name = element.querySelector<HTMLElement>('.global-facility-catalog-row__identity > strong');
    const profit = element.querySelector<HTMLElement>('.global-facility-catalog-row__profit');
    const count = element.querySelector<HTMLElement>('.global-facility-catalog-row__metric:not(.global-facility-catalog-row__profit)');
    const productionTrigger = element.querySelector<HTMLElement>(".global-facility-catalog-row__quick-selector .ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger");
    if (!list || !header || !artwork || !open || !quick || !name || !profit || !count || !productionTrigger) {
      throw new Error('facility catalog layout fixture is incomplete');
    }

    const listStyle = getComputedStyle(list);
    const headerStyle = getComputedStyle(header);
    const artworkStyle = getComputedStyle(artwork);
    const openStyle = getComputedStyle(open);
    const quickStyle = getComputedStyle(quick);
    const rowStyle = getComputedStyle(element);
    const nameStyle = getComputedStyle(name);
    const profitStyle = getComputedStyle(profit);
    const countStyle = getComputedStyle(count);
    const productionTriggerStyle = getComputedStyle(productionTrigger);
    const artworkBox = artwork.getBoundingClientRect();
    const openBox = open.getBoundingClientRect();
    const quickBox = quick.getBoundingClientRect();
    const rowBox = element.getBoundingClientRect();
    const profitBox = profit.getBoundingClientRect();

    return {
      listGap: Number.parseFloat(listStyle.rowGap || listStyle.gap || '0'),
      rowClientWidth: element.clientWidth,
      rowScrollWidth: element.scrollWidth,
      rowHeight: rowBox.height,
      rowColumns: rowStyle.gridTemplateColumns,
      rowBorderTop: rowStyle.borderTopWidth,
      rowBorderBottom: rowStyle.borderBottomWidth,
      rowBorderRadius: rowStyle.borderRadius,
      rowBackground: rowStyle.backgroundColor,
      rowBackgroundImage: rowStyle.backgroundImage,
      rowBoxShadow: rowStyle.boxShadow,
      rowPaddingTop: Number.parseFloat(rowStyle.paddingTop),
      rowPaddingBottom: Number.parseFloat(rowStyle.paddingBottom),
      rowPaddingLeft: Number.parseFloat(rowStyle.paddingLeft),
      rowPaddingRight: Number.parseFloat(rowStyle.paddingRight),
      headerBorderBottom: headerStyle.borderBottomWidth,
      artworkPosition: artworkStyle.position,
      artworkTransform: artworkStyle.transform,
      artworkGridColumn: artworkStyle.gridColumnStart,
      artworkGridRowStart: artworkStyle.gridRowStart,
      artworkGridRowEnd: artworkStyle.gridRowEnd,
      artworkAspectRatio: artworkStyle.aspectRatio,
      artworkWidth: artworkBox.width,
      artworkHeight: artworkBox.height,
      artworkTrackWidth: Number.parseFloat(rowStyle.gridTemplateColumns.split(' ')[0] ?? '0'),
      artworkLeft: artworkBox.left,
      artworkRight: artworkBox.right,
      artworkTop: artworkBox.top,
      artworkBottom: artworkBox.bottom,
      openLeft: openBox.left,
      openTop: openBox.top,
      openBottom: openBox.bottom,
      openHeight: openBox.height,
      openPaddingLeft: Number.parseFloat(openStyle.paddingLeft),
      openPaddingRight: Number.parseFloat(openStyle.paddingRight),
      openBorderTop: openStyle.borderTopWidth,
      openBackground: openStyle.backgroundColor,
      openBackgroundImage: openStyle.backgroundImage,
      openBoxShadow: openStyle.boxShadow,
      quickLeft: quickBox.left,
      quickTop: quickBox.top,
      quickBottom: quickBox.bottom,
      quickBorderTop: quickStyle.borderTopWidth,
      quickBackground: quickStyle.backgroundColor,
      quickBackgroundImage: quickStyle.backgroundImage,
      quickBoxShadow: quickStyle.boxShadow,
      profitLeft: profitBox.left,
      nameFontSize: Number.parseFloat(nameStyle.fontSize),
      nameFontWeight: nameStyle.fontWeight,
      profitFontSize: Number.parseFloat(profitStyle.fontSize),
      profitFontWeight: profitStyle.fontWeight,
      countFontSize: Number.parseFloat(countStyle.fontSize),
      countFontWeight: countStyle.fontWeight,
      productionTriggerBorderWidth: productionTriggerStyle.borderTopWidth,
      productionTriggerBackground: productionTriggerStyle.backgroundColor,
      productionTriggerBackgroundImage: productionTriggerStyle.backgroundImage,
      productionTriggerBoxShadow: productionTriggerStyle.boxShadow,
    };
  });
}

async function inspectFacilityRegionRow(page: import('@playwright/test').Page) {
  const row = page.locator('.global-facility-region-row').first();
  await expect(row).toBeVisible();
  return row.evaluate((element) => {
    const list = element.closest<HTMLElement>('.global-facility-region-list');
    const open = element.querySelector<HTMLElement>('.global-facility-region-row__open');
    const quick = element.querySelector<HTMLElement>('.global-facility-region-row__quick-controls');
    const productionTrigger = element.querySelector<HTMLElement>(".global-facility-region-row__quick-selector .ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger");
    if (!list || !open || !quick || !productionTrigger) throw new Error('facility region layout fixture is incomplete');

    const listStyle = getComputedStyle(list);
    const rowStyle = getComputedStyle(element);
    const openStyle = getComputedStyle(open);
    const quickStyle = getComputedStyle(quick);
    const productionTriggerStyle = getComputedStyle(productionTrigger);
    const openBox = open.getBoundingClientRect();
    const quickBox = quick.getBoundingClientRect();

    return {
      listGap: Number.parseFloat(listStyle.rowGap || listStyle.gap || '0'),
      rowBorderTop: rowStyle.borderTopWidth,
      rowBackground: rowStyle.backgroundColor,
      rowBackgroundImage: rowStyle.backgroundImage,
      rowBoxShadow: rowStyle.boxShadow,
      openBackground: openStyle.backgroundColor,
      openBackgroundImage: openStyle.backgroundImage,
      openBoxShadow: openStyle.boxShadow,
      openBottom: openBox.bottom,
      quickTop: quickBox.top,
      quickBorderTop: quickStyle.borderTopWidth,
      quickBackground: quickStyle.backgroundColor,
      quickBackgroundImage: quickStyle.backgroundImage,
      quickBoxShadow: quickStyle.boxShadow,
      productionTriggerBackground: productionTriggerStyle.backgroundColor,
      productionTriggerBackgroundImage: productionTriggerStyle.backgroundImage,
      productionTriggerBoxShadow: productionTriggerStyle.boxShadow,
      rowClientWidth: element.clientWidth,
      rowScrollWidth: element.scrollWidth,
    };
  });
}

test('global facility rows are flat lists with square artwork and embedded production buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game', { waitUntil: 'domcontentloaded' });
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^建筑/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '建筑' })).toBeVisible();
  await ensureFacilityCatalogFixture(page);
  await ensureFacilityRegionFixture(page);

  const header = page.locator('.global-facility-catalog-header');
  const headerFactory = header.locator(':scope > :nth-child(1)');
  const headerProfit = header.locator(':scope > :nth-child(2)');
  await expect(headerFactory).toBeVisible();
  await expect(headerProfit).toBeVisible();
  expect(await headerFactory.evaluate((element) => getComputedStyle(element).gridColumnEnd)).toBe('3');

  const desktop = await inspectFacilityRow(page);
  const headerProfitLeft = (await headerProfit.boundingBox())?.x ?? 0;
  const desktopInnerHeight = desktop.rowHeight
    - desktop.rowPaddingTop
    - desktop.rowPaddingBottom
    - Number.parseFloat(desktop.rowBorderTop)
    - Number.parseFloat(desktop.rowBorderBottom);

  expect(desktop.artworkPosition).toBe('static');
  expect(desktop.artworkTransform).toBe('none');
  expect(desktop.artworkGridColumn).toBe('1');
  expect(desktop.artworkGridRowStart).toBe('1');
  expect(desktop.artworkGridRowEnd).toBe('3');
  expect(desktop.artworkAspectRatio).not.toBe('auto');
  expect(Math.abs(desktop.artworkWidth - desktop.artworkHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(desktop.artworkTrackWidth - desktop.artworkWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(desktopInnerHeight - desktop.artworkHeight)).toBeLessThanOrEqual(1);
  expect(desktop.artworkRight).toBeLessThan(desktop.openLeft);
  expect(Math.abs(desktop.openLeft - desktop.quickLeft)).toBeLessThanOrEqual(1);
  expect(desktop.artworkTop).toBeLessThanOrEqual(desktop.openTop);
  expect(desktop.artworkBottom).toBeGreaterThanOrEqual(desktop.quickBottom);
  expect(desktop.openBottom).toBeLessThan(desktop.quickTop);
  expect(desktop.openHeight).toBe(42);
  expect(desktop.openPaddingLeft).toBe(10);
  expect(desktop.openPaddingRight).toBe(10);
  expect(desktop.openHeight).toBeLessThan(desktop.artworkHeight);

  expect(desktop.rowBorderTop).toBe('0px');
  expect(desktop.rowBorderBottom).toBe('1px');
  expect(desktop.rowBorderRadius).toBe('0px');
  expect(desktop.rowPaddingLeft).toBe(0);
  expect(desktop.rowPaddingRight).toBe(0);
  expect(desktop.rowBackground).toBe('rgba(0, 0, 0, 0)');
  expect(desktop.rowBackgroundImage).toBe('none');
  expect(desktop.rowBoxShadow).toBe('none');
  expect(desktop.listGap).toBe(0);
  expect(desktop.headerBorderBottom).toBe('1px');

  expect(desktop.openBorderTop).toBe('1px');
  expect(desktop.openBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(desktop.openBackgroundImage).toBe('none');
  expect(desktop.openBoxShadow).not.toBe('none');

  expect(desktop.quickBorderTop).toBe('0px');
  expect(desktop.quickBackground).toBe('rgba(0, 0, 0, 0)');
  expect(desktop.quickBackgroundImage).toBe('none');
  expect(desktop.quickBoxShadow).toBe('none');

  expect(Number(desktop.nameFontWeight)).toBeGreaterThanOrEqual(700);
  expect(Number(desktop.profitFontWeight)).toBeGreaterThanOrEqual(700);
  expect(Number(desktop.countFontWeight)).toBeGreaterThanOrEqual(700);
  expect(desktop.profitFontSize).toBeGreaterThanOrEqual(desktop.nameFontSize);
  expect(desktop.countFontSize).toBeGreaterThanOrEqual(desktop.nameFontSize - 1);
  expect(desktop.productionTriggerBorderWidth).toBe('1px');
  expect(desktop.productionTriggerBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(desktop.productionTriggerBackgroundImage).not.toBe('none');
  expect(desktop.productionTriggerBoxShadow).not.toBe('none');
  expect(Math.abs(desktop.profitLeft - headerProfitLeft)).toBeLessThanOrEqual(5);
  expect(desktop.rowScrollWidth).toBeLessThanOrEqual(desktop.rowClientWidth + 1);

  const region = await inspectFacilityRegionRow(page);
  expect(region.rowBorderTop).toBe('0px');
  expect(region.rowBackground).toBe('rgba(0, 0, 0, 0)');
  expect(region.rowBackgroundImage).toBe('none');
  expect(region.rowBoxShadow).toBe('none');
  expect(region.listGap).toBe(0);
  expect(region.openBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(region.openBackgroundImage).toBe('none');
  expect(region.openBoxShadow).not.toBe('none');
  expect(region.openBottom).toBeLessThan(region.quickTop);
  expect(region.quickBorderTop).toBe('0px');
  expect(region.quickBackground).toBe('rgba(0, 0, 0, 0)');
  expect(region.quickBackgroundImage).toBe('none');
  expect(region.quickBoxShadow).toBe('none');
  expect(region.productionTriggerBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(region.productionTriggerBackgroundImage).not.toBe('none');
  expect(region.productionTriggerBoxShadow).not.toBe('none');
  expect(region.rowScrollWidth).toBeLessThanOrEqual(region.rowClientWidth + 1);

  await page.setViewportSize({ width: 320, height: 760 });
  const narrow = await inspectFacilityRow(page);
  const narrowInnerHeight = narrow.rowHeight
    - narrow.rowPaddingTop
    - narrow.rowPaddingBottom
    - Number.parseFloat(narrow.rowBorderTop)
    - Number.parseFloat(narrow.rowBorderBottom);

  expect(narrow.artworkPosition).toBe('static');
  expect(Math.abs(narrow.artworkWidth - narrow.artworkHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(narrow.artworkTrackWidth - narrow.artworkWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(narrowInnerHeight - narrow.artworkHeight)).toBeLessThanOrEqual(1);
  expect(narrow.artworkWidth).toBeGreaterThanOrEqual(95);
  expect(narrow.artworkRight).toBeLessThan(narrow.openLeft);
  expect(Math.abs(narrow.openLeft - narrow.quickLeft)).toBeLessThanOrEqual(1);
  expect(narrow.rowBorderTop).toBe('0px');
  expect(narrow.rowPaddingLeft).toBe(0);
  expect(narrow.rowPaddingRight).toBe(0);
  expect(narrow.rowBackground).toBe('rgba(0, 0, 0, 0)');
  expect(narrow.openBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(narrow.openHeight).toBeLessThan(narrow.artworkHeight);
  expect(narrow.openHeight).toBe(40);
  expect(narrow.openPaddingLeft).toBe(10);
  expect(narrow.openPaddingRight).toBe(10);
  expect(narrow.quickBackground).toBe('rgba(0, 0, 0, 0)');
  expect(Number(narrow.nameFontWeight)).toBeGreaterThanOrEqual(700);
  expect(Number(narrow.profitFontWeight)).toBeGreaterThanOrEqual(700);
  expect(Number(narrow.countFontWeight)).toBeGreaterThanOrEqual(700);
  expect(narrow.rowScrollWidth).toBeLessThanOrEqual(narrow.rowClientWidth + 1);
  expect(narrow.rowHeight).toBeGreaterThanOrEqual(100);

  const narrowRegion = await inspectFacilityRegionRow(page);
  expect(narrowRegion.rowBorderTop).toBe('0px');
  expect(narrowRegion.openBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(narrowRegion.quickBackground).toBe('rgba(0, 0, 0, 0)');
  expect(narrowRegion.rowScrollWidth).toBeLessThanOrEqual(narrowRegion.rowClientWidth + 1);
});
