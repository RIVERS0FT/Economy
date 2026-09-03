import { expect, test, type Page } from '@playwright/test';

async function provinceLabelCenter(page: Page, provinceId: string) {
  return page.locator(`.province-map-label[data-province-id="${provinceId}"]`).evaluate((element) => {
    const x = Number(element.getAttribute('data-label-center-x'));
    const y = Number(element.getAttribute('data-label-center-y'));
    const matrix = element.getScreenCTM();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) {
      throw new Error('province label center transform is missing');
    }
    return {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f,
    };
  });
}

async function findPinchSeedInsideProvince(page: Page, provinceId: string) {
  return page.locator(`.province-map-label[data-province-id="${provinceId}"]`).evaluate((element) => {
    const x = Number(element.getAttribute('data-label-center-x'));
    const y = Number(element.getAttribute('data-label-center-y'));
    const matrix = element.getScreenCTM();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) {
      throw new Error('province label center transform is missing');
    }
    const centerX = matrix.a * x + matrix.c * y + matrix.e;
    const centerY = matrix.b * x + matrix.d * y + matrix.f;
    const pathAt = (pointX: number, pointY: number) => {
      const target = document.elementFromPoint(pointX, pointY);
      if (!(target instanceof SVGPathElement)) return null;
      return target.matches('.province-map-region') && target.closest('.province-map-world-svg') ? target : null;
    };
    const centerPath = pathAt(centerX, centerY);
    if (!centerPath) throw new Error('province label center is not over a static map path');

    const axes = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: Math.SQRT1_2, y: Math.SQRT1_2 },
      { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
    ];
    for (const axis of axes) {
      let maxHalf = 0;
      for (let half = 2; half <= 30; half += 2) {
        const firstPath = pathAt(centerX - axis.x * half, centerY - axis.y * half);
        const secondPath = pathAt(centerX + axis.x * half, centerY + axis.y * half);
        if (firstPath !== centerPath || secondPath !== centerPath) break;
        maxHalf = half;
      }
      if (maxHalf >= 6) {
        const endHalf = maxHalf;
        const startHalf = Math.max(3, Math.floor(endHalf * 0.55));
        return { centerX, centerY, axisX: axis.x, axisY: axis.y, startHalf, endHalf };
      }
    }
    throw new Error('could not find two touch points inside the same province path');
  });
}

test('mobile pinch starting inside a province zooms the SVG viewBox without selecting the province', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:1420/economy/',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  try {
    await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
    const map = page.getByTestId('us-mainland-map');
    const canvas = map.locator('.economy-chart__canvas');
    const svg = map.locator('.province-map-world-svg');
    await expect(map).toHaveAttribute('data-map-ready', 'true');
    await expect(canvas).toHaveAttribute('data-map-camera-mode', 'svg-viewbox');
    await expect(canvas).toHaveCSS('touch-action', 'none');
    await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
    const viewBoxBefore = await svg.getAttribute('viewBox');

    const seed = await findPinchSeedInsideProvince(page, 'US-TX');
    const touchPoints = (half: number) => ([
      {
        x: seed.centerX - seed.axisX * half,
        y: seed.centerY - seed.axisY * half,
      },
      {
        x: seed.centerX + seed.axisX * half,
        y: seed.centerY + seed.axisY * half,
      },
    ]);
    const sequenceBefore = Number(await canvas.getAttribute('data-map-multitouch-sequence-count') || 0);
    const suppressedBefore = Number(await canvas.getAttribute('data-map-suppressed-multitouch-tap-count') || 0);
    const cdp = await context.newCDPSession(page);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: touchPoints(seed.startHalf),
    });
    await expect(canvas).toHaveAttribute('data-map-multitouch-active', 'true');

    for (let step = 1; step <= 6; step += 1) {
      const half = seed.startHalf + ((seed.endHalf - seed.startHalf) * step) / 6;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: touchPoints(half),
      });
    }

    await expect(canvas).toHaveAttribute('data-map-zoom-input-mode', 'pinch');
    await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-target'))).toBeGreaterThan(1.05);
    await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(1.05);
    await expect.poll(async () => svg.getAttribute('viewBox')).not.toBe(viewBoxBefore);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    // Chromium does not deterministically synthesize a post-pinch click for CDP touch input.
    // Send the equivalent immediate single tap while the 420ms release suppression is active.
    await page.touchscreen.tap(seed.centerX, seed.centerY);

    expect(Number(await canvas.getAttribute('data-map-multitouch-sequence-count'))).toBeGreaterThan(sequenceBefore);
    await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
    await expect(page.getByRole('heading', { name: '得克萨斯', exact: true })).toHaveCount(0);
    expect(Number(await canvas.getAttribute('data-map-suppressed-multitouch-tap-count') || 0))
      .toBeGreaterThan(suppressedBefore);

    await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
    await page.waitForTimeout(500);
    await expect(canvas).toHaveAttribute('data-map-multitouch-active', 'false');
    const centerAfterPinch = await provinceLabelCenter(page, 'US-TX');
    await page.touchscreen.tap(centerAfterPinch.x, centerAfterPinch.y);
    await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', 'US-TX');
    await expect(page.getByRole('heading', { name: '得克萨斯', exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
