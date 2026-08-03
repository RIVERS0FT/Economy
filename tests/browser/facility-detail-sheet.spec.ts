import { expect, test, type Locator, type Page } from '@playwright/test';

async function waitForSheetAnimations(dialog: Locator) {
  await expect.poll(() => dialog.evaluate((element) => (
    element.getAnimations().every((animation) => animation.playState === 'finished')
  ))).toBe(true);
}

async function swipeDown(page: Page, handle: Locator, distance = 180) {
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: startY }],
  });
  for (const offset of [24, 64, 112, distance]) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: startY + offset }],
    });
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

test.describe('mobile facility detail sheet close lifecycle', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('backdrop touch closes after every reopen and restores focus and page scrolling', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    const dialog = page.getByRole('dialog', { name: /机械工厂/ });
    const dialogLayer = page.locator('.workspace-dialog-layer');
    const pageScroll = page.locator('.page-scroll');

    await expect(trigger).toBeVisible();
    const artwork = trigger.locator('[data-facility-icon="machine-factory"]');
    await expect(artwork).toHaveCount(1);
    await expect.poll(() => artwork.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('machine-factory');

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await trigger.tap();
      await expect(dialog).toBeVisible();
      await expect(dialogLayer.locator(':scope > .facility-detail-sheet-backdrop')).toHaveCount(1);
      await expect(pageScroll).toHaveCSS('overflow-y', 'hidden');
      await waitForSheetAnimations(dialog);

      const detailArtwork = dialog.locator('.facility-detail-artwork-icon');
      await expect(detailArtwork).toHaveCount(1);
      await expect.poll(() => detailArtwork.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('machine-factory');
      await expect(dialog.locator('.facility-staffing-track')).toBeVisible();
      await expect(dialog.locator('.facility-staffing-fill')).toBeVisible();

      const backdropBox = await dialogLayer.locator(':scope > .facility-detail-sheet-backdrop').boundingBox();
      expect(backdropBox).not.toBeNull();
      if (!backdropBox) throw new Error('工厂详情遮罩几何不可用');
      expect(backdropBox.x).toBe(0);
      expect(backdropBox.y).toBe(0);
      expect(backdropBox.width).toBe(390);
      expect(backdropBox.height).toBe(844);

      const navigation = page.locator('.mobile-bottom-navigation');
      const navigationBox = await navigation.boundingBox();
      expect(navigationBox).not.toBeNull();
      if (!navigationBox) throw new Error('移动导航几何不可用');
      const navigationCovered = await page.evaluate(({ x, y }) => Boolean(
        document.elementFromPoint(x, y)?.closest('.facility-detail-sheet-backdrop'),
      ), {
        x: navigationBox.x + navigationBox.width / 2,
        y: navigationBox.y + navigationBox.height / 2,
      });
      expect(navigationCovered).toBe(true);

      const sheetBox = await dialog.boundingBox();
      expect(sheetBox).not.toBeNull();
      expect(sheetBox!.y).toBeGreaterThan(8);
      expect(sheetBox!.y).toBeLessThan(844);
      await page.touchscreen.tap(sheetBox!.x + sheetBox!.width / 2, Math.max(8, sheetBox!.y / 2));

      await expect(dialog).toBeHidden();
      await expect(pageScroll).toHaveCSS('overflow-y', 'auto');
      await expect(trigger).toBeFocused();
    }
  });

  test('detail scroll area reuses the shared overlay scrollbar geometry', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    const dialog = page.getByRole('dialog', { name: /机械工厂/ });
    await trigger.tap();
    await expect(dialog).toBeVisible();
    await waitForSheetAnimations(dialog);

    const scrollArea = dialog.locator('.facility-detail-sheet-scroll-area');
    const viewport = scrollArea.locator('.facility-detail-sheet-scroll');
    await expect(scrollArea).toHaveCount(1);
    await expect(viewport).toHaveCount(1);
    const geometry = await scrollArea.evaluate((root) => {
      const viewportElement = root.querySelector('.facility-detail-sheet-scroll') as HTMLElement | null;
      const rail = root.querySelector(':scope > .ui-scrollbar--vertical') as HTMLElement | null;
      const thumb = rail?.querySelector('.ui-scrollbar__thumb') as HTMLElement | null;
      if (!viewportElement || !rail || !thumb) throw new Error('工厂详情滚动条结构缺失');

      const rootRect = root.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const thumbRect = thumb.getBoundingClientRect();
      const viewportStyle = getComputedStyle(viewportElement);
      const rootStyle = getComputedStyle(document.documentElement);
      return {
        paddingLeft: Number.parseFloat(viewportStyle.paddingLeft),
        paddingRight: Number.parseFloat(viewportStyle.paddingRight),
        railWidth: railRect.width,
        thumbWidth: thumbRect.width,
        railRightInset: rootRect.right - railRect.right,
        thumbRightInset: rootRect.right - thumbRect.right,
        hitSize: Number.parseFloat(rootStyle.getPropertyValue('--scrollbar-hit-size')),
        visualSize: Number.parseFloat(rootStyle.getPropertyValue('--scrollbar-visual-size')),
        edgeOffset: Number.parseFloat(rootStyle.getPropertyValue('--scrollbar-edge-offset')),
      };
    });

    expect(geometry.paddingRight).toBeCloseTo(geometry.paddingLeft, 1);
    expect(geometry.railWidth).toBeCloseTo(geometry.hitSize, 1);
    expect(geometry.thumbWidth).toBeCloseTo(geometry.visualSize, 1);
    expect(geometry.railRightInset).toBeCloseTo(0, 1);
    expect(geometry.thumbRightInset).toBeCloseTo(geometry.edgeOffset, 1);
  });

  test('swipe close restores the touch surface visual while preserving semantic focus', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    const dialog = page.getByRole('dialog', { name: /机械工厂/ });
    const handle = page.locator('.facility-detail-sheet-drag-handle');
    const pageScroll = page.locator('.page-scroll');
    await page.mouse.move(1, 1);

    const baseVisual = await trigger.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.background,
        borderColor: style.borderColor,
      };
    });

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await trigger.tap();
      await expect(dialog).toBeVisible();
      await waitForSheetAnimations(dialog);
      await swipeDown(page, handle);

      await expect(dialog).toBeHidden();
      await expect(pageScroll).toHaveCSS('overflow-y', 'auto');
      await expect(trigger).toBeFocused();
      await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'touch');

      const closedVisual = await trigger.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          background: style.background,
          borderColor: style.borderColor,
          transform: style.transform,
          outlineStyle: style.outlineStyle,
          boxShadow: style.boxShadow,
        };
      });
      expect(closedVisual.background).toBe(baseVisual.background);
      expect(closedVisual.borderColor).toBe(baseVisual.borderColor);
      expect(closedVisual.transform).toBe('none');
      expect(closedVisual.outlineStyle).toBe('none');
      expect(closedVisual.boxShadow).toBe('none');
    }
  });

  test('keyboard escape keeps the returned trigger focus visibly accessible', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    const dialog = page.getByRole('dialog', { name: /机械工厂/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await waitForSheetAnimations(dialog);
    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'keyboard');
    const focusVisual = await trigger.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    expect(focusVisual.outlineStyle).toBe('solid');
    expect(focusVisual.outlineWidth).toBe('2px');
    expect(focusVisual.boxShadow).not.toBe('none');
  });
});
