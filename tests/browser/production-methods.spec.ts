import { expect, test } from '@playwright/test';

test.describe('factory production methods', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('previews the pending method and submits the selected stable recipe variant', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=production-methods');

    const detail = page.locator('.facility-cluster-detail-card');
    await expect(detail).toContainText('生产设置');
    await expect(detail).toContainText('作业制度');
    await expect(detail).toContainText('生产结算');
    await expect(detail).toContainText('下一周期切换为：机械制造 · 高速生产');
    await expect(detail.getByRole('radio')).toHaveCount(0);

    const recipeSelect = detail.getByRole('combobox', { name: '机械工厂生产配方' });
    const methodSelect = detail.getByRole('combobox', { name: '机械工厂生产方式' });
    await expect(recipeSelect).toHaveCount(1);
    await expect(methodSelect).toHaveCount(1);
    await expect(methodSelect).toHaveValue('rapid');

    const summary = detail.locator('.facility-production-method-summary');
    await expect(summary.locator('strong')).toHaveCount(0);
    await expect(summary).not.toContainText('高速生产');
    await expect(summary).toContainText('1m · 产出 1 · 成本 12');
    await expect(summary).toContainText('缩短周期并提高成本');

    const settings = detail.locator('.facility-production-settings');
    await expect(settings.locator('.facility-production-settings-grid')).toHaveCount(1);
    expect(await settings.locator('.facility-production-settings-grid').evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    ))).toBe(2);
    await expect(detail.locator('.facility-recipe-section')).toHaveCount(0);
    await expect(detail.locator('.facility-production-method-section')).toHaveCount(0);

    const staffingStyle = await detail.locator('.facility-staffing-summary').evaluate((element) => {
      const style = getComputedStyle(element);
      return { borderTopWidth: style.borderTopWidth, borderRadius: style.borderRadius };
    });
    expect(staffingStyle.borderTopWidth).toBe('0px');
    expect(staffingStyle.borderRadius).toBe('0px');

    const settlement = detail.locator('.facility-production-formula');
    const formulaTop = settlement.locator('.facility-formula-top');
    const inputSide = settlement.locator('.facility-formula-input-side');
    const formulaMeta = inputSide.locator(':scope > .facility-formula-meta');
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
    expect(metaBox.x).toBeGreaterThanOrEqual(inputSideBox.x - 1);
    expect(metaBox.x + metaBox.width).toBeLessThanOrEqual(inputSideBox.x + inputSideBox.width + 1);
    expect(metaBox.x + metaBox.width).toBeLessThan(outputBox.x);

    const slotStyle = await settlement.locator('.facility-formula-item-group').first().evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundImage: style.backgroundImage,
        borderLeftWidth: style.borderLeftWidth,
        borderRadius: style.borderRadius,
      };
    });
    expect(slotStyle.backgroundImage).not.toBe('none');
    expect(slotStyle.borderLeftWidth).not.toBe('0px');
    expect(slotStyle.borderRadius).not.toBe('0px');

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

    await methodSelect.selectOption('economical');
    await expect.poll(async () => page.evaluate(() => (
      window as typeof window & { __productionRecipeRequests?: string[] }
    ).__productionRecipeRequests ?? [])).toEqual([
      'machine-factory:machinery-recipe--economical',
    ]);
  });
});
