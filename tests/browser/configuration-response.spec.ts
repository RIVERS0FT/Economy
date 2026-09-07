import { expect, test, type Page } from '@playwright/test';

type Target = { provinceId: string; facilityTypeId: string; recipeId: string };
type ConfigurationWindow = typeof window & {
  __productionConfigurationBatches: Target[][];
  __confirmProductionConfiguration: (index: number, ok?: boolean) => void;
  __productionConfigurationAuthority: { credits: number; facilityGroups: Array<{ activeRecipeId: string }> };
};
const batches = (page: Page) => page.evaluate(() => (window as ConfigurationWindow).__productionConfigurationBatches);
async function choose(page: Page, trigger: ReturnType<Page['getByRole']>, option: string) {
  await trigger.click();
  await page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click();
}

for (const width of [390, 1440]) {
  test(`production output and method respond before confirmation and merge to latest at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('tests/browser/configuration-response.html?view=production&scenario=configuration-response-detail');
    await page.getByRole('button', { name: /农场，/ }).first().click();
    const product = page.getByRole('combobox', { name: '农场生产产物', exact: true });
    const method = page.getByRole('combobox', { name: '农场生产方式', exact: true });
    const authorityBefore = await page.evaluate(() => JSON.stringify((window as ConfigurationWindow).__productionConfigurationAuthority));
    await choose(page, product, '种植水稻');
    await expect(product).toContainText('水稻');
    await expect(method).toBeEnabled();
    await choose(page, method, '工具耕作');
    await choose(page, product, '种植棉花');
    await expect(product).toContainText('棉花');
    await expect(method).toContainText('工具耕作');
    await expect.poll(() => batches(page)).toEqual([[{ provinceId: '110000', facilityTypeId: 'farm', recipeId: 'rice-crop' }]]);
    expect(await page.evaluate(() => JSON.stringify((window as ConfigurationWindow).__productionConfigurationAuthority))).toBe(authorityBefore);
    await page.evaluate(() => (window as ConfigurationWindow).__confirmProductionConfiguration(0));
    await expect.poll(() => batches(page)).toEqual([
      [{ provinceId: '110000', facilityTypeId: 'farm', recipeId: 'rice-crop' }],
      [{ provinceId: '110000', facilityTypeId: 'farm', recipeId: 'cotton-crop--tool-tillage' }],
    ]);
    await expect(product).toContainText('棉花');
    await page.evaluate(() => (window as ConfigurationWindow).__confirmProductionConfiguration(1, false));
    await expect(product).toContainText('水稻');
    await expect(method).toContainText('露天轮作');
    expect(await page.evaluate(() => JSON.stringify((window as ConfigurationWindow).__productionConfigurationAuthority))).toBe(authorityBefore);
  });
}

test('global batch, province quick control and reopened detail share latest target without extra writes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('tests/browser/configuration-response.html?view=production&scenario=configuration-response-global');
  const globalRow = page.locator('.global-facility-catalog-row').first();
  const product = globalRow.locator('[data-quick-production="product"]').getByRole('combobox');
  const method = globalRow.locator('[data-quick-production="method"]').getByRole('combobox');
  await choose(page, product, '种植水稻');
  await choose(page, method, '工具耕作');
  await expect(product).toContainText('水稻');
  await expect(method).toContainText('工具耕作');
  await expect.poll(async () => (await batches(page)).length).toBe(1);
  const first = (await batches(page))[0];
  expect(first).toHaveLength(2);
  expect(first.every((target) => target.recipeId === 'rice-crop')).toBe(true);
  await globalRow.locator('.global-facility-catalog-row__open').click();
  const regionRow = page.locator('.global-facility-region-row[data-province-id="110000"]');
  const regionProduct = regionRow.locator('[data-quick-production="product"]').getByRole('combobox');
  await expect(regionProduct).toContainText('水稻');
  await choose(page, regionProduct, '种植棉花');
  await regionRow.locator('.global-facility-region-row__open').click();
  const detailProduct = page.locator('.facility-production-settings-grid').getByRole('combobox').first();
  await expect(detailProduct).toContainText('棉花');
  await expect(page.getByRole('combobox', { name: '农场生产方式', exact: true })).toContainText('工具耕作');
  await page.evaluate(() => (window as ConfigurationWindow).__confirmProductionConfiguration(0));
  await expect.poll(async () => (await batches(page)).length).toBe(2);
  expect((await batches(page))[1]).toEqual([
    { provinceId: '110000', facilityTypeId: 'farm', recipeId: 'cotton-crop--tool-tillage' },
    { provinceId: '120000', facilityTypeId: 'farm', recipeId: 'rice-crop--tool-tillage' },
  ]);
  await page.evaluate(() => (window as ConfigurationWindow).__confirmProductionConfiguration(1));
  await expect(detailProduct).toContainText('棉花');
});
