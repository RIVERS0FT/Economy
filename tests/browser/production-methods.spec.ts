import { expect, test } from '@playwright/test';

test.describe('factory production methods', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('uses Victoria-style production configuration menus while submitting stable recipe variants', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=production-methods');

    const detail = page.locator('.facility-cluster-detail-card');
    await expect(detail).toContainText('生产设置');
    await expect(detail).toContainText('生产产物');
    await expect(detail).not.toContainText('生产配方');
    await expect(detail).toContainText('作业制度');
    await expect(detail).toContainText('生产结算');
    await expect(detail).toContainText('经营诊断');
    await expect(detail).not.toContainText('下一周期');
    await expect(detail.getByRole('radio')).toHaveCount(0);

    const recipeSelect = detail.getByRole('combobox', { name: '机械工厂生产产物' });
    const methodSelect = detail.getByRole('combobox', { name: '机械工厂生产方式' });
    await expect(recipeSelect).toHaveCount(1);
    await expect(methodSelect).toHaveCount(1);
    await expect(recipeSelect).toHaveAttribute('data-variant', 'production-config');
    await expect(methodSelect).toHaveAttribute('data-variant', 'production-config');
    await expect(recipeSelect).toContainText('机械制造');
    await expect(recipeSelect).toContainText('机械 ×1 · 60s');
    await expect(methodSelect).toContainText('高速生产');
    await expect(methodSelect).toContainText('60s · 成本 12 · 产出 ×1');

    const settings = detail.locator('.facility-production-settings');
    await expect(settings.locator('.ui-rich-select[data-variant="production-config"]')).toHaveCount(2);
    await expect(recipeSelect.locator('[data-product-artwork="machinery"]')).toHaveCount(1);
    await expect(methodSelect.locator('[data-production-method-icon="rapid"]')).toHaveCount(1);
    await expect(settings.locator('select')).toHaveCount(0);

    await recipeSelect.click();
    const recipeListbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
    await expect(recipeListbox).toBeVisible();
    await expect(recipeListbox).toHaveAttribute('data-variant', 'production-config');
    const recipeOption = recipeListbox.getByRole('option', { name: '机械制造' });
    await expect(recipeOption.locator('[data-product-artwork="machinery"]')).toHaveCount(2);
    await expect(recipeOption).toContainText('投入');
    await expect(recipeOption).toContainText('钢材');
    await expect(recipeOption).toContainText('×2');
    await expect(recipeOption).toContainText('产出');
    await expect(recipeOption).toContainText('机械');
    await expect(recipeOption).toContainText('周期 60s');
    await expect(recipeOption).toContainText('成本 12');
    await expect(recipeOption.locator('.ui-rich-select__selected-mark')).toHaveAttribute('data-visible', 'true');
    const [recipeTriggerBox, recipeListboxBox] = await Promise.all([
      recipeSelect.boundingBox(),
      recipeListbox.boundingBox(),
    ]);
    expect(recipeTriggerBox).not.toBeNull();
    expect(recipeListboxBox).not.toBeNull();
    if (!recipeTriggerBox || !recipeListboxBox) throw new Error('生产产物下拉框几何不可用');
    expect(recipeListboxBox.width).toBeGreaterThan(recipeTriggerBox.width + 80);
    const listboxBackground = await recipeListbox.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(listboxBackground).not.toBe('rgb(255, 255, 255)');
    expect(listboxBackground).not.toBe('rgba(0, 0, 0, 0)');
    await page.keyboard.press('Escape');
    await expect(recipeListbox).toHaveCount(0);
    await expect(recipeSelect).toBeFocused();

    await expect(detail.locator('.facility-production-method-summary')).toHaveCount(0);
    await expect(detail.locator('.facility-staffing-meta')).toHaveCount(0);
    await expect(detail.locator('.facility-formula-scope')).toHaveCount(0);
    await expect(detail).not.toContainText('配置切换结果会提示');
    await expect(detail).not.toContainText('1m · 产出 1 · 成本 12');

    const settingsRow = settings.locator('.facility-production-settings-grid');
    await expect(settingsRow).toHaveCount(1);
    const settingsRowStyle = await settingsRow.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        display: style.display,
        justifyContent: style.justifyContent,
        flexWrap: style.flexWrap,
        childFlex: Array.from(element.children).map((child) => {
          const childStyle = getComputedStyle(child);
          return `${childStyle.flexGrow} ${childStyle.flexShrink} ${childStyle.flexBasis}`;
        }),
      };
    });
    expect(settingsRowStyle.display).toBe('flex');
    expect(settingsRowStyle.justifyContent).toBe('flex-start');
    expect(settingsRowStyle.flexWrap).toBe('nowrap');
    expect(settingsRowStyle.childFlex).toEqual(['0 0 auto', '0 0 auto']);
    await expect(detail.locator('.facility-recipe-section')).toHaveCount(0);
    await expect(detail.locator('.facility-production-method-section')).toHaveCount(0);

    const artwork = detail.locator('.facility-detail-artwork-icon');
    await expect(artwork).toHaveCount(1);
    await expect.poll(() => artwork.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('machine-factory');

    const artworkBox = await detail.locator('.facility-detail-artwork').boundingBox();
    expect(artworkBox).not.toBeNull();
    if (!artworkBox) throw new Error('工厂信息纵向插画几何不可用');
    expect(artworkBox.height / artworkBox.width).toBeCloseTo(1.25, 1);

    const sectionOrder = await detail.evaluate((element) => Array.from(element.children).map((child) => child.className));
    const informationIndex = sectionOrder.findIndex((value) => String(value).includes('facility-information'));
    const staffingIndex = sectionOrder.findIndex((value) => String(value).includes('facility-staffing-summary'));
    const settingsIndex = sectionOrder.findIndex((value) => String(value).includes('facility-production-settings'));
    const settlementIndex = sectionOrder.findIndex((value) => String(value).includes('facility-production-formula'));
    const diagnosticsIndex = sectionOrder.findIndex((value) => String(value).includes('facility-operating-diagnostics'));
    expect(informationIndex).toBeGreaterThanOrEqual(0);
    expect(staffingIndex).toBeGreaterThan(informationIndex);
    expect(settingsIndex).toBeGreaterThan(staffingIndex);
    expect(settlementIndex).toBeGreaterThan(settingsIndex);
    expect(diagnosticsIndex).toBeGreaterThan(settlementIndex);

    const staffingStyle = await detail.locator('.facility-staffing-summary').evaluate((element) => {
      const style = getComputedStyle(element);
      return { borderTopWidth: style.borderTopWidth, borderRadius: style.borderRadius };
    });
    expect(Number.parseFloat(staffingStyle.borderTopWidth)).toBeGreaterThan(0);
    expect(staffingStyle.borderRadius).toBe('0px');

    const settlement = detail.locator('.facility-production-formula');
    const formulaTop = settlement.locator('.facility-formula-top');
    const inputSide = settlement.locator('.facility-formula-input-side');
    const formulaMeta = settlement.locator(':scope > .facility-formula-visual > .facility-formula-meta');
    const output = settlement.locator('.facility-formula-output');
    const profit = detail.locator(':scope > .facility-information > .facility-average-profit');
    await expect(inputSide).toHaveCount(1);
    await expect(formulaMeta).toHaveCount(1);
    await expect(output).toHaveCount(1);
    await expect(profit).toHaveCount(1);
    await expect(settlement.locator('.facility-average-profit')).toHaveCount(0);
    await expect(settlement.locator('.facility-formula-visual')).not.toHaveAttribute('aria-hidden', 'true');

    const formulaColumns = await formulaTop.evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    ));
    expect(formulaColumns).toBe(2);

    const [inputSideBox, metaBox, outputBox] = await Promise.all([
      inputSide.boundingBox(),
      formulaMeta.boundingBox(),
      output.boundingBox(),
    ]);
    expect(inputSideBox).not.toBeNull();
    expect(metaBox).not.toBeNull();
    expect(outputBox).not.toBeNull();
    if (!inputSideBox || !metaBox || !outputBox) throw new Error('生产结算几何不可用');
    expect(metaBox.y).toBeGreaterThanOrEqual(Math.max(inputSideBox.y + inputSideBox.height, outputBox.y + outputBox.height) - 1);
    expect(metaBox.x).toBeGreaterThanOrEqual(inputSideBox.x - 1);

    const metaUnits = formulaMeta.locator(':scope > .facility-formula-meta-unit');
    await expect(metaUnits).toHaveCount(2);
    const [cycleBox, costBox] = await Promise.all([
      metaUnits.nth(0).boundingBox(),
      metaUnits.nth(1).boundingBox(),
    ]);
    expect(cycleBox).not.toBeNull();
    expect(costBox).not.toBeNull();
    if (!cycleBox || !costBox) throw new Error('周期成本两行几何不可用');
    expect(Math.abs(costBox.y - cycleBox.y)).toBeLessThanOrEqual(1);
    expect(costBox.x).toBeGreaterThan(cycleBox.x + cycleBox.width - 1);
    const costDividerWidth = await metaUnits.nth(1).evaluate((element) => (
      Number.parseFloat(getComputedStyle(element).borderLeftWidth)
    ));
    expect(costDividerWidth).toBeGreaterThan(0);

    const materialRows = settlement.locator('.facility-formula-item-group');
    const inputMarketButton = settlement.getByRole('button', { name: /^查看钢材市场/ });
    const outputMarketButton = settlement.getByRole('button', { name: /^查看机械市场/ });
    await expect(materialRows).toHaveCount(2);
    await expect(inputMarketButton).toHaveCount(1);
    await expect(outputMarketButton).toHaveCount(1);
    await expect(inputMarketButton).toHaveAttribute('data-ui-interactive', 'surface');
    await expect(settlement.locator('.facility-formula-separator')).toHaveCount(0);
    await expect(settlement.locator('.facility-formula-inventory')).toHaveCount(2);
    await expect(settlement.locator('.facility-formula-input .facility-formula-inventory')).toHaveCount(1);
    await expect(settlement.locator('.facility-formula-output .facility-formula-inventory')).toHaveCount(1);
    await expect(settlement.locator('.product-artwork')).toHaveCount(2);
    await expect(settlement.locator('svg.product-icon')).toHaveCount(0);
    const artworkBackgrounds = await settlement.locator('.product-artwork').evaluateAll((elements) => (
      elements.map((element) => getComputedStyle(element).backgroundImage)
    ));
    expect(artworkBackgrounds.every((background) => background.includes('.png'))).toBe(true);

    const slotStyle = await settlement.locator('.facility-formula-item-group').first().evaluate((element) => {
      const style = getComputedStyle(element);
      const row = element.firstElementChild;
      const children = row ? Array.from(row.children) : [];
      const boxes = children.map((child) => child.getBoundingClientRect().x);
      return {
        backgroundImage: style.backgroundImage,
        borderLeftWidth: style.borderLeftWidth,
        borderRadius: style.borderRadius,
        childCount: children.length,
        ordered: boxes.every((item, index) => index === 0 || item >= boxes[index - 1]),
      };
    });
    expect(slotStyle.backgroundImage).not.toBe('none');
    expect(slotStyle.borderLeftWidth).not.toBe('0px');
    expect(slotStyle.borderRadius).not.toBe('0px');
    expect(slotStyle.childCount).toBe(3);
    expect(slotStyle.ordered).toBe(true);

    await inputMarketButton.focus();
    await expect(inputMarketButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => {
      const state = window as typeof window & { __lastSelectedTab?: string; __lastSelectedAsset?: string };
      return { tab: state.__lastSelectedTab, asset: state.__lastSelectedAsset };
    })).toEqual({ tab: 'market', asset: 'steel' });
    await outputMarketButton.click();
    await expect.poll(() => page.evaluate(() => {
      const state = window as typeof window & { __lastSelectedTab?: string; __lastSelectedAsset?: string };
      return { tab: state.__lastSelectedTab, asset: state.__lastSelectedAsset };
    })).toEqual({ tab: 'market', asset: 'machinery' });

    const flowStyle = await settlement.locator('.facility-formula-progress .progress-track span').evaluate((element) => {
      const style = getComputedStyle(element.parentElement!);
      const arrow = getComputedStyle(element, '::after');
      return {
        trackHeight: Number.parseFloat(style.height),
        arrowContent: arrow.content,
        arrowClipPath: arrow.clipPath,
      };
    });
    expect(flowStyle.trackHeight).toBeGreaterThanOrEqual(8);
    expect(flowStyle.arrowContent).not.toBe('none');
    expect(flowStyle.arrowClipPath).not.toBe('none');

    const profitStyle = await profit.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderTopWidth: style.borderTopWidth,
        borderLeftWidth: style.borderLeftWidth,
        borderRadius: style.borderRadius,
      };
    });
    expect(profitStyle.borderTopWidth).not.toBe('0px');
    expect(profitStyle.borderLeftWidth).toBe('0px');
    expect(profitStyle.borderRadius).toBe('0px');

    await methodSelect.click();
    const methodListbox = page.getByRole('listbox', { name: '机械工厂生产方式' });
    await expect(methodListbox).toBeVisible();
    await expect(methodListbox).toHaveAttribute('data-variant', 'production-config');
    const currentMethod = methodListbox.getByRole('option', { name: '高速生产' });
    await expect(currentMethod.locator('.ui-rich-select__selected-mark')).toHaveAttribute('data-visible', 'true');
    const economical = methodListbox.getByRole('option', { name: '节约生产' });
    await expect(economical).toContainText('周期 180s ↑');
    await expect(economical).toContainText('成本 4 ↓');
    await expect(economical).toContainText('产出 ×1');
    await expect(economical).toContainText('投入');
    await expect(economical).toContainText('钢材');
    await expect(economical.locator('.production-config-metric.is-negative')).toContainText('周期 180s ↑');
    await expect(economical.locator('.production-config-metric.is-positive')).toContainText('成本 4 ↓');
    const highYield = methodListbox.getByRole('option', { name: '高产生产' });
    await expect(highYield).toContainText('产出 ×2 ↑');
    await expect(highYield.locator('.production-config-metric.is-positive')).toContainText('产出 ×2 ↑');
    await economical.click();
    await expect(methodSelect).toContainText('节约生产');
    await expect(methodSelect).toContainText('180s · 成本 4 · 产出 ×1');
    await expect(formulaMeta).toContainText('3m');
    await expect.poll(async () => page.evaluate(() => (
      window as typeof window & { __productionRecipeRequests?: string[] }
    ).__productionRecipeRequests ?? [])).toEqual([
      'machine-factory:machinery-recipe--economical',
    ]);
  });

  test('keeps mobile production controls, settlement, and diagnostics in one non-overlapping detail flow', async ({ page }) => {
    for (const width of [320, 360, 390, 430, 720]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('runtime-test.html?view=production&scenario=production-methods');

      await page.locator('.facility-cluster-selector-card').first().click();
      const dialogLayer = page.locator('.workspace-dialog-layer');
      const sheet = page.locator('.mobile-detail-sheet');
      const scroll = sheet.locator('.mobile-detail-sheet-scroll');
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('.facility-detail-artwork-icon')).toHaveCount(1);
      await expect.poll(() => sheet.locator('.facility-detail-artwork-icon').evaluate((element) => (
        getComputedStyle(element).backgroundImage
      ))).toContain('machine-factory');
      await expect(sheet.locator('.facility-staffing-track')).toBeVisible();
      await expect(sheet.locator('.facility-staffing-fill')).toBeVisible();

      await expect(sheet.locator('.mobile-detail-sheet-header > :not(.mobile-detail-sheet-drag-handle)')).toHaveCount(0);
      await expect(sheet.locator('.facility-information')).toHaveCount(1);
      await expect(sheet.locator('.facility-information .facility-average-profit')).toHaveCount(1);
      await expect(sheet.locator('.facility-production-formula .facility-average-profit')).toHaveCount(0);
      const mobileArtworkBox = await sheet.locator('.facility-detail-artwork').boundingBox();
      expect(mobileArtworkBox).not.toBeNull();
      if (!mobileArtworkBox) throw new Error(`移动工厂信息纵向插画几何不可用: ${width}px`);
      expect(mobileArtworkBox.height / mobileArtworkBox.width).toBeCloseTo(1.25, 1);
      await expect(sheet.locator('.facility-production-method-summary')).toHaveCount(0);
      await expect(sheet.locator('.facility-staffing-meta')).toHaveCount(0);
      await expect(sheet.locator('.facility-formula-scope')).toHaveCount(0);
      await expect(sheet).not.toContainText('缩短周期并提高成本');

      const mobileSectionOrder = await scroll.evaluate((element) => Array.from(element.children).map((child) => child.className));
      const mobileSettlementIndex = mobileSectionOrder.findIndex((value) => String(value).includes('facility-production-formula'));
      const mobileDiagnosticsIndex = mobileSectionOrder.findIndex((value) => String(value).includes('facility-operating-diagnostics'));
      expect(mobileSettlementIndex).toBeGreaterThanOrEqual(0);
      expect(mobileDiagnosticsIndex).toBeGreaterThan(mobileSettlementIndex);

      const recipeSelect = sheet.getByRole('combobox', { name: '机械工厂生产产物' });
      const methodSelect = sheet.getByRole('combobox', { name: '机械工厂生产方式' });
      await expect(recipeSelect).toHaveAttribute('data-variant', 'production-config');
      await expect(methodSelect).toHaveAttribute('data-variant', 'production-config');
      const [recipeBox, methodBox] = await Promise.all([
        recipeSelect.boundingBox(),
        methodSelect.boundingBox(),
      ]);
      expect(recipeBox).not.toBeNull();
      expect(methodBox).not.toBeNull();
      if (!recipeBox || !methodBox) throw new Error('移动生产设置几何不可用');
      expect(Math.abs(recipeBox.y - methodBox.y)).toBeLessThanOrEqual(1);
      expect(methodBox.x).toBeGreaterThan(recipeBox.x + recipeBox.width - 1);

      const settlement = sheet.locator('.facility-production-formula');
      const visual = settlement.locator('.facility-formula-visual');
      const inputSlot = settlement.locator('.facility-formula-input .facility-formula-item-group').first();
      const outputSlot = settlement.locator('.facility-formula-output .facility-formula-item-group').first();
      const formulaMeta = settlement.locator('.facility-formula-meta');
      const progress = settlement.locator('.facility-formula-progress');
      const metaUnits = formulaMeta.locator(':scope > .facility-formula-meta-unit');
      const diagnostics = sheet.locator('.facility-operating-diagnostics');
      const [visualBox, inputBox, outputBox, metaBox, progressBox, cycleBox, costBox, settlementBox, diagnosticsBox] = await Promise.all([
        visual.boundingBox(),
        inputSlot.boundingBox(),
        outputSlot.boundingBox(),
        formulaMeta.boundingBox(),
        progress.boundingBox(),
        metaUnits.nth(0).boundingBox(),
        metaUnits.nth(1).boundingBox(),
        settlement.boundingBox(),
        diagnostics.boundingBox(),
      ]);
      expect(visualBox).not.toBeNull();
      expect(inputBox).not.toBeNull();
      expect(outputBox).not.toBeNull();
      expect(metaBox).not.toBeNull();
      expect(progressBox).not.toBeNull();
      expect(cycleBox).not.toBeNull();
      expect(costBox).not.toBeNull();
      expect(settlementBox).not.toBeNull();
      expect(diagnosticsBox).not.toBeNull();
      if (!visualBox || !inputBox || !outputBox || !metaBox || !progressBox || !cycleBox || !costBox || !settlementBox || !diagnosticsBox) {
        throw new Error(`移动生产详情几何不可用: ${width}px`);
      }
      expect(Math.abs(inputBox.y - outputBox.y)).toBeLessThanOrEqual(1);
      expect(metaBox.y).toBeGreaterThanOrEqual(Math.max(inputBox.y + inputBox.height, outputBox.y + outputBox.height) - 1);
      expect(Math.abs(metaBox.x - visualBox.x)).toBeLessThanOrEqual(1);
      expect(metaBox.width).toBeLessThan(visualBox.width - 8);
      expect(progressBox.y).toBeGreaterThanOrEqual(
        Math.max(metaBox.y + metaBox.height, outputBox.y + outputBox.height) - 1,
      );
      expect(Math.abs(costBox.y - cycleBox.y)).toBeLessThanOrEqual(1);
      expect(costBox.x).toBeGreaterThan(cycleBox.x + cycleBox.width - 1);
      expect(diagnosticsBox.y).toBeGreaterThanOrEqual(settlementBox.y + settlementBox.height + 6);
      expect(await metaUnits.nth(1).evaluate((element) => (
        Number.parseFloat(getComputedStyle(element).borderLeftWidth)
      ))).toBeGreaterThan(0);

      await expect(inputSlot).toHaveAttribute('data-ui-interactive', 'surface');
      await expect(inputSlot).toHaveAttribute('aria-label', /^查看钢材市场/);
      await inputSlot.click();
      await expect.poll(() => page.evaluate(() => {
        const state = window as typeof window & { __lastSelectedTab?: string; __lastSelectedAsset?: string };
        return { tab: state.__lastSelectedTab, asset: state.__lastSelectedAsset };
      })).toEqual({ tab: 'market', asset: 'steel' });
      await expect(sheet).toBeVisible();
      await expect(sheet).not.toHaveClass(/is-dragging/);

      const settlementOverflow = await settlement.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(settlementOverflow.scrollWidth).toBeLessThanOrEqual(settlementOverflow.clientWidth + 1);
      const diagnosticsOverflow = await diagnostics.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(diagnosticsOverflow.scrollWidth).toBeLessThanOrEqual(diagnosticsOverflow.clientWidth + 1);
      const scrollOverflow = await scroll.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(scrollOverflow.scrollWidth).toBeLessThanOrEqual(scrollOverflow.clientWidth + 1);

      const metrics = diagnostics.locator('.facility-operating-diagnostics__metrics');
      expect(await metrics.evaluate((element) => (
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
      ))).toBe(2);
      const metricBoxes = await metrics.locator(':scope > div').evaluateAll((elements) => elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }));
      expect(metricBoxes).toHaveLength(4);
      expect(Math.abs(metricBoxes[0].y - metricBoxes[1].y)).toBeLessThanOrEqual(1);
      expect(Math.abs(metricBoxes[2].y - metricBoxes[3].y)).toBeLessThanOrEqual(1);
      expect(metricBoxes[2].y).toBeGreaterThanOrEqual(metricBoxes[0].y + metricBoxes[0].height - 1);
      expect(metricBoxes[3].y).toBeGreaterThanOrEqual(metricBoxes[1].y + metricBoxes[1].height - 1);
      const metricStyle = await metrics.locator(':scope > div').first().evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          borderWidth: Number.parseFloat(style.borderLeftWidth),
          borderRadius: style.borderRadius,
          backgroundColor: style.backgroundColor,
        };
      });
      expect(metricStyle.borderWidth).toBeGreaterThan(0);
      expect(metricStyle.borderRadius).not.toBe('0px');
      expect(metricStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

      const diagnosticArtworkSizes = await diagnostics.locator('.product-artwork').evaluateAll((elements) => elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }));
      expect(diagnosticArtworkSizes.length).toBeGreaterThan(0);
      expect(diagnosticArtworkSizes.every((box) => Math.abs(box.width - 28) <= 1 && Math.abs(box.height - 28) <= 1)).toBe(true);

      const helper = diagnostics.locator('.ui-helper-text');
      await helper.scrollIntoViewIfNeeded();
      const [helperBox, footerBox] = await Promise.all([
        helper.boundingBox(),
        sheet.locator('.mobile-detail-sheet-footer').boundingBox(),
      ]);
      expect(helperBox).not.toBeNull();
      expect(footerBox).not.toBeNull();
      if (!helperBox || !footerBox) throw new Error(`移动经营诊断底部几何不可用: ${width}px`);
      expect(helperBox.y + helperBox.height).toBeLessThanOrEqual(footerBox.y + 1);

      await recipeSelect.click();
      const listbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
      await expect(listbox).toBeVisible();
      await expect(listbox).toHaveAttribute('data-variant', 'production-config');
      await expect(dialogLayer.locator(':scope > .ui-rich-select__listbox')).toHaveCount(1);
      const box = await listbox.boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error('移动生产产物下拉框几何不可用');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
      expect(box.width).toBeGreaterThan(recipeBox.width + 40);
      await expect(listbox.locator('[data-product-artwork="machinery"]')).toHaveCount(2);
      await expect(listbox.getByRole('option', { name: '机械制造' })).toContainText('周期 60s');
      await page.keyboard.press('Escape');
      await expect(listbox).toHaveCount(0);
      await expect(recipeSelect).toBeFocused();

      await methodSelect.click();
      const methodListbox = page.getByRole('listbox', { name: '机械工厂生产方式' });
      await expect(methodListbox).toBeVisible();
      const methodBoxOpen = await methodListbox.boundingBox();
      expect(methodBoxOpen).not.toBeNull();
      if (!methodBoxOpen) throw new Error('移动作业制度下拉框几何不可用');
      expect(methodBoxOpen.x).toBeGreaterThanOrEqual(0);
      expect(methodBoxOpen.x + methodBoxOpen.width).toBeLessThanOrEqual(width);
      await expect(methodListbox.getByRole('option', { name: '节约生产' })).toContainText('成本 4 ↓');
      await page.keyboard.press('Escape');
    }
  });
});
