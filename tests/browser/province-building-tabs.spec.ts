import { expect, test, type Page } from '@playwright/test';

async function openProvince(page: Page, scenario = 'activity', navigation = 'stack') {
  await page.goto(`runtime-test.html?view=regional-buildings&scenario=${scenario}&navigation=${navigation}`);
  await expect(page.getByRole('tab', { name: '概览', exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function selectTab(page: Page, name: '商业' | '工业') {
  const tab = page.getByRole('tab', { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.unified-regional-buildings')).toHaveAttribute('data-building-kind', name === '商业' ? 'commercial' : 'industrial');
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function changeContext(page: Page, provinceId: string, userId?: number) {
  await page.evaluate(({ provinceId, userId }) => {
    const fixture = window as unknown as {
      __setBuildingProvince: (id: string) => void;
      __setBuildingUser: (id: number) => void;
    };
    fixture.__setBuildingProvince(provinceId);
    if (userId !== undefined) fixture.__setBuildingUser(userId);
  }, { provinceId, userId });
}

for (const width of [320, 390, 720, 1440]) {
  test(`province tabs isolate building categories without a local filter at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const mutations: string[] = [];
    page.on('request', (request) => { if (request.method() === 'POST') mutations.push(request.url()); });
    await openProvince(page);
    const tabs = page.getByRole('tablist').getByRole('tab');
    await expect(tabs).toHaveText(['概览', '市场', '商业', '工业', '仓库']);
    const rectangles = await tabs.evaluateAll((elements) => elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }));
    for (const rect of rectangles) {
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(rect.y - rectangles[0].y)).toBeLessThanOrEqual(1);
      expect(Math.abs(rect.width - rectangles[0].width)).toBeLessThanOrEqual(1);
    }
    for (const category of ['商业', '工业'] as const) {
      await selectTab(page, category);
      await expect(page.locator('.building-type-filter')).toHaveCount(0);
      const cards = page.locator('.unified-building-list > .facility-cluster-selector-card');
      await expect(cards).toHaveCount(category === '商业' ? 6 : 1);
      await expect(page.locator('.commercial-build-card')).toHaveCount(category === '商业' ? 1 : 0);
      await expect(page.locator('.production-build-card:not(.commercial-build-card)')).toHaveCount(category === '工业' ? 1 : 0);
      const kinds = await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-building-kind')));
      expect(kinds.every((kind) => kind === (category === '商业' ? 'commercial' : 'industrial'))).toBe(true);
      const columns = await page.locator('.unified-building-list').evaluate((element) => getComputedStyle(element).gridTemplateColumns);
      expect(columns.trim().split(/\s+/)).toHaveLength(3);
      const sizes = await page.locator('.province-section-switch, .province-section-panel, .unified-regional-buildings').evaluateAll(
        (elements) => elements.map((element) => ({ scroll: element.scrollWidth, client: element.clientWidth })),
      );
      for (const size of sizes) expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
    }
    expect(mutations).toEqual([]);
  });
}

test('province tabs retain roving focus and keyboard order', async ({ page }) => {
  await openProvince(page);
  await page.getByRole('tab', { name: '概览', exact: true }).focus();
  for (const name of ['市场', '商业', '工业', '仓库', '概览']) {
    await page.keyboard.press('ArrowRight');
    const tab = page.getByRole('tab', { name, exact: true });
    await expect(tab).toBeFocused();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(tab).toHaveAttribute('tabindex', '0');
    await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', await tab.getAttribute('id') as string);
  }
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: '仓库', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: '概览', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: '仓库', exact: true })).toBeFocused();
});

for (const category of ['商业', '工业'] as const) {
  test(`${category} empty state retains only its own construction form`, async ({ page }) => {
    await openProvince(page, 'empty');
    await selectTab(page, category);
    await expect(page.getByText(`当前地区尚未拥有${category}建筑。`, { exact: true })).toBeVisible();
    await expect(page.locator('.unified-building-list > button')).toHaveCount(0);
    await expect(page.locator('.production-build-card')).toHaveCount(1);
    await expect(page.locator('.building-type-filter')).toHaveCount(0);
  });

  test(`${category} detail and region overview return to the correct province tab`, async ({ page }) => {
    await openProvince(page);
    await selectTab(page, category);
    await page.locator('.unified-building-list > button').first().click();
    const kind = category === '商业' ? 'commercial' : 'industrial';
    await expect(page.locator('.building-detail-page')).toHaveAttribute('data-building-kind', kind);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await page.locator('.regional-entity-title__region-button').click();
    await expect(page.getByRole('tab', { name: '概览', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.locator('.page-navigation-button--back').click();
    await expect(page.locator('.building-detail-page')).toHaveAttribute('data-building-kind', kind);
    await page.locator('.page-navigation-button--back').click();
    await expect(page.getByRole('tab', { name: category, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.building-detail-page')).toHaveCount(0);
    await expect(page.locator('.building-type-filter')).toHaveCount(0);
  });
}

test('construction drafts survive category and detail navigation without submitting', async ({ page }) => {
  await openProvince(page);
  await selectTab(page, '商业');
  await choose(page, '商业建筑类型', '生鲜超市');
  await choose(page, '建造数量', '5');
  await selectTab(page, '工业');
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('1');
  await choose(page, '建造数量', '10');
  await selectTab(page, '商业');
  await expect(page.getByRole('combobox', { name: '商业建筑类型', exact: true })).toContainText('生鲜超市');
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('5');
  await page.locator('.commercial-building-card').first().click();
  await expect(page.locator('.building-detail-page')).toBeVisible();
  await page.locator('.page-navigation-button--back').click();
  await expect(page.getByRole('combobox', { name: '商业建筑类型', exact: true })).toContainText('生鲜超市');
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('5');
  await selectTab(page, '工业');
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('10');
});

test('construction drafts and fallback details are isolated by province and player', async ({ page }) => {
  await openProvince(page, 'activity', 'none');
  await selectTab(page, '商业');
  await choose(page, '商业建筑类型', '生鲜超市');
  await choose(page, '建造数量', '5');
  await page.locator('.commercial-building-card').first().click();
  await expect(page.locator('.building-detail-page')).toBeVisible();
  await changeContext(page, '120000');
  await expect(page.getByRole('tab', { name: '概览', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.building-detail-page')).toHaveCount(0);
  await selectTab(page, '商业');
  await expect(page.getByRole('combobox', { name: '商业建筑类型', exact: true })).toContainText('便利店');
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('1');
  await expect(page.locator('.commercial-building-card .facility-cluster-count')).toHaveText('7');
  await changeContext(page, '110000');
  await selectTab(page, '商业');
  await expect(page.getByRole('combobox', { name: '商业建筑类型', exact: true })).toContainText('生鲜超市');
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('5');
  await changeContext(page, '110000', 77902);
  await expect(page.getByRole('tab', { name: '概览', exact: true })).toHaveAttribute('aria-selected', 'true');
  await selectTab(page, '商业');
  await expect(page.getByRole('combobox', { name: '商业建筑类型', exact: true })).toContainText('便利店');
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('1');
});
