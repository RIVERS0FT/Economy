import { expect, test } from '@playwright/test';

test.describe('factory production methods', () => {
  test('renders compact selectors and switches the active recipe immediately', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=production-methods');
    await page.locator('.facility-cluster-selector-card').first().click();

    const detail = page.locator('.facility-cluster-detail-card');
    await expect(detail).toBeVisible();
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
    const formula = detail.locator('.facility-production-formula');
    const productionSettings = detail.locator('.facility-production-settings');
    const recipeSelect = productionSettings.getByRole('combobox', { name: '机械工厂生产产物' });
    const methodSelect = productionSettings.getByRole('combobox', { name: '机械工厂生产方式' });
    const inputSlot = formula.getByRole('button', { name: /^查看钢材市场/ });
    const outputSlot = formula.getByRole('button', { name: /^查看机械市场/ });

    await expect(productionSettings).toContainText('生产设置');
    await expect(productionSettings.locator('.facility-production-method-summary')).toHaveCount(0);
    await expect(recipeSelect).toHaveAttribute('data-variant', 'production-config');
    await expect(methodSelect).toHaveAttribute('data-variant', 'production-config');
    await expect(recipeSelect.locator('[data-product-artwork="machinery"]')).toHaveCount(1);
    await expect(methodSelect.locator('[data-production-method-icon="rapid"]')).toHaveCount(1);
    await expect(detail).not.toContainText('下一周期');
    await expect(detail).not.toContainText('缩短周期并提高成本');

    await recipeSelect.click();
    const recipeListbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
    await expect(recipeListbox).toBeVisible();
    const recipeTriggerBox = await recipeSelect.boundingBox();
    const recipeListboxBox = await recipeListbox.boundingBox();
    expect(recipeTriggerBox).not.toBeNull();
    expect(recipeListboxBox).not.toBeNull();
    expect(recipeListboxBox!.width).toBeGreaterThan(recipeTriggerBox!.width + 80);
    await expect(recipeListbox.getByRole('option', { name: '机械制造' })).toContainText('周期 60s');
    await page.keyboard.press('Escape');

    await methodSelect.click();
    const methodListbox = page.getByRole('listbox', { name: '机械工厂生产方式' });
    const economical = methodListbox.getByRole('option', { name: '节约生产' });
    await expect(economical).toContainText('周期 180s ↑');
    await expect(economical).toContainText('成本 4 ↓');
    await expect(economical).toContainText('产出 ×2 ↑');
    await economical.click();

    await expect.poll(async () => page.evaluate(() => (
      window as typeof window & { __productionRecipeRequests?: string[] }
    ).__productionRecipeRequests ?? [])).toEqual([
      'machine-factory:machinery-recipe--economical',
    ]);
    await expect(methodSelect).toContainText('节约生产');
    await expect(formula).toContainText('180s · 成本 4 · 产出 ×1');
    await expect(formula).not.toContainText('下一周期');

    const settlement = detail.locator('.facility-production-formula');
    await expect(settlement.locator('svg.product-icon')).toHaveCount(0);
    await expect(settlement.locator('.product-artwork')).toHaveCount(2);
    await expect(settlement.locator('.facility-formula-separator')).toHaveCount(0);
    await expect(inputSlot).toBeVisible();
    await expect(outputSlot).toBeVisible();

    async function backToProduction() {
      await page.getByRole('button', { name: '返回上一页面' }).click();
      await expect(page.locator('.facility-cluster-detail-card')).toBeVisible();
    }

    await inputSlot.click();
    await expect(page.locator('.market-detail-view')).toHaveAttribute('data-market-product-id', 'steel');
    await expect(page.locator('.market-detail-view')).toContainText('钢材');
    await backToProduction();

    await outputSlot.click();
    await expect(page.locator('.market-detail-view')).toHaveAttribute('data-market-product-id', 'machinery');
    await expect(page.locator('.market-detail-view')).toContainText('机械');
    await backToProduction();

    const transitions = await formula.locator('.facility-production-progress').evaluate((element) => {
      const track = element.querySelector<HTMLElement>('.progress-track');
      const fill = element.querySelector<HTMLElement>('.progress-track > span');
      return {
        trackTransition: track ? getComputedStyle(track).transition : '',
        fillTransition: fill ? getComputedStyle(fill).transition : '',
        arrowClipPath: fill ? getComputedStyle(fill, '::after').clipPath : '',
      };
    });
    expect(transitions.trackTransition).toBe('all');
    expect(transitions.fillTransition).toContain('width');
    expect(transitions.arrowClipPath).not.toBe('none');
  });

  test('keeps mobile production controls and settlement in one non-overlapping page detail flow', async ({ page }) => {
    for (const width of [320, 360, 390, 430, 720]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('runtime-test.html?view=production&scenario=production-methods');
      await page.locator('.facility-cluster-selector-card').first().click();

      const detail = page.locator('.facility-cluster-detail-card');
      const scroll = page.locator('.page-card-scroll');
      await expect(detail).toBeVisible();
      await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
      const productionSettings = detail.locator('.facility-production-settings');
      const recipeSelect = productionSettings.getByRole('combobox', { name: '机械工厂生产产物' });
      const methodSelect = productionSettings.getByRole('combobox', { name: '机械工厂生产方式' });
      const settlement = detail.locator('.facility-production-formula');
      const diagnostics = detail.locator('.facility-operating-diagnostics');
      const inputSlot = settlement.getByRole('button', { name: /^查看钢材市场/ });
      const outputSlot = settlement.getByRole('button', { name: /^查看机械市场/ });

      await expect(recipeSelect).toBeVisible();
      await expect(methodSelect).toBeVisible();
      await expect(settlement).toBeVisible();
      await expect(diagnostics).toBeVisible();
      await expect(inputSlot).toBeVisible();
      await expect(outputSlot).toBeVisible();
      await expect(inputSlot).not.toHaveClass(/is-dragging/);

      const geometry = await page.evaluate(() => {
        const detailElement = document.querySelector<HTMLElement>('.facility-cluster-detail-card');
        const settingsElement = document.querySelector<HTMLElement>('.facility-production-settings-grid');
        const settlementElement = document.querySelector<HTMLElement>('.facility-production-formula');
        const diagnosticsElement = document.querySelector<HTMLElement>('.facility-operating-diagnostics');
        const visualElement = document.querySelector<HTMLElement>('.facility-formula-visual');
        const metaElement = document.querySelector<HTMLElement>('.facility-formula-meta');
        const cycleElement = document.querySelector<HTMLElement>('.facility-formula-meta-unit.is-cycle');
        const costElement = document.querySelector<HTMLElement>('.facility-formula-meta-unit.is-cost');
        const inputElement = document.querySelector<HTMLElement>('.facility-formula-input');
        const outputElement = document.querySelector<HTMLElement>('.facility-formula-output');
        const scrollElement = document.querySelector<HTMLElement>('.page-card-scroll');
        if (!detailElement || !settingsElement || !settlementElement || !diagnosticsElement || !visualElement || !metaElement || !cycleElement || !costElement || !inputElement || !outputElement || !scrollElement) {
          throw new Error('mobile production detail fixture is incomplete');
        }
        const detailBox = detailElement.getBoundingClientRect();
        const settingsBox = settingsElement.getBoundingClientRect();
        const settlementBox = settlementElement.getBoundingClientRect();
        const diagnosticsBox = diagnosticsElement.getBoundingClientRect();
        const visualBox = visualElement.getBoundingClientRect();
        const metaBox = metaElement.getBoundingClientRect();
        const cycleBox = cycleElement.getBoundingClientRect();
        const costBox = costElement.getBoundingClientRect();
        const inputBox = inputElement.getBoundingClientRect();
        const outputBox = outputElement.getBoundingClientRect();
        const scrollOverflow = { scrollWidth: scrollElement.scrollWidth, clientWidth: scrollElement.clientWidth };
        const settlementOverflow = { scrollWidth: settlementElement.scrollWidth, clientWidth: settlementElement.clientWidth };
        const diagnosticsOverflow = { scrollWidth: diagnosticsElement.scrollWidth, clientWidth: diagnosticsElement.clientWidth };
        return {
          detailBox: { x: detailBox.x, width: detailBox.width },
          settingsBox: { x: settingsBox.x, width: settingsBox.width },
          settlementBox: { x: settlementBox.x, y: settlementBox.y, width: settlementBox.width, height: settlementBox.height },
          diagnosticsBox: { y: diagnosticsBox.y },
          visualBox: { width: visualBox.width },
          metaBox: { width: metaBox.width },
          cycleBox: { y: cycleBox.y },
          costBox: { y: costBox.y },
          inputBox: { y: inputBox.y },
          outputBox: { y: outputBox.y },
          scrollOverflow,
          settlementOverflow,
          diagnosticsOverflow,
          mobileSettlementIndex: [...detailElement.children].findIndex((element) => element.classList.contains('facility-production-formula')),
          mobileDiagnosticsIndex: [...detailElement.children].findIndex((element) => element.classList.contains('facility-operating-diagnostics')),
        };
      });

      for (const box of [geometry.detailBox, geometry.settingsBox, geometry.settlementBox]) {
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      expect(geometry.metaBox.width).toBeLessThan(geometry.visualBox.width - 8);
      expect(Math.abs(geometry.costBox.y - geometry.cycleBox.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.inputBox.y - geometry.outputBox.y)).toBeLessThanOrEqual(1);
      expect(geometry.settlementOverflow.scrollWidth).toBeLessThanOrEqual(geometry.settlementOverflow.clientWidth + 1);
      expect(geometry.diagnosticsOverflow.scrollWidth).toBeLessThanOrEqual(geometry.diagnosticsOverflow.clientWidth + 1);
      expect(geometry.scrollOverflow.scrollWidth).toBeLessThanOrEqual(geometry.scrollOverflow.clientWidth + 1);
      expect(geometry.diagnosticsBox.y).toBeGreaterThanOrEqual(geometry.settlementBox.y + geometry.settlementBox.height + 6);
      expect(geometry.mobileDiagnosticsIndex).toBeGreaterThan(geometry.mobileSettlementIndex);

      await inputSlot.click();
      await expect(page.locator('.market-detail-view')).toHaveAttribute('data-market-product-id', 'steel');
      await page.getByRole('button', { name: '返回上一页面' }).click();
      await expect(page.locator('.facility-cluster-detail-card')).toBeVisible();
      await expect(scroll).toBeVisible();
    }
  });

  test('shows locked production methods as disabled options', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=production-methods-locked');
    await page.locator('.facility-cluster-selector-card').first().click();

    const detail = page.locator('.facility-cluster-detail-card');
    const methodSelect = detail.getByRole('combobox', { name: '机械工厂生产方式' });
    await methodSelect.click();
    const listbox = page.getByRole('listbox', { name: '机械工厂生产方式' });
    const economical = listbox.getByRole('option', { name: '节约生产' });
    await expect(economical).toHaveAttribute('aria-disabled', 'true');
    await expect(economical).toContainText('需要完成');
    await expect(economical).toContainText('工业化学品作业');
    await economical.click({ force: true });
    await expect.poll(async () => page.evaluate(() => (
      window as typeof window & { __productionRecipeRequests?: string[] }
    ).__productionRecipeRequests ?? [])).toEqual([]);
  });
});