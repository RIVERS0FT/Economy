import { expect, test } from '@playwright/test';

async function requireBox(locator: import('@playwright/test').Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function openRegionalBuildings(page: import('@playwright/test').Page) {
  await page.goto('runtime-test.html?view=production&scenario=activity');
  await expect(page.locator('.production-build-card')).toBeVisible();
  await expect(page.locator('.facility-cluster-selector-region')).toBeVisible();
  await expect(page.locator('.facility-cluster-selector-card').first()).toBeVisible();
}

test('regional buildings shows build first and three factory cards per row', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRegionalBuildings(page);

  const management = page.locator('.regional-buildings-management');
  const build = page.locator('.production-build-card');
  const list = page.locator('.facility-cluster-selector-region');
  const grid = page.locator('.facility-cluster-selector-list');
  const card = page.locator('.facility-cluster-selector-card').first();

  const buildBox = await requireBox(build);
  const listBox = await requireBox(list);
  const cardBox = await requireBox(card);
  expect(buildBox.y).toBeLessThan(listBox.y);
  expect(cardBox.width).toBeGreaterThan(0);
  expect(cardBox.height / cardBox.width).toBeCloseTo(1.25, 1);

  await expect(page.getByText('建筑概况', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('搜索')).toHaveCount(0);
  await expect(page.getByLabel('产业分类')).toHaveCount(0);
  await expect(page.getByLabel('运行状态')).toHaveCount(0);
  await expect(page.locator('.facility-cluster-navigation')).toHaveCount(0);

  const geometry = await page.evaluate(() => {
    const managementElement = document.querySelector<HTMLElement>('.regional-buildings-management');
    const gridElement = document.querySelector<HTMLElement>('.facility-cluster-selector-list');
    const cardElement = document.querySelector<HTMLElement>('.facility-cluster-selector-card');
    if (!managementElement || !gridElement || !cardElement) {
      throw new Error('regional factory card fixture is incomplete');
    }
    const gridStyle = getComputedStyle(gridElement);
    const cardStyle = getComputedStyle(cardElement);
    return {
      managementScrollWidth: managementElement.scrollWidth,
      managementClientWidth: managementElement.clientWidth,
      gridScrollWidth: gridElement.scrollWidth,
      gridClientWidth: gridElement.clientWidth,
      gridTemplateColumns: gridStyle.gridTemplateColumns,
      aspectRatio: cardStyle.aspectRatio,
      maxWidth: cardStyle.maxWidth,
    };
  });

  expect(geometry.managementScrollWidth).toBeLessThanOrEqual(geometry.managementClientWidth + 1);
  expect(geometry.gridScrollWidth).toBeLessThanOrEqual(geometry.gridClientWidth + 1);
  expect(geometry.gridTemplateColumns.trim().split(/\s+/)).toHaveLength(3);
  expect(geometry.aspectRatio).toBe('4 / 5');
  expect(geometry.maxWidth).toBe('none');

  await expect(card.locator('.facility-cluster-name')).toBeVisible();
  await expect(card.locator('.facility-cluster-profit')).toBeVisible();
  await expect(card.locator('.facility-cluster-count')).toBeVisible();
  await expect(management).toBeVisible();
});

test('factory card opens second-level detail without changing header height', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  await openRegionalBuildings(page);

  const header = page.locator('.page-fixed-header');
  const title = page.locator('.page-heading-title h1');
  const firstCard = page.locator('.facility-cluster-selector-card').first();
  const factoryName = (await firstCard.locator('.facility-cluster-name').textContent())?.trim() ?? '';
  const headerHeightBefore = (await requireBox(header)).height;

  await firstCard.click();
  await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();
  await expect(page.locator('.facility-cluster-selector-region')).toHaveCount(0);
  await expect(title).toContainText(factoryName);

  const headerHeightAfter = (await requireBox(header)).height;
  expect(Math.abs(headerHeightAfter - headerHeightBefore)).toBeLessThanOrEqual(1);

  const titleStyle = await page.locator('.regional-entity-title').evaluate((element) => {
    const name = element.querySelector<HTMLElement>('.regional-entity-title__name');
    const region = element.querySelector<HTMLElement>('.regional-entity-title__region');
    if (!name || !region) throw new Error('regional entity title is incomplete');
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-text-muted)';
    document.body.appendChild(probe);
    const mutedColor = getComputedStyle(probe).color;
    probe.remove();
    return {
      name: name.textContent?.trim(),
      region: region.textContent?.trim(),
      nameFontSize: Number.parseFloat(getComputedStyle(name).fontSize),
      regionFontSize: Number.parseFloat(getComputedStyle(region).fontSize),
      regionColor: getComputedStyle(region).color,
      mutedColor,
      wrapperHeight: element.getBoundingClientRect().height,
    };
  });
  expect(titleStyle.name).toBe(factoryName);
  expect(titleStyle.region).toBe('加利福尼亚');
  expect(titleStyle.nameFontSize).toBeGreaterThan(titleStyle.regionFontSize);
  expect(titleStyle.regionColor).toBe(titleStyle.mutedColor);
  expect(titleStyle.wrapperHeight).toBeLessThanOrEqual(40.5);

  await page.locator('.page-navigation-button--back').click();
  await expect(page.locator('.production-build-card')).toBeVisible();
  await expect(page.locator('.facility-cluster-selector-region')).toBeVisible();
});

test('mobile factory cards remain three columns without horizontal clipping', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRegionalBuildings(page);

  const grid = page.locator('.facility-cluster-selector-list');
  const firstCard = page.locator('.facility-cluster-selector-card').first();
  const geometry = await page.evaluate(() => {
    const pageElement = document.querySelector<HTMLElement>('.page-content--player');
    const managementElement = document.querySelector<HTMLElement>('.regional-buildings-management');
    const gridElement = document.querySelector<HTMLElement>('.facility-cluster-selector-list');
    const cardElement = document.querySelector<HTMLElement>('.facility-cluster-selector-card');
    if (!pageElement || !managementElement || !gridElement || !cardElement) {
      throw new Error('mobile factory card fixture is incomplete');
    }
    return {
      page: [pageElement.scrollWidth, pageElement.clientWidth],
      management: [managementElement.scrollWidth, managementElement.clientWidth],
      grid: [gridElement.scrollWidth, gridElement.clientWidth],
      gridTemplateColumns: getComputedStyle(gridElement).gridTemplateColumns,
      aspectRatio: getComputedStyle(cardElement).aspectRatio,
    };
  });

  expect(geometry.page[0]).toBeLessThanOrEqual(geometry.page[1] + 1);
  expect(geometry.management[0]).toBeLessThanOrEqual(geometry.management[1] + 1);
  expect(geometry.grid[0]).toBeLessThanOrEqual(geometry.grid[1] + 1);
  expect(geometry.gridTemplateColumns.trim().split(/\s+/)).toHaveLength(3);
  expect(geometry.aspectRatio).toBe('4 / 5');
  await expect(grid).toBeVisible();

  await firstCard.click();
  await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();
  await expect(page.locator('.facility-cluster-selector-region')).toHaveCount(0);
  await expect(page.locator('.regional-entity-title')).toBeVisible();

  const detailOverflow = await page.evaluate(() => {
    const pageElement = document.querySelector<HTMLElement>('.page-content--player');
    const detailElement = document.querySelector<HTMLElement>('.facility-cluster-detail-page');
    if (!pageElement || !detailElement) throw new Error('mobile factory detail is incomplete');
    return {
      page: [pageElement.scrollWidth, pageElement.clientWidth],
      detail: [detailElement.scrollWidth, detailElement.clientWidth],
    };
  });
  expect(detailOverflow.page[0]).toBeLessThanOrEqual(detailOverflow.page[1] + 1);
  expect(detailOverflow.detail[0]).toBeLessThanOrEqual(detailOverflow.detail[1] + 1);
});
