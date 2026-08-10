import { expect, test } from '@playwright/test';

for (const viewport of [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`auction bundle bid input and submit stay on one row on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('runtime-test.html?view=auction&scenario=bid-history');

    const form = page.locator('.asset-bid-form');
    const input = form.locator('input').first();
    const button = form.getByRole('button', { name: /提交出价|提高出价/ });

    await expect(form).toBeVisible();
    await expect(input).toBeVisible();
    await expect(button).toBeVisible();

    const geometry = await form.evaluate((node) => {
      const inputNode = node.querySelector('input');
      const buttonNode = node.querySelector('button');
      if (!(inputNode instanceof HTMLElement) || !(buttonNode instanceof HTMLElement)) {
        throw new Error('missing auction bid controls');
      }
      const formStyle = getComputedStyle(node);
      const inputRect = inputNode.getBoundingClientRect();
      const buttonRect = buttonNode.getBoundingClientRect();
      return {
        display: formStyle.display,
        columns: formStyle.gridTemplateColumns,
        inputBottom: inputRect.bottom,
        inputRight: inputRect.right,
        buttonBottom: buttonRect.bottom,
        buttonLeft: buttonRect.left,
        verticalOverlap: Math.min(inputRect.bottom, buttonRect.bottom) - Math.max(inputRect.top, buttonRect.top),
      };
    });

    expect(geometry.display).toBe('grid');
    expect(geometry.columns).not.toBe('none');
    expect(geometry.verticalOverlap).toBeGreaterThan(0);
    expect(Math.abs(geometry.inputBottom - geometry.buttonBottom)).toBeLessThan(1);
    expect(geometry.inputRight).toBeLessThanOrEqual(geometry.buttonLeft);
  });
}
