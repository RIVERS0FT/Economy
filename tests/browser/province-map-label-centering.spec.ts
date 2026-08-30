import { expect, test, type Page } from '@playwright/test';

async function normalizedLabelCenterOffset(page: Page, provinceId: string) {
  return page.locator(`.province-map-label[data-province-id="${provinceId}"]`).evaluate((label, id) => {
    const region = document.querySelector<SVGGraphicsElement>(`.province-map-region[data-province-id="${id}"]`);
    const x = Number(label.getAttribute('data-label-center-x'));
    const y = Number(label.getAttribute('data-label-center-y'));
    const matrix = label.getScreenCTM();
    if (!region || !Number.isFinite(x) || !Number.isFinite(y) || !matrix) {
      throw new Error(`label geometry missing for ${id}`);
    }
    const bounds = region.getBoundingClientRect();
    const labelCenter = {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f,
    };
    const regionCenter = {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    };
    const diagonal = Math.hypot(bounds.width, bounds.height);
    if (!(diagonal > 0)) throw new Error(`state geometry missing for ${id}`);
    return Math.hypot(labelCenter.x - regionCenter.x, labelCenter.y - regionCenter.y) / diagonal;
  }, provinceId);
}

test('wide western state labels stay near the visual center when a near-maximum size fits', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(map.locator('.province-map-label')).toHaveCount(48);

  const arizonaOffset = await normalizedLabelCenterOffset(page, '130000');
  const coloradoOffset = await normalizedLabelCenterOffset(page, '150000');

  expect(arizonaOffset).toBeLessThan(0.16);
  expect(coloradoOffset).toBeLessThan(0.16);
});
