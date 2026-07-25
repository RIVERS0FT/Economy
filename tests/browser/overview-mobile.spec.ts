import { expect, test } from '@playwright/test';

test('mobile overview keeps all seven check-in days on one row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  const panel = page.locator('.overview-check-in-panel');
  const calendar = page.getByRole('list', { name: '本周签到日历' });
  const days = calendar.getByRole('listitem');

  await expect(panel).toBeVisible();
  await expect(days).toHaveCount(7);
  await expect(page.getByRole('button', { name: '签到领取 1 宝石' })).toBeVisible();

  const gridColumns = await calendar.evaluate((element) => getComputedStyle(element).gridTemplateColumns
    .split(' ')
    .filter(Boolean)
    .length);
  expect(gridColumns).toBe(7);

  const dayBoxes = await days.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
  }));
  expect(Math.max(...dayBoxes.map((box) => box.top)) - Math.min(...dayBoxes.map((box) => box.top))).toBeLessThan(1);
  expect(Math.max(...dayBoxes.map((box) => box.bottom)) - Math.min(...dayBoxes.map((box) => box.bottom))).toBeLessThan(1);

  const textLayout = await days.locator('span, strong, small').evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return {
      whiteSpace: style.whiteSpace,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  }));
  for (const item of textLayout) {
    expect(item.whiteSpace).toBe('nowrap');
    expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 1);
  }

  const horizontalOverflow = await panel.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(horizontalOverflow).toBe(false);
});
