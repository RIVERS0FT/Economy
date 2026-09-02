import { expect, test } from '@playwright/test';

test('independent contract cards keep object boundaries and warning tint', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=contracts');
  await expect(page.getByRole('heading', { name: '合同', exact: true })).toBeVisible();

  const attentionCard = page.locator('.contract-active-grid .contract-card--attention').first();
  const normalCard = page.locator('.contract-active-grid .contract-card--normal').first();
  const summaryMetric = page.locator('.contract-summary-grid .ui-metric-card').first();
  await expect(attentionCard).toBeVisible();
  await expect(normalCard).toBeVisible();
  await expect(summaryMetric).toBeVisible();

  const attentionStyle = await attentionCard.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundImage: style.backgroundImage,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      backdropFilter: style.backdropFilter,
    };
  });
  const normalStyle = await normalCard.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      backdropFilter: style.backdropFilter,
    };
  });
  const summaryStyle = await summaryMetric.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      borderTopWidth: style.borderTopWidth,
    };
  });

  expect(normalStyle.borderRadius).not.toBe('0px');
  expect(normalStyle.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(normalStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(normalStyle.backgroundImage).toBe('none');
  expect(normalStyle.backdropFilter).toBe('none');

  expect(attentionStyle.backgroundImage).toContain('linear-gradient');
  expect(attentionStyle.backgroundImage).toContain('rgba(242, 197, 104, 0.08)');
  expect(attentionStyle.backgroundImage).not.toBe(normalStyle.backgroundImage);
  expect(attentionStyle.borderColor).toBe('rgb(242, 197, 104)');
  expect(attentionStyle.borderRadius).toBe(normalStyle.borderRadius);
  expect(attentionStyle.backdropFilter).toBe('none');

  expect(summaryStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(summaryStyle.borderRadius).toBe('0px');
  expect(summaryStyle.borderTopWidth).toBe('0px');
});
