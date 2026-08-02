import { expect, test, type Locator, type Page } from '@playwright/test';

async function interactiveMark(chart: Locator) {
  await expect(chart).toHaveAttribute('data-echarts-ready', 'true');
  const canvas = chart.locator('.economy-chart__canvas');
  await expect(canvas).toHaveAttribute('data-echarts-css-colors-resolved', 'true');
  const paths = canvas.locator('svg path');
  await expect.poll(() => paths.count()).toBeGreaterThan(0);
  const index = await paths.evaluateAll((elements) => {
    const candidates = elements.map((element, itemIndex) => {
      const path = element as SVGPathElement;
      const style = getComputedStyle(path);
      const box = path.getBoundingClientRect();
      const fill = style.fill.replace(/\s+/g, '');
      const transparent = fill === 'none'
        || fill === 'transparent'
        || fill === 'rgba(0,0,0,0)'
        || style.opacity === '0'
        || style.visibility === 'hidden'
        || style.display === 'none';
      return {
        itemIndex,
        area: box.width * box.height,
        eligible: !transparent && style.pointerEvents !== 'none' && box.width > 2 && box.height > 2,
      };
    }).filter((candidate) => candidate.eligible);
    candidates.sort((left, right) => right.area - left.area);
    return candidates[0]?.itemIndex ?? -1;
  });
  expect(index).toBeGreaterThanOrEqual(0);
  return paths.nth(index);
}

async function markState(mark: Locator) {
  return mark.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      fill: style.fill,
      stroke: style.stroke,
      opacity: Number(style.opacity),
      display: style.display,
      visibility: style.visibility,
      width: box.width,
      height: box.height,
      serializedStyle: element.getAttribute('style') || '',
    };
  });
}

async function hoverInsideFill(page: Page, mark: Locator) {
  const point = await mark.evaluate((element) => {
    const geometry = element as SVGGeometryElement;
    const matrix = geometry.getScreenCTM();
    const box = geometry.getBBox();
    if (matrix && typeof geometry.isPointInFill === 'function') {
      for (let yStep = 1; yStep < 10; yStep += 1) {
        for (let xStep = 1; xStep < 10; xStep += 1) {
          const localPoint = new DOMPoint(
            box.x + box.width * xStep / 10,
            box.y + box.height * yStep / 10,
          );
          if (!geometry.isPointInFill(localPoint)) continue;
          const screenPoint = localPoint.matrixTransform(matrix);
          return { x: screenPoint.x, y: screenPoint.y };
        }
      }
    }
    const bounds = element.getBoundingClientRect();
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  });
  await page.mouse.move(point.x, point.y);
}

async function assertStableHover(page: Page, testId: string) {
  const caseRoot = page.getByTestId(testId);
  const chart = caseRoot.locator('.economy-chart');
  const mark = await interactiveMark(chart);
  const before = await markState(mark);
  expect(before.serializedStyle).not.toContain('var(');
  expect(before.fill).not.toContain('var(');
  expect(before.opacity).toBeGreaterThan(0);
  expect(before.width).toBeGreaterThan(2);
  expect(before.height).toBeGreaterThan(2);

  await hoverInsideFill(page, mark);
  await expect(chart.locator('.economy-chart-tooltip')).toBeVisible();
  await page.waitForTimeout(80);

  const after = await markState(mark);
  expect(after.fill).toBe(before.fill);
  expect(after.stroke).toBe(before.stroke);
  expect(after.opacity).toBe(before.opacity);
  expect(after.display).toBe(before.display);
  expect(after.visibility).toBe(before.visibility);
  expect(after.width).toBeGreaterThan(2);
  expect(after.height).toBeGreaterThan(2);

  await page.mouse.move(1, 1);
}

test('all shared chart families keep data marks visible while tooltip hover is active', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await page.goto('chart-hover-runtime-test.html');

  for (const testId of [
    'player-activity-chart',
    'horizontal-percent-chart',
    'number-bar-chart',
    'population-budget-chart',
    'admin-donut-chart',
    'asset-allocation-chart',
    'callback-color-chart',
  ]) {
    await assertStableHover(page, testId);
  }
});
