from pathlib import Path

path = Path('tests/browser/province-map.spec.ts')
source = path.read_text(encoding='utf-8')
marker = "\n\ntest('mobile strategy map keeps labels and blank-space gestures usable'"
if marker not in source:
    raise RuntimeError('mobile strategy map test marker missing')

replacement = r'''

test('mobile strategy map keeps labels and blank-space gestures usable', async ({ browser }) => {
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
    await expect(map).toHaveAttribute('data-echarts-ready', 'true');
    await expect(canvas).toHaveCSS('touch-action', 'none');

    const renderedLabels = await map.locator('svg text').allTextContents();
    for (const code of ['CA', 'TX', 'CO', 'FL', 'NY']) expect(renderedLabels).toContain(code);

    const stateFills = await map.locator('svg path').evaluateAll((paths) => paths
      .map((mapPath) => getComputedStyle(mapPath).fill)
      .filter((fill) => fill.startsWith('rgb')));
    expect(stateFills.length).toBeGreaterThanOrEqual(48);
    expect(stateFills.some((fill) => fill === 'rgb(0, 0, 0)' || fill === 'rgba(0, 0, 0, 1)')).toBe(false);

    const initialOutline = await readOutlineGeometry(page);
    let blankPoint = await findMapBlankPoint(page);
    await page.mouse.move(blankPoint.x, blankPoint.y);
    await page.mouse.wheel(0, -480);
    await expect.poll(async () => {
      const outline = await readOutlineGeometry(page);
      return outline.right - outline.left;
    }).toBeGreaterThan((initialOutline.right - initialOutline.left) * 1.05);

    blankPoint = await findMapBlankPoint(page);
    const beforeBlankPan = await readOutlineGeometry(page);
    await page.mouse.move(blankPoint.x, blankPoint.y);
    await page.mouse.down();
    await page.mouse.move(blankPoint.x + 42, blankPoint.y + 24, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => {
      const outline = await readOutlineGeometry(page);
      return Math.abs(outline.left - beforeBlankPan.left) + Math.abs(outline.top - beforeBlankPan.top);
    }).toBeGreaterThan(8);

    blankPoint = await findMapBlankPoint(page);
    await page.touchscreen.tap(blankPoint.x, blankPoint.y);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(blankPoint.x, blankPoint.y);
    await expect(canvas).toHaveAttribute('data-map-camera-reset', 'blank-double-tap');
    await page.waitForTimeout(320);
    const resetOutline = await readOutlineGeometry(page);
    expect(resetOutline.left).toBeCloseTo(initialOutline.left, 0);
    expect(resetOutline.top).toBeCloseTo(initialOutline.top, 0);
    expect(resetOutline.right).toBeCloseTo(initialOutline.right, 0);
    expect(resetOutline.bottom).toBeCloseTo(initialOutline.bottom, 0);
  } finally {
    await context.close();
  }
});
'''

path.write_text(source[:source.index(marker)] + replacement, encoding='utf-8')
print('Replaced synthetic touch clicks with a real touch-enabled Playwright context.')
