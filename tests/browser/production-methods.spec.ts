import { expect, test } from '@playwright/test';

test.describe('factory production methods', () => {
  test('renders compact selectors and switches the active recipe immediately', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=production-methods');
    await page.getByRole('button', { name: /机械工厂，/ }).first().click();

    const detail = page.locator('.facility-cluster-detail-card');
    await expect(detail).toBeVisible();
    await expect(page.locator('.mobile-workspace-sheet-host')).toHaveCount(0);
    const formula = detail.locator('.facility-production-formula');
    const productionSettings = detail.locator('.facility-production-settings');
    const informationMain = detail.locator('.facility-information-summary .mobile-detail-summary__main');
    const recipeSelect = productionSettings.getByRole('combobox', { name: '机械工厂生产产物' });
    const methodSelect = productionSettings.getByRole('combobox', { name: '机械工厂生产方式' });
    const inputSlot = formula.getByRole('button', { name: /^查看钢材本地商品详情/ });
    const outputSlot = formula.getByRole('button', { name: /^查看机械本地商品详情/ });

    await expect(productionSettings).not.toContainText('生产设置');
    await expect(informationMain.locator('.facility-count-summary')).toBeVisible();
    await expect(informationMain.locator('.facility-average-profit')).toBeVisible();
    await expect(informationMain.locator('.facility-staffing-summary')).toBeVisible();
    await expect(informationMain).toContainText('运行中');
    await expect(informationMain).toContainText('冻结中');
    await expect(informationMain).not.toContainText('抵押中');
    await expect(informationMain).toContainText('单厂平均利润／分钟');
    await expect(informationMain).toContainText('满员率');
    await expect(informationMain.locator('.facility-average-profit__copy small')).toHaveCount(0);
    const summaryRows = await informationMain.locator('.facility-information-details').evaluate((element) => {
      const count = element.querySelector<HTMLElement>('.facility-count-summary');
      const profit = element.querySelector<HTMLElement>('.facility-average-profit');
      const staffing = element.querySelector<HTMLElement>('.facility-staffing-summary');
      if (!count || !profit || !staffing) throw new Error('facility summary rows are incomplete');
      const countBox = count.getBoundingClientRect();
      const profitBox = profit.getBoundingClientRect();
      const staffingBox = staffing.getBoundingClientRect();
      return {
        count: { top: countBox.top, bottom: countBox.bottom },
        profit: { top: profitBox.top, bottom: profitBox.bottom },
        staffing: { top: staffingBox.top, bottom: staffingBox.bottom },
      };
    });
    expect(summaryRows.profit.top).toBeGreaterThanOrEqual(summaryRows.count.bottom);
    expect(summaryRows.staffing.top).toBeGreaterThanOrEqual(summaryRows.profit.bottom);
    await expect(productionSettings.locator('.facility-production-method-summary')).toHaveCount(0);
    await expect(recipeSelect).toHaveAttribute('data-variant', 'production-config');
    await expect(methodSelect).toHaveAttribute('data-variant', 'production-config');
    await expect(recipeSelect.locator('[data-product-artwork="machinery"]')).toHaveCount(1);
    await expect(methodSelect.locator('[data-production-method-icon="precision-machine"]')).toHaveCount(1);
    await expect(detail).not.toContainText('下一周期');
    await expect(detail).not.toContainText('精密机加并加快工序周转');

    await recipeSelect.click();
    const recipeListbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
    await expect(recipeListbox).toBeVisible();
    const recipeTriggerBox = await recipeSelect.boundingBox();
    const recipeListboxBox = await recipeListbox.boundingBox();
    expect(recipeTriggerBox).not.toBeNull();
    expect(recipeListboxBox).not.toBeNull();
    if (!recipeTriggerBox || !recipeListboxBox) throw new Error('production select geometry is unavailable');
    expect(recipeListboxBox.width).toBeGreaterThan(recipeTriggerBox.width + 80);
    await expect(recipeListbox.getByRole('option', { name: '机械制造' })).toContainText('周期 60s');
    await page.keyboard.press('Escape');

    await methodSelect.click();
    const methodListbox = page.getByRole('listbox', { name: '机械工厂生产方式' });
    const cellular = methodListbox.getByRole('option', { name: '单元制造' });
    await expect(cellular).toContainText('周期 180s');
    await expect(cellular).toContainText('成本 4');
    await expect(cellular.locator('[data-production-method-icon="factory-cell"]')).toHaveCount(1);
    await expect(cellular.locator('.production-config-metric-chevron')).toHaveCount(2);
    await expect(cellular).toContainText('产出 ×1');
    await cellular.click();

    await expect.poll(async () => page.evaluate(() => (
      window as typeof window & { __productionRecipeRequests?: string[] }
    ).__productionRecipeRequests ?? [])).toEqual([
      'machine-factory:machinery-recipe--cellular-manufacturing',
    ]);
    await expect(methodSelect).toContainText('单元制造');
    await expect(methodSelect).toContainText('180s · 成本 4 · 产出 ×1');
    await expect.poll(() => formula.getAttribute('aria-label'))
      .toContain('每3m消耗18 钢材，产出9 机械，成本36.00');
    await expect(formula).not.toContainText('下一周期');

    const settlement = detail.locator('.facility-production-formula');
    await expect(settlement.locator('svg.product-icon')).toHaveCount(0);
    await expect(settlement.locator('.product-artwork')).toHaveCount(2);
    await expect(settlement.locator('.facility-formula-separator')).toHaveCount(0);
    await expect(inputSlot).toBeVisible();
    await expect(outputSlot).toBeVisible();

    const transitions = await formula.locator('.facility-formula-progress').evaluate((element) => {
      const track = element.querySelector<HTMLElement>('.progress-track');
      const fill = element.querySelector<HTMLElement>('.progress-track > span');
      return {
        trackTransition: track ? getComputedStyle(track).transition : '',
        trackBorderRadius: track ? getComputedStyle(track).borderRadius : '',
        fillTransition: fill ? getComputedStyle(fill).transition : '',
        fillBorderRadius: fill ? getComputedStyle(fill).borderRadius : '',
        arrowClipPath: fill ? getComputedStyle(fill, '::after').clipPath : '',
      };
    });
    expect(transitions.trackTransition).toBe('all');
    expect(transitions.trackBorderRadius).not.toBe('0px');
    expect(transitions.fillTransition).toContain('width');
    expect(transitions.fillBorderRadius).toBe(transitions.trackBorderRadius);
    expect(transitions.arrowClipPath).toBe('none');

    await expect(detail.getByRole('button', { name: /交易该建筑资产/ })).toHaveCount(0);

    async function resetMarketIntent() {
      await page.evaluate(() => {
        Object.assign(window, { __lastSelectedAsset: '', __lastSelectedTab: '' });
      });
    }

    async function expectProductMarketIntent(productId: string) {
      await expect.poll(() => page.evaluate(() => (
        window as typeof window & { __lastSelectedAsset?: string }
      ).__lastSelectedAsset ?? '')).toBe(productId);
      await expect.poll(() => page.evaluate(() => (
        window as typeof window & { __lastSelectedTab?: string }
      ).__lastSelectedTab ?? '')).toBe('market');
    }

    await resetMarketIntent();
    await inputSlot.click();
    await expectProductMarketIntent('steel');

    await resetMarketIntent();
    await outputSlot.click();
    await expectProductMarketIntent('machinery');
  });

  for (const width of [320, 360, 390, 430, 720]) {
    test(`keeps mobile production controls and settlement in one non-overlapping page detail flow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('runtime-test.html?view=production&scenario=production-methods');
      await page.getByRole('button', { name: /机械工厂，/ }).first().click();

      const detail = page.locator('.facility-cluster-detail-card');
      const scroll = page.locator('.page-card-scroll');
      const workspaceHost = page.locator('.mobile-workspace-sheet-host');
      await expect(detail).toBeVisible();
      await expect(workspaceHost).toHaveCount(1);
      await expect(workspaceHost).toHaveAttribute('data-detail-active', 'false');
      await expect(workspaceHost.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);
      const productionSettings = detail.locator('.facility-production-settings');
      const informationMain = detail.locator('.facility-information-summary .mobile-detail-summary__main');
      const recipeSelect = productionSettings.getByRole('combobox', { name: '机械工厂生产产物' });
      const methodSelect = productionSettings.getByRole('combobox', { name: '机械工厂生产方式' });
      const settlement = detail.locator('.facility-production-formula');
      const diagnostics = detail.locator('.facility-operating-diagnostics');
      const inputSlot = settlement.getByRole('button', { name: /^查看钢材本地商品详情/ });
      const outputSlot = settlement.getByRole('button', { name: /^查看机械本地商品详情/ });

      await expect(productionSettings).not.toContainText('生产设置');
      await expect(informationMain.locator('.facility-count-summary')).toBeVisible();
      await expect(informationMain.locator('.facility-average-profit')).toBeVisible();
      await expect(informationMain.locator('.facility-staffing-summary')).toBeVisible();
      await expect(informationMain.locator('.facility-average-profit__copy small')).toHaveCount(0);
      const mobileSummaryRows = await informationMain.locator('.facility-information-details').evaluate((element) => {
        const count = element.querySelector<HTMLElement>('.facility-count-summary');
        const profit = element.querySelector<HTMLElement>('.facility-average-profit');
        const staffing = element.querySelector<HTMLElement>('.facility-staffing-summary');
        if (!count || !profit || !staffing) throw new Error('mobile facility summary rows are incomplete');
        const countBox = count.getBoundingClientRect();
        const profitBox = profit.getBoundingClientRect();
        const staffingBox = staffing.getBoundingClientRect();
        return { countBottom: countBox.bottom, profitTop: profitBox.top, profitBottom: profitBox.bottom, staffingTop: staffingBox.top };
      });
      expect(mobileSummaryRows.profitTop).toBeGreaterThanOrEqual(mobileSummaryRows.countBottom);
      expect(mobileSummaryRows.staffingTop).toBeGreaterThanOrEqual(mobileSummaryRows.profitBottom);
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

      await page.evaluate(() => {
        Object.assign(window, { __lastSelectedAsset: '', __lastSelectedTab: '' });
      });
      await inputSlot.click();
      await expect.poll(() => page.evaluate(() => (
        window as typeof window & { __lastSelectedAsset?: string }
      ).__lastSelectedAsset ?? '')).toBe('steel');
      await expect.poll(() => page.evaluate(() => (
        window as typeof window & { __lastSelectedTab?: string }
      ).__lastSelectedTab ?? '')).toBe('market');
      await expect(detail).toBeVisible();
      await expect(scroll).toBeVisible();
    });
  }
});
