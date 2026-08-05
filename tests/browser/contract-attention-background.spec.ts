import { expect, test } from '@playwright/test';

test('pending contract card keeps warning tint over panel material', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=contracts');
  await expect(page.getByRole('heading', { name: '合同', exact: true })).toBeVisible();

  const attentionCard = page.locator('.contract-active-grid .contract-card--attention').first();
  const normalCard = page.locator('.contract-active-grid .contract-card--normal').first();
  await expect(attentionCard).toBeVisible();
  await expect(normalCard).toBeVisible();

  const attentionStyle = await attentionCard.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundImage: style.backgroundImage,
      borderColor: style.borderColor,
    };
  });
  const normalStyle = await normalCard.evaluate((element) => ({
    backgroundImage: getComputedStyle(element).backgroundImage,
  }));

  expect(attentionStyle.backgroundImage).toContain('linear-gradient');
  expect(attentionStyle.backgroundImage).toContain('rgba(242, 197, 104, 0.08)');
  expect(attentionStyle.backgroundImage).not.toBe(normalStyle.backgroundImage);
  expect(attentionStyle.borderColor).toBe('rgb(242, 197, 104)');
});
