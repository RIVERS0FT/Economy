import { expect, test, type Page } from '@playwright/test';

async function readOutlineGeometry(page: Page) {
  return page.evaluate(() => {
    const pathRects = [...document.querySelectorAll<SVGGraphicsElement>('.province-map-region')]
      .map((path) => path.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (pathRects.length === 0) throw new Error('map outline paths are missing');
    return {
      left: Math.min(...pathRects.map((rect) => rect.left)),
      top: Math.min(...pathRects.map((rect) => rect.top)),
      right: Math.max(...pathRects.map((rect) => rect.right)),
      bottom: Math.max(...pathRects.map((rect) => rect.bottom)),
    };
  });
}

async function provinceLabelVisualCenter(page: Page, provinceId: string) {
  return page.locator(`.province-map-label[data-province-id="${provinceId}"]`).evaluate((element) => {
    const x = Number(element.getAttribute('data-label-center-x'));
    const y = Number(element.getAttribute('data-label-center-y'));
    const matrix = element.getScreenCTM();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) {
      throw new Error('province label visual center transform is missing');
    }
    return {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f,
    };
  });
}

async function findMapBlankPoint(page: Page) {
  return page.evaluate(() => {
    for (let y = 80; y < window.innerHeight - 80; y += 12) {
      for (let x = 80; x < window.innerWidth - 80; x += 12) {
        const elements = document.elementsFromPoint(x, y);
        const insideCanvas = elements.some((element) => element.classList.contains('province-map-static-viewport'));
        const hitsProvince = elements.some((element) => element.classList.contains('province-map-region'));
        if (insideCanvas && !hitsProvince) return { x, y };
      }
    }
    throw new Error('no uncovered map blank point found');
  });
}

async function nextAnimationFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

test('blank double click resets the single SVG viewBox camera for paths and labels in the first frame', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  const camera = map.locator('.province-map-camera-surface');
  const svg = map.locator('.province-map-world-svg');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');
  await nextAnimationFrame(page);

  const baselineOutline = await readOutlineGeometry(page);
  const baselineLabelCenter = await provinceLabelVisualCenter(page, '150000');
  const baselineViewBox = await svg.getAttribute('viewBox');
  const layoutRevision = await canvas.getAttribute('data-map-label-layout-revision');
  const baselinePathRevision = await canvas.getAttribute('data-map-path-revision');

  const mapBounds = await canvas.boundingBox();
  if (!mapBounds) throw new Error('map canvas bounds are missing');
  await page.mouse.move(
    mapBounds.x + mapBounds.width * 0.58,
    mapBounds.y + mapBounds.height * 0.46,
  );
  await page.mouse.wheel(0, -480);
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(1.05);

  const zoomedOutline = await readOutlineGeometry(page);
  expect(zoomedOutline.right - zoomedOutline.left).toBeGreaterThan(
    (baselineOutline.right - baselineOutline.left) * 1.05,
  );
  expect(await svg.getAttribute('viewBox')).not.toBe(baselineViewBox);

  const blankPoint = await findMapBlankPoint(page);
  await page.mouse.dblclick(blankPoint.x, blankPoint.y);
  await expect(canvas).toHaveAttribute('data-map-camera-reset', 'blank-double-click');
  await nextAnimationFrame(page);

  const firstFrameOutline = await readOutlineGeometry(page);
  const firstFrameLabelCenter = await provinceLabelVisualCenter(page, '150000');

  expect(firstFrameOutline.left).toBeCloseTo(baselineOutline.left, 0);
  expect(firstFrameOutline.top).toBeCloseTo(baselineOutline.top, 0);
  expect(firstFrameOutline.right).toBeCloseTo(baselineOutline.right, 0);
  expect(firstFrameOutline.bottom).toBeCloseTo(baselineOutline.bottom, 0);
  expect(Math.hypot(
    firstFrameLabelCenter.x - baselineLabelCenter.x,
    firstFrameLabelCenter.y - baselineLabelCenter.y,
  )).toBeLessThan(1.5);
  expect(await svg.getAttribute('viewBox')).toBe(baselineViewBox);

  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');
  await expect(canvas).toHaveAttribute('data-map-zoom-target', '1.00000');
  await expect(canvas).toHaveAttribute('data-map-zoom-active', 'false');
  await expect(camera).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('will-change', 'auto');
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', layoutRevision || '');
  await expect(canvas).toHaveAttribute('data-map-path-revision', baselinePathRevision || '');
});
