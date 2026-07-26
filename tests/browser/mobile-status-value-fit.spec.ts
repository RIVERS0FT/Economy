import { expect, test, type Page } from '@playwright/test';

const mobileWidths = [430, 390, 375, 360, 320];
const longValues = ['2,468', '31,942', '191', '#1', '71,204'];

async function replaceStatusValues(page: Page, values: string[]) {
  await page.locator('.asset-bar-item-value').evaluateAll((elements, nextValues) => {
    const content = document.querySelector<HTMLElement>('.asset-bar-content');
    if (content) content.dataset.statusValuesFitted = 'false';
    elements.forEach((element, index) => {
      element.querySelectorAll<HTMLElement>('.asset-bar-item-value-full, .asset-bar-item-value-compact')
        .forEach((variant) => {
          variant.textContent = nextValues[index] ?? '';
        });
    });
  }, values);
}

async function waitForFittedValues(page: Page) {
  await page.waitForFunction(() => {
    const content = document.querySelector<HTMLElement>('.asset-bar-content');
    const values = Array.from(document.querySelectorAll<HTMLElement>('.asset-bar-item-value'));
    if (content?.dataset.statusValuesFitted !== 'true' || values.length !== 5) return false;

    return values.every((valueElement) => {
      const visibleValue = Array.from(valueElement.querySelectorAll<HTMLElement>(
        '.asset-bar-item-value-full, .asset-bar-item-value-compact',
      )).find((candidate) => getComputedStyle(candidate).display !== 'none');
      if (!visibleValue) return false;
      const valueRect = valueElement.getBoundingClientRect();
      const textRect = visibleValue.getBoundingClientRect();
      return textRect.left >= valueRect.left - 1 && textRect.right <= valueRect.right + 1;
    });
  });
}

test('mobile status values shrink individually instead of showing ellipses', async ({ page }) => {
  await page.setViewportSize({ width: 431, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');
  await expect(page.locator('.asset-bar-item-value')).toHaveCount(5);
  await replaceStatusValues(page, longValues);

  for (const width of mobileWidths) {
    await page.setViewportSize({ width, height: 900 });
    await waitForFittedValues(page);

    const metrics = await page.locator('.asset-bar-item-value').evaluateAll((elements) => elements.map((element) => {
      const valueElement = element as HTMLElement;
      const visibleValue = Array.from(valueElement.querySelectorAll<HTMLElement>(
        '.asset-bar-item-value-full, .asset-bar-item-value-compact',
      )).find((candidate) => getComputedStyle(candidate).display !== 'none');
      const style = getComputedStyle(valueElement);
      return {
        text: visibleValue?.textContent ?? '',
        fitted: valueElement.dataset.statusValueFitted,
        fontSize: Number.parseFloat(style.fontSize),
        textOverflow: style.textOverflow,
      };
    }));

    expect(metrics.map((metric) => metric.text)).toEqual(longValues);
    expect(metrics.every((metric) => metric.textOverflow === 'clip')).toBe(true);

    if (width === 320) {
      expect(metrics[1].fitted).toBe('true');
      expect(metrics[4].fitted).toBe('true');
      expect(metrics[2].fitted).toBe('false');
      expect(metrics[3].fitted).toBe('false');
      expect(metrics[1].fontSize).toBeLessThan(metrics[3].fontSize);
      expect(metrics[4].fontSize).toBeLessThan(metrics[3].fontSize);
    }
  }

  await replaceStatusValues(page, ['24', '31', '9', '#1', '71']);
  await page.setViewportSize({ width: 321, height: 900 });
  await waitForFittedValues(page);
  const restored = await page.locator('.asset-bar-item-value').evaluateAll((elements) => elements.map((element) => ({
    fitted: (element as HTMLElement).dataset.statusValueFitted,
    fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
  })));
  expect(restored.every((metric) => metric.fitted === 'false')).toBe(true);
  expect(new Set(restored.map((metric) => metric.fontSize)).size).toBe(1);
});
