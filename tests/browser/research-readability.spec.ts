import { expect, test } from '@playwright/test';

for (const width of [1440, 1024, 390, 320]) {
  test(`research focus and navigation keep full nodes readable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');
    const viewport = page.locator('.research-tree-viewport');
    const active = page.locator('.research-technology-node[data-status="active"]');
    await expect(active).toBeVisible();
    const checkSafe = async () => {
      const geometry = await active.evaluate(element => {
        const box = element.getBoundingClientRect();
        const viewport = document.querySelector('.research-tree-viewport')!.getBoundingClientRect();
        const panel = document.querySelector('.research-action-panel')!.getBoundingClientRect();
        const controls = document.querySelector('.research-tree-controls')!.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
          safeLeft: panel.width > 0 ? panel.right : viewport.left, safeRight: viewport.right,
          safeTop: viewport.top, safeBottom: controls.top };
      });
      expect(geometry.left).toBeGreaterThan(geometry.safeLeft + 8);
      expect(geometry.right).toBeLessThan(geometry.safeRight - 8);
      expect(geometry.top).toBeGreaterThan(geometry.safeTop + 8);
      expect(geometry.bottom).toBeLessThan(geometry.safeBottom - 8);
    };
    await checkSafe();
    await page.screenshot({ path: testInfo.outputPath(`research-initial-${width}.png`) });
    await page.getByRole('button', { name: '放大技术树' }).click({ clickCount: 10 });
    await page.getByRole('button', { name: '定位当前科技' }).click();
    await checkSafe();
    await viewport.focus();
    await page.keyboard.press('Tab');
    await active.focus();
    await checkSafe();
    await expect(active).toHaveCSS('outline-style', 'none');
    await expect(active).toHaveCSS('box-shadow', 'none');
    const artwork = active.locator('.research-facility-artwork');
    const focus = await artwork.evaluate(element => {
      const style = getComputedStyle(element, '::before');
      return { content: style.content, border: style.borderTopStyle, radius: style.borderRadius,
        width: parseFloat(style.width), artworkWidth: parseFloat(getComputedStyle(element).width),
        selection: getComputedStyle(element).boxShadow };
    });
    expect(focus.content).toBe('""');
    expect(focus.border).toBe('dashed');
    expect(focus.radius).toBe('50%');
    expect(focus.width - focus.artworkWidth).toBeLessThanOrEqual(24);
    expect(focus.selection).not.toBe('none');
    await page.screenshot({ path: testInfo.outputPath(`research-focus-${width}.png`) });
  });
}

test('ordinary dependencies stay visible and the fitted tree clears the action panel', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1684, height: 1000 });
  await page.goto('runtime-test.html?view=research&scenario=research-active');
  await page.getByRole('button', { name: '查看完整技术树' }).click();
  const metrics = await page.evaluate(() => {
    const panel = document.querySelector('.research-action-panel')!.getBoundingClientRect();
    const viewport = document.querySelector('.research-tree-viewport')!.getBoundingClientRect();
    const controls = document.querySelector('.research-tree-controls')!.getBoundingClientRect();
    const nodes = [...document.querySelectorAll('.research-technology-node')];
    const edges = [...document.querySelectorAll('.research-tree-edge')].map(element => ({
      highlighted: element.hasAttribute('data-highlighted'), related: element.hasAttribute('data-related'),
      opacity: Number(getComputedStyle(element).opacity), stroke: getComputedStyle(element).stroke,
      width: parseFloat(getComputedStyle(element).strokeWidth),
    }));
    return { edges, allSafe: nodes.every(node => {
      const box = node.getBoundingClientRect();
      return box.left > panel.right + 8 && box.right < viewport.right - 8 && box.top > viewport.top + 8 && box.bottom < controls.top - 8;
    }), fontSize: parseFloat(getComputedStyle(document.querySelector('.research-technology-node-name')!).fontSize) };
  });
  expect(metrics.allSafe).toBe(true);
  expect(metrics.fontSize).toBeGreaterThanOrEqual(13);
  const ordinary = metrics.edges.filter(edge => !edge.highlighted && !edge.related);
  expect(ordinary.length).toBeGreaterThan(0);
  for (const edge of ordinary) {
    expect(edge.opacity).toBeGreaterThanOrEqual(0.8);
    expect(edge.stroke).toBe('rgb(144, 160, 153)');
    expect(edge.width).toBe(2);
  }
  expect(metrics.edges.filter(edge => edge.highlighted).every(edge => edge.width > 2)).toBe(true);
  const viewport = page.locator('.research-tree-viewport');
  const before = await viewport.evaluate(element => ({ ...((element as HTMLElement).dataset) }));
  await page.locator('[data-technology-id="wood-industry"]').click();
  // Pointer release may snap an existing fractional pan to the device pixel.
  expect(Math.abs(Number(await viewport.getAttribute('data-pan-x')) - Number(before.panX))).toBeLessThanOrEqual(1);
  expect(Math.abs(Number(await viewport.getAttribute('data-pan-y')) - Number(before.panY))).toBeLessThanOrEqual(1);
  expect(await viewport.getAttribute('data-zoom')).toBe(before.zoom);
  await page.screenshot({ path: testInfo.outputPath('research-overview.png') });
});
