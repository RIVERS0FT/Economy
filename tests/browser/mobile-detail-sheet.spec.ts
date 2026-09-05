import { expect, test, type Locator, type Page } from '@playwright/test';

async function waitForSheetAnimations(surface: Locator) {
  await expect.poll(() => surface.evaluate((element) => (
    element.getAnimations().every((animation) => animation.playState === 'finished')
  ))).toBe(true);
}

async function swipeDown(page: Page, handle: Locator, distance = 180) {
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('mobile detail drag handle geometry is unavailable');
  const x = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
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

async function openResearchDetail(page: Page) {
  const trigger = page.getByRole('button', { name: /冶金技术，研发中/ });
  const dialog = page.getByRole('dialog', { name: '冶金技术研发新技术' });
  await expect(trigger).toBeVisible();
  await trigger.tap();
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test.describe('shared mobile detail sheet close lifecycle', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('factory detail remains a page-level view without activating the shared detail sheet', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const host = page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet');
    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    await expect(host).toBeVisible();
    await expect(host).toHaveAttribute('data-detail-active', 'false');
    await expect(page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet')).toHaveCount(1);

    await trigger.tap();
    await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();
    await expect(page.locator('.facility-cluster-selector-region')).toHaveCount(0);
    await expect(host).toHaveAttribute('data-detail-active', 'false');
    await expect(host.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);
  });

  test('research detail reuses the existing mobile sheet host and restores focus on escape', async ({ page }) => {
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const host = page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet');
    await expect(host).toBeVisible();
    await expect(host).toHaveAttribute('data-detail-active', 'false');
    await host.evaluate((element) => {
      element.dataset.sheetInstanceProbe = 'research-stable';
    });

    const { trigger, dialog } = await openResearchDetail(page);
    await expect(host).toHaveAttribute('data-detail-active', 'true');
    await expect(host).toHaveAttribute('data-sheet-instance-probe', 'research-stable');
    await expect(page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet')).toHaveCount(1);
    await expect(host.locator('.mobile-workspace-sheet-detail-view')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(host).toHaveAttribute('data-detail-active', 'false');
    await expect(host).toHaveAttribute('data-sheet-instance-probe', 'research-stable');
    await expect(host.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('backdrop touch closes after every reopen and restores focus while root scroll suppression stays active', async ({ page }) => {
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const trigger = page.getByRole('button', { name: /冶金技术，研发中/ });
    const dialog = page.getByRole('dialog', { name: '冶金技术研发新技术' });
    const host = page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet');
    const dialogLayer = page.locator('.workspace-dialog-layer');
    const pageScroll = page.locator('.page-scroll');
    const pageScrollArea = page.locator('.page-scroll-area');
    const navigation = page.locator('.mobile-bottom-navigation');

    await expect(trigger).toBeVisible();
    await expect(navigation).toHaveAttribute('data-workspace-sheet-hidden', 'true');
    await expect(navigation).toBeHidden();

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await trigger.tap();
      await expect(dialog).toBeVisible();
      await expect(host).toHaveAttribute('data-detail-active', 'true');
      await expect(dialogLayer.locator(':scope > .mobile-detail-sheet-backdrop')).toHaveCount(1);
      await expect(page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet')).toHaveCount(1);
      await expect(pageScroll).toHaveCSS('overflow-y', 'hidden');
      await expect(pageScrollArea).toHaveAttribute('data-modal-scrollbar-suppressed', 'true');
      await expect(navigation).toHaveAttribute('data-workspace-sheet-hidden', 'true');
      await expect(navigation).toBeHidden();
      const detailView = host.locator('.mobile-workspace-sheet-detail-view');
      await waitForSheetAnimations(detailView);
      await expect(detailView).toContainText('研发投入');
      await expect(detailView.locator('.mobile-detail-summary')).toHaveCount(1);
      await expect(detailView.locator('.mobile-detail-sheet-footer')).toBeVisible();
      await expect(detailView.locator('.mobile-detail-sheet-header > :not(.mobile-detail-sheet-drag-handle)')).toHaveCount(0);

      const backdropBox = await dialogLayer.locator(':scope > .mobile-detail-sheet-backdrop').boundingBox();
      expect(backdropBox).not.toBeNull();
      if (!backdropBox) throw new Error('shared detail backdrop geometry is unavailable');
      expect(backdropBox.x).toBe(0);
      expect(backdropBox.y).toBe(0);
      expect(backdropBox.width).toBe(390);
      expect(backdropBox.height).toBe(844);

      const hiddenNavigation = await navigation.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          width: box.width,
          height: box.height,
          visibility: style.visibility,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
        };
      });
      expect(hiddenNavigation.width).toBeGreaterThan(0);
      expect(hiddenNavigation.height).toBeCloseTo(68, 0);
      expect(hiddenNavigation.visibility).toBe('hidden');
      expect(hiddenNavigation.opacity).toBe('0');
      expect(hiddenNavigation.pointerEvents).toBe('none');

      const hostBox = await host.boundingBox();
      const statusBox = await page.locator('.asset-bar').boundingBox();
      expect(hostBox).not.toBeNull();
      expect(statusBox).not.toBeNull();
      if (!hostBox || !statusBox) throw new Error('shared mobile sheet or status bar geometry is unavailable');
      const statusBottom = statusBox.y + statusBox.height;
      expect(hostBox.y).toBeGreaterThan(statusBottom);
      const backdropTapPoint = {
        x: hostBox.x + hostBox.width / 2,
        y: statusBottom + (hostBox.y - statusBottom) / 2,
      };
      const hitsBackdrop = await page.evaluate(({ x, y }) => Boolean(
        document.elementFromPoint(x, y)?.closest('.mobile-detail-sheet-backdrop'),
      ), backdropTapPoint);
      expect(hitsBackdrop).toBe(true);
      await page.touchscreen.tap(backdropTapPoint.x, backdropTapPoint.y);

      await expect(dialog).toBeHidden();
      await expect(host).toHaveAttribute('data-detail-active', 'false');
      await expect(host).toBeVisible();
      await expect(pageScroll).toHaveCSS('overflow-y', 'hidden');
      await expect(pageScrollArea).toHaveAttribute('data-modal-scrollbar-suppressed', 'true');
      await expect(navigation).toHaveAttribute('data-workspace-sheet-hidden', 'true');
      await expect(trigger).toBeFocused();
    }
  });

  test('detail view opens with stable monotonic geometry without moving the root sheet', async ({ page }) => {
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const trigger = page.getByRole('button', { name: /冶金技术，研发中/ });
    const dialog = page.getByRole('dialog', { name: '冶金技术研发新技术' });
    const host = page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet');
    const pageScroll = page.locator('.page-scroll');
    await expect(trigger).toBeVisible();

    const initialHostBox = await host.boundingBox();
    expect(initialHostBox).not.toBeNull();
    const initialScrollTop = await pageScroll.evaluate((element) => element.scrollTop);
    const opening = await trigger.evaluate(async (element) => {
      const frames: Array<{ y: number; height: number; hostY: number; hostHeight: number }> = [];
      const pageScrollElement = document.querySelector<HTMLElement>('.page-scroll');
      (element as HTMLElement).click();
      for (let index = 0; index < 18; index += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const sheet = document.querySelector<HTMLElement>('.mobile-workspace-sheet-host');
        const detail = document.querySelector<HTMLElement>('.mobile-workspace-sheet-detail-view');
        if (!sheet || !detail) continue;
        const sheetRect = sheet.getBoundingClientRect();
        const detailRect = detail.getBoundingClientRect();
        frames.push({
          y: detailRect.y,
          height: detailRect.height,
          hostY: sheetRect.y,
          hostHeight: sheetRect.height,
        });
      }
      return {
        frames,
        scrollTop: pageScrollElement?.scrollTop ?? -1,
        focused: document.activeElement?.classList.contains('mobile-workspace-sheet-detail-view') ?? false,
      };
    });

    await expect(dialog).toBeVisible();
    expect(opening.frames.length).toBeGreaterThanOrEqual(8);
    const heights = opening.frames.map((frame) => frame.height);
    const hostHeights = opening.frames.map((frame) => frame.hostHeight);
    const hostYPositions = opening.frames.map((frame) => frame.hostY);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    expect(Math.max(...hostHeights) - Math.min(...hostHeights)).toBeLessThanOrEqual(1);
    expect(Math.max(...hostYPositions) - Math.min(...hostYPositions)).toBeLessThanOrEqual(1);
    for (let index = 1; index < opening.frames.length; index += 1) {
      expect(opening.frames[index].y).toBeLessThanOrEqual(opening.frames[index - 1].y + 1);
    }
    expect(opening.scrollTop).toBe(initialScrollTop);
    expect(opening.focused).toBe(true);

    const finalHostBox = await host.boundingBox();
    expect(finalHostBox).not.toBeNull();
    if (!initialHostBox || !finalHostBox) throw new Error('shared mobile sheet geometry is unavailable');
    expect(finalHostBox.y).toBeCloseTo(initialHostBox.y, 0);
    expect(finalHostBox.height).toBeCloseTo(initialHostBox.height, 0);

    await waitForSheetAnimations(host.locator('.mobile-workspace-sheet-detail-view'));
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(host).toHaveAttribute('data-detail-active', 'false');
  });

  test('detail scroll area reuses the shared overlay scrollbar geometry', async ({ page }) => {
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const { dialog } = await openResearchDetail(page);
    const host = page.locator('.mobile-workspace-sheet-host');
    const detailView = host.locator('.mobile-workspace-sheet-detail-view');
    await waitForSheetAnimations(detailView);
    await expect(dialog).toBeVisible();

    const scrollArea = detailView.locator('.mobile-detail-sheet-scroll-area');
    const viewport = scrollArea.locator('.mobile-detail-sheet-scroll');
    await expect(scrollArea).toHaveCount(1);
    await expect(viewport).toHaveCount(1);
    const geometry = await scrollArea.evaluate((root) => {
      const viewportElement = root.querySelector('.mobile-detail-sheet-scroll') as HTMLElement | null;
      const rail = root.querySelector(':scope > .ui-scrollbar--vertical') as HTMLElement | null;
      const thumb = rail?.querySelector('.ui-scrollbar__thumb') as HTMLElement | null;
      if (!viewportElement || !rail || !thumb) throw new Error('shared detail scrollbar structure is incomplete');

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
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const trigger = page.getByRole('button', { name: /冶金技术，研发中/ });
    const dialog = page.getByRole('dialog', { name: '冶金技术研发新技术' });
    const host = page.locator('.mobile-workspace-sheet-host');
    const pageScroll = page.locator('.page-scroll');
    const pageScrollArea = page.locator('.page-scroll-area');
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
      const detailView = host.locator('.mobile-workspace-sheet-detail-view');
      await waitForSheetAnimations(detailView);
      await swipeDown(page, detailView.locator('.mobile-detail-sheet-drag-handle'));

      await expect(dialog).toBeHidden();
      await expect(host).toHaveAttribute('data-detail-active', 'false');
      await expect(pageScroll).toHaveCSS('overflow-y', 'hidden');
      await expect(pageScrollArea).toHaveAttribute('data-modal-scrollbar-suppressed', 'true');
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
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const trigger = page.getByRole('button', { name: /冶金技术，研发中/ });
    const dialog = page.getByRole('dialog', { name: '冶金技术研发新技术' });
    const host = page.locator('.mobile-workspace-sheet-host');
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await waitForSheetAnimations(host.locator('.mobile-workspace-sheet-detail-view'));
    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(host).toHaveAttribute('data-detail-active', 'false');
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

test.describe('shared mobile detail sheet full-width geometry', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  for (const width of [320, 390, 430, 720]) {
    test(`sheet fills the ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('runtime-test.html?view=research&scenario=research-active');

      const trigger = page.getByRole('button', { name: /冶金技术，研发中/ });
      const dialog = page.getByRole('dialog', { name: '冶金技术研发新技术' });
      const host = page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet');
      const backdrop = page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop');

      await expect(host).toBeVisible();
      await trigger.tap();
      await expect(dialog).toBeVisible();
      const detailView = host.locator('.mobile-workspace-sheet-detail-view');
      await waitForSheetAnimations(detailView);

      const backdropBox = await backdrop.boundingBox();
      const sheetBox = await host.boundingBox();
      const detailBox = await detailView.boundingBox();
      expect(backdropBox).not.toBeNull();
      expect(sheetBox).not.toBeNull();
      expect(detailBox).not.toBeNull();
      if (!backdropBox || !sheetBox || !detailBox) throw new Error('shared mobile detail full-width geometry is unavailable');

      expect(backdropBox.x).toBeCloseTo(0, 1);
      expect(backdropBox.width).toBeCloseTo(width, 1);
      expect(sheetBox.x).toBeCloseTo(0, 1);
      expect(sheetBox.width).toBeCloseTo(width, 1);
      expect(detailBox.x).toBeCloseTo(sheetBox.x + 1, 1);
      expect(detailBox.width).toBeCloseTo(sheetBox.width - 2, 1);

      const alignment = await backdrop.evaluate((element) => {
        const backdropStyle = getComputedStyle(element);
        const sheet = element.querySelector<HTMLElement>('.mobile-detail-sheet');
        if (!sheet) throw new Error('shared mobile detail sheet is missing');
        const sheetStyle = getComputedStyle(sheet);
        return {
          display: backdropStyle.display,
          gridTemplateColumns: backdropStyle.gridTemplateColumns,
          justifyContent: backdropStyle.justifyContent,
          justifyItems: backdropStyle.justifyItems,
          sheetJustifySelf: sheetStyle.justifySelf,
        };
      });
      expect(alignment.display).toBe('grid');
      expect(alignment.gridTemplateColumns).not.toBe('none');
      expect(alignment.justifyContent).toBe('stretch');
      expect(alignment.justifyItems).toBe('stretch');
      expect(alignment.sheetJustifySelf).toBe('stretch');

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(host).toBeVisible();
      await expect(host).toHaveAttribute('data-detail-active', 'false');
    });
  }
});
