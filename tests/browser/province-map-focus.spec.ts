import { expect, test, type Page } from '@playwright/test';

interface MapPoint {
  x: number;
  y: number;
}

interface MapPathStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  filter: string;
}

async function provincePoint(page: Page, provinceId: string): Promise<MapPoint> {
  return page.locator(`.province-map-label[data-province-id="${provinceId}"]`).evaluate((element) => {
    const x = Number(element.getAttribute('data-label-center-x'));
    const y = Number(element.getAttribute('data-label-center-y'));
    const matrix = element.getScreenCTM();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) {
      throw new Error(`province label ${element.getAttribute('data-province-id')} has no screen point`);
    }
    return {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f,
    };
  });
}

async function provincePathStyle(page: Page, provinceId: string): Promise<MapPathStyle> {
  return page.locator(`.province-map-region[data-province-id="${provinceId}"]`).evaluate((path) => {
    const style = getComputedStyle(path);
    return {
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: Number.parseFloat(style.strokeWidth),
      filter: style.filter,
    };
  });
}

async function resolveCssColor(page: Page, variableName: string) {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.position = 'fixed';
    probe.style.opacity = '0';
    probe.style.pointerEvents = 'none';
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, variableName);
}

async function findMapBlankPoint(page: Page): Promise<MapPoint> {
  return page.evaluate(() => {
    for (let y = 80; y < window.innerHeight - 80; y += 12) {
      for (let x = 80; x < window.innerWidth - 80; x += 12) {
        const target = document.elementFromPoint(x, y);
        if (
          target instanceof Element
          && target.closest('.province-map-static-viewport')
          && !target.closest('.province-map-region')
        ) return { x, y };
      }
    }
    throw new Error('no uncovered map blank point found');
  });
}

async function findUncoveredProvincePoint(page: Page, excludedProvinceId: string) {
  return page.evaluate((excludedId) => {
    const groups = [...document.querySelectorAll<SVGGElement>('.province-map-label')];
    for (const element of groups) {
      if (element.dataset.provinceId === excludedId) continue;
      const x = Number(element.getAttribute('data-label-center-x'));
      const y = Number(element.getAttribute('data-label-center-y'));
      const matrix = element.getScreenCTM();
      if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) continue;
      const point = {
        x: matrix.a * x + matrix.c * y + matrix.e,
        y: matrix.b * x + matrix.d * y + matrix.f,
      };
      const target = document.elementFromPoint(point.x, point.y);
      if (target instanceof SVGPathElement && target.matches('.province-map-region')) {
        return { ...point, provinceId: target.dataset.provinceId || '' };
      }
    }
    throw new Error('no uncovered unselected province point found');
  }, excludedProvinceId);
}

test('province hover and selection preserve lens fill and neutral focus hierarchy without changing the SVG viewBox', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.economy-chart__canvas');
  const cameraSurface = map.locator('.province-map-camera-surface');
  const svg = map.locator('.province-map-world-svg');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-camera-mode', 'svg-viewbox');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-boundary-stroke-scale'))).toBeGreaterThan(0);

  const boundaryScale = Number(await canvas.getAttribute('data-map-boundary-stroke-scale'));
  expect(boundaryScale).toBeCloseTo(0.65, 2);
  const hoverBorder = await resolveCssColor(page, '--color-text-secondary');
  const selectedBorder = await resolveCssColor(page, '--color-text-primary');
  const coloradoPoint = await provincePoint(page, '150000');
  const blankPoint = await findMapBlankPoint(page);
  await page.mouse.move(blankPoint.x, blankPoint.y);

  const baseStyle = await provincePathStyle(page, '150000');
  expect(baseStyle.strokeWidth).toBeCloseTo(1 * boundaryScale, 2);
  const cameraViewBox = await svg.getAttribute('viewBox');
  const zoomCurrent = await canvas.getAttribute('data-map-zoom-current');
  const zoomTarget = await canvas.getAttribute('data-map-zoom-target');
  const labelLayoutRevision = await canvas.getAttribute('data-map-label-layout-revision');

  await page.mouse.move(coloradoPoint.x, coloradoPoint.y);
  await expect.poll(async () => (await provincePathStyle(page, '150000')).stroke).toBe(hoverBorder);
  const hoverStyle = await provincePathStyle(page, '150000');
  expect(hoverStyle.fill).toBe(baseStyle.fill);
  expect(hoverStyle.strokeWidth).toBeCloseTo(1.5 * boundaryScale, 2);

  const coloradoPath = page.locator('.province-map-region[data-province-id="150000"]');
  await coloradoPath.evaluate((path) => path.setAttribute('data-selected', 'true'));
  await expect.poll(async () => (await provincePathStyle(page, '150000')).strokeWidth).toBeGreaterThan(2.9 * boundaryScale);
  const selectedHoverStyle = await provincePathStyle(page, '150000');
  expect(selectedHoverStyle.fill).toBe(baseStyle.fill);
  expect(selectedHoverStyle.stroke).toBe(selectedBorder);
  expect(selectedHoverStyle.strokeWidth).toBeCloseTo(3 * boundaryScale, 2);
  expect(selectedHoverStyle.strokeWidth).toBeGreaterThan(hoverStyle.strokeWidth);
  await coloradoPath.evaluate((path) => path.setAttribute('data-selected', 'false'));

  await page.mouse.click(coloradoPoint.x, coloradoPoint.y);
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '150000');

  const selectedBlankPoint = await findMapBlankPoint(page);
  await page.mouse.move(selectedBlankPoint.x, selectedBlankPoint.y);
  await expect.poll(async () => (await provincePathStyle(page, '150000')).strokeWidth).toBeGreaterThan(2.4 * boundaryScale);
  const selectedStyle = await provincePathStyle(page, '150000');
  expect(selectedStyle.fill).toBe(baseStyle.fill);
  expect(selectedStyle.stroke).toBe(selectedBorder);
  expect(selectedStyle.strokeWidth).toBeCloseTo(2.5 * boundaryScale, 2);
  expect(selectedStyle.strokeWidth).toBeLessThan(selectedHoverStyle.strokeWidth);
  expect(selectedStyle.strokeWidth).toBeGreaterThan(hoverStyle.strokeWidth);

  const otherProvince = await findUncoveredProvincePoint(page, '150000');
  const otherBaseStyle = await provincePathStyle(page, otherProvince.provinceId);
  await page.mouse.move(otherProvince.x, otherProvince.y);
  await expect.poll(async () => (await provincePathStyle(page, otherProvince.provinceId)).stroke).toBe(hoverBorder);
  const otherHoverStyle = await provincePathStyle(page, otherProvince.provinceId);
  expect(otherHoverStyle.fill).toBe(otherBaseStyle.fill);
  expect(otherHoverStyle.strokeWidth).toBeCloseTo(1.5 * boundaryScale, 2);

  const stillSelected = await provincePathStyle(page, '150000');
  expect(stillSelected.stroke).toBe(selectedBorder);
  expect(stillSelected.strokeWidth).toBeCloseTo(2.5 * boundaryScale, 2);

  await expect(cameraSurface).toHaveCSS('transform', 'none');
  expect(await svg.getAttribute('viewBox')).toBe(cameraViewBox);
  await expect(canvas).toHaveAttribute('data-map-zoom-current', zoomCurrent || '');
  await expect(canvas).toHaveAttribute('data-map-zoom-target', zoomTarget || '');
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', labelLayoutRevision || '');
});