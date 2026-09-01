import { expect, test, type Locator } from '@playwright/test';

async function expectTopLayerHitTarget(locator: Locator) {
  const hit = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return target === element || element.contains(target);
  });
  expect(hit).toBe(true);
}

test('mobile production overlays use the browser top layer above the factory detail page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=production&scenario=production-methods');

  await page.locator('.facility-cluster-selector-card').first().click();
  const detail = page.locator('.facility-cluster-detail-card');
  const workspaceHost = page.locator('.mobile-workspace-sheet-host');
  await expect(detail).toBeVisible();
  await expect(workspaceHost).toHaveCount(1);
  await expect(workspaceHost).toHaveAttribute('data-detail-active', 'false');
  await expect(workspaceHost.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);

  const tooltipLayer = page.locator('.workspace-tooltip-layer');
  await expect(tooltipLayer).toHaveCount(1);
  await expect(tooltipLayer).not.toHaveAttribute('popover', 'manual');
  await expect(tooltipLayer).not.toHaveAttribute('data-top-layer', 'true');
  expect(await tooltipLayer.evaluate((element) => element.matches(':popover-open'))).toBe(false);
  expect(await tooltipLayer.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');

  const productionSettlement = detail.locator('[data-game-concept="production-settlement"]');
  const productionSettlementAnchor = productionSettlement.locator('xpath=..');
  await expect(productionSettlementAnchor).toHaveClass(/game-concept-anchor/);
  await expect(productionSettlement).toBeVisible();
  expect(await productionSettlement.evaluate((element) => getComputedStyle(element).textDecorationStyle)).toBe('dotted');
  await productionSettlementAnchor.focus();
  const conceptTooltip = tooltipLayer.getByRole('tooltip');
  await expect(conceptTooltip).toBeVisible();
  await expect(conceptTooltip).toContainText('生产结算');
  await expect(conceptTooltip).toContainText('原料');
  await expect(conceptTooltip).toHaveAttribute('data-top-layer', 'true');
  expect(await conceptTooltip.evaluate((element) => element.matches(':popover-open'))).toBe(true);
  expect(await conceptTooltip.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
  expect(await conceptTooltip.evaluate((element) => element.parentElement?.matches('.workspace-tooltip-layer'))).toBe(true);

  const recipeSelect = detail.getByRole('combobox', { name: '机械工厂生产产物' });
  await recipeSelect.click();
  await expect(conceptTooltip).toHaveCount(0);
  const recipeListbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
  await expect(recipeListbox).toBeVisible();
  await expect(recipeListbox).toHaveAttribute('data-top-layer', 'true');
  expect(await recipeListbox.evaluate((element) => element.matches(':popover-open'))).toBe(true);
  expect(await recipeListbox.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
  await expectTopLayerHitTarget(recipeListbox.getByRole('option').first());
  await page.keyboard.press('Escape');
  await expect(recipeListbox).toHaveCount(0);

  const methodSelect = detail.getByRole('combobox', { name: '机械工厂生产方式' });
  await methodSelect.click();
  const methodListbox = page.getByRole('listbox', { name: '机械工厂生产方式' });
  await expect(methodListbox).toBeVisible();
  await expect(methodListbox).toHaveAttribute('data-top-layer', 'true');
  const cellular = methodListbox.getByRole('option', { name: '单元制造' });
  await expectTopLayerHitTarget(cellular);
  await cellular.click();

  await expect.poll(async () => page.evaluate(() => (
    window as typeof window & { __productionRecipeRequests?: string[] }
  ).__productionRecipeRequests ?? [])).toEqual([
    'machine-factory:machinery-recipe--cellular-manufacturing',
  ]);
});
