import { expect, test } from '@playwright/test';

test('desktop market asset directory supports continuous unsnapped scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');
  await expect(page.getByRole('heading', { name: '市场', exact: true })).toBeVisible();

  const directory = page.getByRole('tablist', { name: '选择交易资产' });
  const root = page.locator('.asset-directory-scroll-area');
  const styles = await directory.evaluate((element) => {
    const style = getComputedStyle(element);
    return { snap: style.scrollSnapType, behavior: style.scrollBehavior };
  });
  expect(styles.snap).toBe('none');
  expect(styles.behavior).toBe('auto');

  await directory.evaluate((element) => { element.scrollLeft = 173; });
  await page.waitForTimeout(180);
  const unsnapped = await directory.evaluate((element) => element.scrollLeft);
  expect(Math.abs(unsnapped - 173)).toBeLessThanOrEqual(1);

  await root.hover();
  const thumb = root.locator('.ui-scrollbar--horizontal .ui-scrollbar__thumb');
  await expect(thumb).toBeVisible();
  const box = await thumb.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('horizontal scrollbar thumb has no box');

  const before = await directory.evaluate((element) => element.scrollLeft);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 37, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const after = await directory.evaluate((element) => element.scrollLeft);
  expect(after).toBeGreaterThan(before + 5);
  await page.waitForTimeout(180);
  expect(Math.abs((await directory.evaluate((element) => element.scrollLeft)) - after)).toBeLessThanOrEqual(1);
});

test('touch input hides horizontal rails while local trade cells keep native two-axis scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active');
  await expect(page.getByRole('heading', { name: '市场', exact: true })).toBeVisible();

  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerType: 'touch',
      pointerId: 17,
    }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('touch');

  const horizontalDisplays = await page.locator('.ui-scrollbar--horizontal').evaluateAll((elements) => (
    elements.map((element) => getComputedStyle(element).display)
  ));
  expect(horizontalDisplays.length).toBeGreaterThan(0);
  expect(horizontalDisplays.every((display) => display === 'none')).toBe(true);

  const directory = page.getByRole('tablist', { name: '选择交易资产' });
  await directory.evaluate((element) => { element.scrollLeft = 140; });
  expect(await directory.evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);

  const tradeRoot = page.locator('.local-trades-scroll-area');
  const tradeViewport = tradeRoot.locator(':scope > .ui-scroll-area__viewport');
  await expect(tradeViewport.locator('.virtual-record-row').first()).toBeVisible();
  expect(await tradeViewport.locator('.ui-scroll-area').count()).toBe(0);

  const overflow = await tradeViewport.evaluate((element) => {
    const style = getComputedStyle(element);
    return { x: style.overflowX, y: style.overflowY, touchAction: style.touchAction };
  });
  expect(overflow.x).toBe('auto');
  expect(overflow.y).toBe('auto');
  expect(overflow.touchAction).toContain('pan-x');

  await tradeViewport.evaluate((element) => {
    element.scrollLeft = 180;
    element.scrollTop = 120;
  });
  expect(await tradeViewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);
  await expect.poll(() => tradeRoot.locator('.ui-scrollbar--vertical').evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await expect.poll(() => tradeRoot.locator('.ui-scrollbar--vertical').evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('auto');

  const beforeTrack = await tradeViewport.evaluate((element) => element.scrollTop);
  await tradeRoot.locator('.ui-scrollbar--vertical').evaluate((track) => {
    const thumb = track.querySelector('.ui-scrollbar__thumb');
    if (!(thumb instanceof HTMLElement)) throw new Error('missing vertical thumb');
    const rect = thumb.getBoundingClientRect();
    track.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 21,
      clientX: rect.left + rect.width / 2,
      clientY: rect.bottom + 20,
    }));
  });
  await expect.poll(() => tradeViewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(beforeTrack);

  const beforeDrag = await tradeViewport.evaluate((element) => element.scrollTop);
  await tradeRoot.locator('.ui-scrollbar--vertical .ui-scrollbar__thumb').evaluate((thumb) => {
    const rect = thumb.getBoundingClientRect();
    const startY = rect.top + rect.height / 2;
    thumb.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 22,
      clientX: rect.left + rect.width / 2,
      clientY: startY,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 22,
      clientY: startY + 45,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 22,
      clientY: startY + 45,
    }));
  });
  await expect.poll(() => tradeViewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(beforeDrag);

  await page.waitForTimeout(1850);
  await expect.poll(() => tradeRoot.locator('.ui-scrollbar--vertical').evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
});

test('mixed input switches scrollbar policy at runtime', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('market-runtime-test.html?scenario=active');

  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerType: 'touch',
      pointerId: 31,
    }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('touch');
  await expect(page.locator('.asset-directory-scroll-area .ui-scrollbar--horizontal')).toHaveCSS('display', 'none');

  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 1 }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('mouse');
  await expect(page.locator('.asset-directory-scroll-area .ui-scrollbar--horizontal')).not.toHaveCSS('display', 'none');

  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerType: 'touch',
      pointerId: 32,
    }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('touch');
  await expect(page.locator('.asset-directory-scroll-area .ui-scrollbar--horizontal')).toHaveCSS('display', 'none');
});
