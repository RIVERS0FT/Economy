import { expect, test, type Page } from '@playwright/test';

interface MapPoint {
  x: number;
  y: number;
}

interface MapPathStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
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

async function mapPathStyleAtPoint(page: Page, point: MapPoint): Promise<MapPathStyle> {
  return page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y);
    const path = target instanceof SVGPathElement ? target : target?.closest('path');
    if (!(path instanceof SVGPathElement) || path.closest('.province-map-label-overlay')) {
      throw new Error(`map path missing at ${x},${y}`);
    }
    const style = getComputedStyle(path);
    return {
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: Number.parseFloat(style.strokeWidth),
    };
  }, point);
}

async function mapPathStyles(page: Page): Promise<MapPathStyle[]> {
  return page.evaluate(() => [...document.querySelectorAll<SVGPathElement>(
    '.province-map-echart svg:not(.province-map-label-overlay) path',
  )].flatMap((path) => {
    const bounds = path.getBoundingClientRect();
    if (!(bounds.width > 0) || !(bounds.height > 0)) return [];
    const style = getComputedStyle(path);
    return [{
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: Number.parseFloat(style.strokeWidth),
    }];
  }));
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
        if (target instanceof SVGSVGElement && target.closest('.economy-chart__canvas')) {
          return { x, y };
        }
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
      if (target instanceof SVGPathElement && target.closest('.province-map-echart')) {
        return { ...point, provinceId: element.dataset.provinceId || '' };
      }
    }
    throw new Error('no uncovered unselected province point found');
  }, excludedProvinceId);
}

test('province hover and selection preserve lens fill and neutral focus hierarchy', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.economy-chart__canvas');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');

  const hoverBorder = await resolveCssColor(page, '--color-text-secondary');
  const selectedBorder = await resolveCssColor(page, '--color-text-primary');
  const coloradoPoint = await provincePoint(page, '150000');
  const blankPoint = await findMapBlankPoint(page);
  await page.mouse.move(blankPoint.x, blankPoint.y);

  const baseStyle = await mapPathStyleAtPoint(page, coloradoPoint);
  const instanceId = await canvas.getAttribute('data-echarts-instance-id');
  const zoomCurrent = await canvas.getAttribute('data-map-zoom-current');
  const zoomTarget = await canvas.getAttribute('data-map-zoom-target');
  const labelLayoutRevision = await canvas.getAttribute('data-map-label-layout-revision');

  await page.mouse.move(coloradoPoint.x, coloradoPoint.y);
  await expect.poll(async () => (await mapPathStyleAtPoint(page, coloradoPoint)).stroke).toBe(hoverBorder);
  const hoverStyle = await mapPathStyleAtPoint(page, coloradoPoint);
  expect(hoverStyle.fill).toBe(baseStyle.fill);
  expect(hoverStyle.strokeWidth).toBeCloseTo(1.5, 1);

  await page.mouse.click(coloradoPoint.x, coloradoPoint.y);
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '150000');
  const selectedBlankPoint = await findMapBlankPoint(page);
  await page.mouse.move(selectedBlankPoint.x, selectedBlankPoint.y);

  await expect.poll(async () => {
    const styles = await mapPathStyles(page);
    return styles.filter((style) => style.stroke === selectedBorder && style.strokeWidth >= 2.4).length;
  }).toBeGreaterThanOrEqual(1);

  const selectedStyles = await mapPathStyles(page);
  const selectedStyle = selectedStyles.find(
    (style) => style.stroke === selectedBorder && style.strokeWidth >= 2.4,
  );
  expect(selectedStyle).toBeDefined();
  expect(selectedStyle?.fill).toBe(baseStyle.fill);
  expect(selectedStyle?.strokeWidth ?? 0).toBeGreaterThan(hoverStyle.strokeWidth);

  const otherProvince = await findUncoveredProvincePoint(page, '150000');
  const otherBaseStyle = await mapPathStyleAtPoint(page, otherProvince);
  await page.mouse.move(otherProvince.x, otherProvince.y);
  await expect.poll(async () => (await mapPathStyleAtPoint(page, otherProvince)).stroke).toBe(hoverBorder);
  const otherHoverStyle = await mapPathStyleAtPoint(page, otherProvince);
  expect(otherHoverStyle.fill).toBe(otherBaseStyle.fill);

  const simultaneousStyles = await mapPathStyles(page);
  expect(simultaneousStyles.some(
    (style) => style.stroke === selectedBorder && style.strokeWidth >= 2.4,
  )).toBe(true);
  expect(simultaneousStyles.some(
    (style) => style.stroke === hoverBorder && style.strokeWidth >= 1.4 && style.strokeWidth < 2.4,
  )).toBe(true);

  await expect(canvas).toHaveAttribute('data-echarts-instance-id', instanceId || '');
  await expect(canvas).toHaveAttribute('data-map-zoom-current', zoomCurrent || '');
  await expect(canvas).toHaveAttribute('data-map-zoom-target', zoomTarget || '');
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', labelLayoutRevision || '');
});
