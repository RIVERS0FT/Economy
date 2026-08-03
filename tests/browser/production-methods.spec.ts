import { expect, test } from '@playwright/test';

test.describe('factory production methods', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('uses product artwork and unified rich selects while submitting stable recipe variants', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=production-methods');

    const detail = page.locator('.facility-cluster-detail-card');
    await expect(detail).toContainText('生产设置');
    await expect(detail).toContainText('生产产物');
    await expect(detail).not.toContainText('生产配方');
    await expect(detail).toContainText('作业制度');
    await expect(detail).toContainText('生产结算');
    await expect(detail).not.toContainText('下一周期');
    await expect(detail.getByRole('radio')).toHaveCount(0);

    const recipeSelect = detail.getByRole('combobox', { name: '机械工厂生产产物' });
    const methodSelect = detail.getByRole('combobox', { name: '机械工厂生产方式' });
    await expect(recipeSelect).toHaveCount(1);
    await expect(methodSelect).toHaveCount(1);
    await expect(methodSelect).toContainText('高速生产');

    const settings = detail.locator('.facility-production-settings');
    await expect(settings.locator('.ui-rich-select')).toHaveCount(2);
    await expect(recipeSelect.locator('[data-product-artwork="machinery"]')).toHaveCount(1);
    await expect(methodSelect.locator('[data-production-method-icon="rapid"]')).toHaveCount(1);
    await expect(settings.locator('select')).toHaveCount(0);

    await recipeSelect.click();
    const recipeListbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
    await expect(recipeListbox).toBeVisible();
    const recipeOption = recipeListbox.getByRole('option', { name: '机械制造' });
    await expect(recipeOption.locator('[data-product-artwork="machinery"]')).toHaveCount(1);
    const [recipeTriggerBox, recipeListboxBox] = await Promise.all([
      recipeSelect.boundingBox(),
      recipeListbox.boundingBox(),
    ]);
    expect(recipeTriggerBox).not.toBeNull();
    expect(recipeListboxBox).not.toBeNull();
    if (!recipeTriggerBox || !recipeListboxBox) throw new Error('生产产物下拉框几何不可用');
    expect(Math.abs(recipeTriggerBox.width - recipeListboxBox.width)).toBeLessThanOrEqual(1);
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

    await expect(settings.locator('.facility-production-settings-grid')).toHaveCount(1);
    expect(await settings.locator('.facility-production-settings-grid').evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    ))).toBe(2);
    await expect(detail.locator('.facility-recipe-section')).toHaveCount(0);
    await expect(detail.locator('.facility-production-method-section')).toHaveCount(0);

    const artwork = detail.locator('.facility-detail-artwork-icon');
    await expect(artwork).toHaveCount(1);
    await expect.poll(() => artwork.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('machine-factory');

    const staffingStyle = await detail.locator('.facility-staffing-summary').evaluate((element) => {
      const style = getComputedStyle(element);
      return { borderTopWidth: style.borderTopWidth, borderRadius: style.borderRadius };
    });
    expect(staffingStyle.borderTopWidth).toBe('0px');
    expect(staffingStyle.borderRadius).toBe('0px');

    const settlement = detail.locator('.facility-production-formula');
    const formulaTop = settlement.locator('.facility-formula-top');
    const inputSide = settlement.locator('.facility-formula-input-side');
    const formulaMeta = settlement.locator(':scope > .facility-formula-visual > .facility-formula-meta');
    const output = settlement.locator('.facility-formula-output');
    const profit = settlement.locator('.facility-average-profit');
    await expect(inputSide).toHaveCount(1);
    await expect(formulaMeta).toHaveCount(1);
    await expect(output).toHaveCount(1);
    await expect(profit).toHaveCount(1);

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
    await expect(materialRows).toHaveCount(2);
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
    await methodListbox.getByRole('option', { name: '节约生产' }).click();
    await expect.poll(async () => page.evaluate(() => (
      window as typeof window & { __productionRecipeRequests?: string[] }
    ).__productionRecipeRequests ?? [])).toEqual([
      'machine-factory:machinery-recipe--economical',
    ]);
  });

  test('keeps mobile production controls and settlement aligned inside the top dialog layer', async ({ page }) => {
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('runtime-test.html?view=production&scenario=production-methods');

    await page.locator('.facility-cluster-selector-card').first().click();
    const dialogLayer = page.locator('.workspace-dialog-layer');
    const sheet = page.locator('.facility-detail-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.facility-detail-artwork-icon')).toHaveCount(1);
    await expect.poll(() => sheet.locator('.facility-detail-artwork-icon').evaluate((element) => (
      getComputedStyle(element).backgroundImage
    ))).toContain('machine-factory');
    await expect(sheet.locator('.facility-staffing-track')).toBeVisible();
    await expect(sheet.locator('.facility-staffing-fill')).toBeVisible();
    await expect(sheet.locator('.facility-production-method-summary')).toHaveCount(0);
    await expect(sheet.locator('.facility-staffing-meta')).toHaveCount(0);
    await expect(sheet.locator('.facility-formula-scope')).toHaveCount(0);
    await expect(sheet).not.toContainText('缩短周期并提高成本');

    const recipeSelect = sheet.getByRole('combobox', { name: '机械工厂生产产物' });
    const methodSelect = sheet.getByRole('combobox', { name: '机械工厂生产方式' });
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
    const inputSlot = settlement.locator('.facility-formula-input .facility-formula-item-group').first();
    const outputSlot = settlement.locator('.facility-formula-output .facility-formula-item-group').first();
    const formulaMeta = settlement.locator('.facility-formula-meta');
    const progress = settlement.locator('.facility-formula-progress');
    const metaUnits = formulaMeta.locator(':scope > .facility-formula-meta-unit');
    const [inputBox, outputBox, metaBox, progressBox, cycleBox, costBox] = await Promise.all([
      inputSlot.boundingBox(),
      outputSlot.boundingBox(),
      formulaMeta.boundingBox(),
      progress.boundingBox(),
      metaUnits.nth(0).boundingBox(),
      metaUnits.nth(1).boundingBox(),
    ]);
    expect(inputBox).not.toBeNull();
    expect(outputBox).not.toBeNull();
    expect(metaBox).not.toBeNull();
    expect(progressBox).not.toBeNull();
    expect(cycleBox).not.toBeNull();
    expect(costBox).not.toBeNull();
    if (!inputBox || !outputBox || !metaBox || !progressBox || !cycleBox || !costBox) {
      throw new Error(`移动生产结算几何不可用: ${width}px`);
    }
    expect(Math.abs(inputBox.y - outputBox.y)).toBeLessThanOrEqual(1);
    expect(metaBox.y).toBeGreaterThanOrEqual(Math.max(inputBox.y + inputBox.height, outputBox.y + outputBox.height) - 1);
    expect(progressBox.y).toBeGreaterThanOrEqual(
      Math.max(metaBox.y + metaBox.height, outputBox.y + outputBox.height) - 1,
    );
    expect(Math.abs(costBox.y - cycleBox.y)).toBeLessThanOrEqual(1);
    expect(costBox.x).toBeGreaterThan(cycleBox.x + cycleBox.width - 1);
    expect(await metaUnits.nth(1).evaluate((element) => (
      Number.parseFloat(getComputedStyle(element).borderLeftWidth)
    ))).toBeGreaterThan(0);
    const settlementOverflow = await settlement.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(settlementOverflow.scrollWidth).toBeLessThanOrEqual(settlementOverflow.clientWidth + 1);

    await recipeSelect.click();
    const listbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
    await expect(listbox).toBeVisible();
    await expect(dialogLayer.locator(':scope > .ui-rich-select__listbox')).toHaveCount(1);
    const box = await listbox.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error('移动生产产物下拉框几何不可用');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await expect(listbox.locator('[data-product-artwork="machinery"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(listbox).toHaveCount(0);
    await expect(recipeSelect).toBeFocused();
    }
  });
});
