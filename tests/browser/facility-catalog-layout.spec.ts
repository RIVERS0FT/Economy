import { expect, test } from '@playwright/test';

async function ensureFacilityCatalogFixture(page: import('@playwright/test').Page) {
  const existingRows = page.locator('.global-facility-catalog-row');
  if (await existingRows.count()) return;

  await page.locator('.global-facility-catalog').evaluate((surface) => {
    surface.innerHTML = `
      <div class="entity-list-header global-facility-catalog-header">
        <span class="entity-list-header__cell">工厂</span>
        <span class="entity-list-header__cell">平均利润／分钟</span>
        <span class="entity-list-header__cell">拥有</span>
        <span class="entity-list-header__cell"></span>
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
}

async function inspectFacilityRow(page: import('@playwright/test').Page) {
  const row = page.locator('.global-facility-catalog-row').first();
  await expect(row).toBeVisible();
  return row.evaluate((element) => {
    const header = document.querySelector<HTMLElement>('.global-facility-catalog-header');
    const artwork = element.querySelector<HTMLElement>('.global-facility-catalog-row__artwork');
    const open = element.querySelector<HTMLElement>('.global-facility-catalog-row__open');
    const quick = element.querySelector<HTMLElement>('.global-facility-catalog-row__quick-controls');
    const name = element.querySelector<HTMLElement>('.global-facility-catalog-row__identity > strong');
    const profit = element.querySelector<HTMLElement>('.global-facility-catalog-row__profit');
    const count = element.querySelector<HTMLElement>('.global-facility-catalog-row__metric:not(.global-facility-catalog-row__profit)');
    const productionTrigger = element.querySelector<HTMLElement>(".global-facility-catalog-row__quick-selector .ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger");
    if (!header || !artwork || !open || !quick || !name || !profit || !count || !productionTrigger) {
      throw new Error('facility catalog layout fixture is incomplete');
    }
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
    const profitBox = profit.getBoundingClientRect();
    return {
      rowClientWidth: element.clientWidth,
      rowScrollWidth: element.scrollWidth,
      rowHeight: element.getBoundingClientRect().height,
      rowColumns: rowStyle.gridTemplateColumns,
      rowBorderTop: rowStyle.borderTopWidth,
      headerBorderBottom: headerStyle.borderBottomWidth,
      artworkPosition: artworkStyle.position,
      artworkTransform: artworkStyle.transform,
      artworkGridColumn: artworkStyle.gridColumnStart,
      artworkGridRowStart: artworkStyle.gridRowStart,
      artworkGridRowEnd: artworkStyle.gridRowEnd,
      artworkLeft: artworkBox.left,
      artworkRight: artworkBox.right,
      artworkTop: artworkBox.top,
      artworkBottom: artworkBox.bottom,
      openLeft: openBox.left,
      openTop: openBox.top,
      openBottom: openBox.bottom,
      openHeight: openBox.height,
      openBorderLeft: openStyle.borderLeftWidth,
      quickLeft: quickBox.left,
      quickTop: quickBox.top,
      quickBottom: quickBox.bottom,
      quickBorderLeft: quickStyle.borderLeftWidth,
      quickBorderTop: quickStyle.borderTopWidth,
      quickBackground: quickStyle.backgroundColor,
      profitLeft: profitBox.left,
      nameFontSize: Number.parseFloat(nameStyle.fontSize),
      nameFontWeight: nameStyle.fontWeight,
      profitFontSize: Number.parseFloat(profitStyle.fontSize),
      profitFontWeight: profitStyle.fontWeight,
      countFontSize: Number.parseFloat(countStyle.fontSize),
      countFontWeight: countStyle.fontWeight,
      productionTriggerBorderWidth: productionTriggerStyle.borderTopWidth,
      productionTriggerBackground: productionTriggerStyle.backgroundColor,
      productionTriggerBoxShadow: productionTriggerStyle.boxShadow,
    };
  });
}

test('global facility artwork keeps a real grid track while building rows remove separators and emphasize key values', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game', { waitUntil: 'domcontentloaded' });
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^建筑/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '建筑' })).toBeVisible();
  await ensureFacilityCatalogFixture(page);

  const header = page.locator('.global-facility-catalog-header');
  const headerFactory = header.locator(':scope > :nth-child(1)');
  const headerProfit = header.locator(':scope > :nth-child(2)');
  await expect(headerFactory).toBeVisible();
  await expect(headerProfit).toBeVisible();
  expect(await headerFactory.evaluate((element) => getComputedStyle(element).gridColumnEnd)).toBe('3');

  const desktop = await inspectFacilityRow(page);
  const headerProfitLeft = (await headerProfit.boundingBox())?.x ?? 0;
  expect(desktop.artworkPosition).toBe('static');
  expect(desktop.artworkTransform).toBe('none');
  expect(desktop.artworkGridColumn).toBe('1');
  expect(desktop.artworkGridRowStart).toBe('1');
  expect(desktop.artworkGridRowEnd).toBe('3');
  expect(desktop.artworkRight).toBeLessThan(desktop.openLeft);
  expect(Math.abs(desktop.openLeft - desktop.quickLeft)).toBeLessThanOrEqual(1);
  expect(desktop.artworkTop).toBeLessThan(desktop.openBottom);
  expect(desktop.artworkBottom).toBeGreaterThan(desktop.quickTop);
  expect(desktop.openBottom).toBeLessThanOrEqual(desktop.quickTop + 1);
  expect(desktop.openHeight).toBeGreaterThanOrEqual(29);
  expect(desktop.openHeight).toBeLessThanOrEqual(31);
  expect(desktop.rowBorderTop).toBe('0px');
  expect(desktop.headerBorderBottom).toBe('0px');
  expect(desktop.openBorderLeft).toBe('0px');
  expect(desktop.quickBorderLeft).toBe('0px');
  expect(desktop.quickBorderTop).toBe('0px');
  expect(desktop.quickBackground).toBe('rgba(0, 0, 0, 0)');
  expect(Number(desktop.nameFontWeight)).toBeGreaterThanOrEqual(700);
  expect(Number(desktop.profitFontWeight)).toBeGreaterThanOrEqual(700);
  expect(Number(desktop.countFontWeight)).toBeGreaterThanOrEqual(700);
  expect(desktop.profitFontSize).toBeGreaterThanOrEqual(desktop.nameFontSize);
  expect(desktop.countFontSize).toBeGreaterThanOrEqual(desktop.nameFontSize - 1);
  expect(desktop.productionTriggerBorderWidth).toBe('1px');
  expect(desktop.productionTriggerBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(desktop.productionTriggerBoxShadow).not.toBe('none');
  expect(Math.abs(desktop.profitLeft - headerProfitLeft)).toBeLessThanOrEqual(1);
  expect(desktop.rowScrollWidth).toBeLessThanOrEqual(desktop.rowClientWidth + 1);

  await page.setViewportSize({ width: 320, height: 760 });
  const narrow = await inspectFacilityRow(page);
  expect(narrow.artworkPosition).toBe('static');
  expect(narrow.artworkRight).toBeLessThan(narrow.openLeft);
  expect(Math.abs(narrow.openLeft - narrow.quickLeft)).toBeLessThanOrEqual(1);
  expect(narrow.rowBorderTop).toBe('0px');
  expect(narrow.quickBorderTop).toBe('0px');
  expect(Number(narrow.nameFontWeight)).toBeGreaterThanOrEqual(700);
  expect(Number(narrow.profitFontWeight)).toBeGreaterThanOrEqual(700);
  expect(Number(narrow.countFontWeight)).toBeGreaterThanOrEqual(700);
  expect(narrow.rowScrollWidth).toBeLessThanOrEqual(narrow.rowClientWidth + 1);
  expect(narrow.rowHeight).toBeGreaterThanOrEqual(90);
});
