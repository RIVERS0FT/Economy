import { expect, test } from '@playwright/test';

test('desktop market catalog stays within the page card without a horizontal rail', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active&view=catalog');
  await expect(page.getByRole('heading', { name: '加利福尼亚州市场', exact: true })).toBeVisible();

  const scrollbarTokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      visualSize: style.getPropertyValue('--scrollbar-visual-size').trim(),
      hitSize: style.getPropertyValue('--scrollbar-hit-size').trim(),
      touchTargetSize: style.getPropertyValue('--scrollbar-touch-target-size').trim(),
      minimumThumbSize: style.getPropertyValue('--scrollbar-min-thumb-size').trim(),
    };
  });
  expect(scrollbarTokens).toEqual({
    visualSize: '6px',
    hitSize: '14px',
    touchTargetSize: '44px',
    minimumThumbSize: '44px',
  });

  const layout = await page.locator('.market-catalog-panel').evaluate((panel) => ({
    clientWidth: panel.clientWidth,
    scrollWidth: panel.scrollWidth,
    horizontalRails: panel.querySelectorAll('.ui-scrollbar--horizontal').length,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.horizontalRails).toBe(0);
});

test('touch input hides horizontal rails while local trade cells keep native two-axis scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active');
  await expect(page.getByRole('heading', { name: '加利福尼亚州 · 小麦', exact: true })).toBeVisible();

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

  await page.getByRole('button', { name: '成交', exact: true }).click();
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active');
  await page.getByRole('button', { name: '成交', exact: true }).click();

  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerType: 'touch',
      pointerId: 31,
    }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('touch');
  await expect(page.locator('.local-trades-scroll-area .ui-scrollbar--horizontal')).toHaveCSS('display', 'none');

  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 1 }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('mouse');
  await expect(page.locator('.local-trades-scroll-area .ui-scrollbar--horizontal')).not.toHaveCSS('display', 'none');

  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerType: 'touch',
      pointerId: 32,
    }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('touch');
  await expect(page.locator('.local-trades-scroll-area .ui-scrollbar--horizontal')).toHaveCSS('display', 'none');
});