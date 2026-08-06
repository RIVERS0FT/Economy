import { expect, test } from '@playwright/test';

test.describe('research technology tree', () => {
  test('shares production workspace tracks and renders circular image nodes', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });

    await page.goto('runtime-test.html?view=production&scenario=facility-order');
    const productionGeometry = await page.evaluate(() => {
      const build = document.querySelector<HTMLElement>('.production-build-card')?.getBoundingClientRect();
      const navigation = document.querySelector<HTMLElement>('.facility-cluster-navigation')?.getBoundingClientRect();
      const detail = document.querySelector<HTMLElement>('.facility-cluster-detail-card')?.getBoundingClientRect();
      return {
        actionWidth: build?.width ?? 0,
        contentLeft: navigation?.left ?? 0,
        contentRight: detail?.right ?? 0,
      };
    });

    await page.goto('runtime-test.html?view=research&scenario=research-active');
    const levels = page.locator('.research-level-node');
    await expect(levels).toHaveCount(7);
    await expect(page.locator('.research-facility-node')).toHaveCount(10);
    const researchGeometry = await page.evaluate(() => {
      const action = document.querySelector<HTMLElement>('.research-action-panel')?.getBoundingClientRect();
      const tree = document.querySelector<HTMLElement>('.research-tree-panel')?.getBoundingClientRect();
      const node = document.querySelector<HTMLElement>('.research-level-node');
      const detailArtwork = document.querySelector<HTMLElement>(
        '.research-action-panel .research-detail-level-artwork',
      );
      const detailArtworkBox = detailArtwork?.getBoundingClientRect();
      const detailArtworkStyle = detailArtwork ? getComputedStyle(detailArtwork) : null;
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      return {
        actionWidth: action?.width ?? 0,
        contentLeft: tree?.left ?? 0,
        contentRight: tree?.right ?? 0,
        nodeRadius: node ? getComputedStyle(node).borderRadius : '',
        detailArtworkWidth: detailArtworkBox?.width ?? 0,
        detailArtworkHeight: detailArtworkBox?.height ?? 0,
        detailArtworkAspectRatio: detailArtworkStyle?.aspectRatio ?? '',
        detailArtworkRadius: detailArtworkStyle?.borderRadius ?? '',
        expectedDetailArtworkSize: rootFontSize * 4.5,
        fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
      };
    });

    expect(Math.abs(researchGeometry.actionWidth - productionGeometry.actionWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentLeft - productionGeometry.contentLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentRight - productionGeometry.contentRight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.nodeRadius).toBe('50%');
    expect(researchGeometry.detailArtworkWidth).toBeCloseTo(researchGeometry.expectedDetailArtworkSize, 0);
    expect(Math.abs(researchGeometry.detailArtworkWidth - researchGeometry.detailArtworkHeight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.detailArtworkAspectRatio).toBe('1 / 1');
    expect(researchGeometry.detailArtworkRadius).toBe('50%');
    expect(researchGeometry.fitsViewport).toBe(true);
    await expect(page.locator('.research-level-node').nth(2).locator('.facility-icon')).toHaveAttribute('data-facility-icon');
  });

  test('clicking a node updates concrete requirements and active research acceleration', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    await page.getByRole('button', { name: /C4 产业技术/ }).click();
    await expect(page.locator('.research-action-panel')).toContainText('需要依次完成 C3');
    await expect(page.locator('.research-action-panel')).toContainText('研发费用');
    await expect(page.locator('.research-action-panel')).toContainText('解锁工厂');

    await page.getByRole('button', { name: /C3 产业技术，研发中/ }).click();
    await expect(page.locator('.research-action-panel')).toContainText('宝石加速');
    await expect(page.getByRole('button', { name: '1 宝石 · 加速 30m' })).toBeVisible();
  });

  test('uses the base duration for accelerated research progress', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-accelerated');

    await expect(page.getByRole('progressbar', { name: 'C5 研发进度' })).toHaveAttribute('aria-valuenow', '67');
    const ringProgress = await page.getByRole('button', { name: /C5 产业技术，研发中/ }).evaluate((element) => (
      getComputedStyle(element).getPropertyValue('--research-node-progress').trim()
    ));
    expect(ringProgress).toBe('240deg');
  });

  test('mobile hides the desktop action panel and opens the same detail in a bottom dialog', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    await expect(page.locator('.research-action-panel')).toBeHidden();
    await expect(page.locator('.research-tree')).toBeVisible();
    expect(await page.locator('.research-tree').evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
    ))).toBe(1);

    const activeNode = page.getByRole('button', { name: /C3 产业技术，研发中/ });
    await activeNode.click();
    const dialog = page.getByRole('dialog', { name: 'C3 研发新技术' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/mobile-detail-sheet/);
    await expect(dialog).toContainText('具体要求');
    await expect(dialog).toContainText('宝石加速');
    await expect(dialog.locator('.mobile-detail-summary')).toBeVisible();
    await expect(dialog.locator('.mobile-detail-sheet-footer')).toBeVisible();
    await expect(dialog.getByRole('button', { name: '1 宝石 · 加速 30m' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(activeNode).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('mobile research and factory details share the same sheet geometry', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const waitForStableSheetLayout = async () => {
      await page.locator('.mobile-detail-sheet').evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
    };

    const readGeometry = async () => page.locator('.mobile-detail-sheet').evaluate((sheet) => {
      const readBox = (selector: string) => sheet.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
      const sheetBox = sheet.getBoundingClientRect();
      const handleBox = readBox('.mobile-detail-sheet-handle');
      const viewport = sheet.querySelector<HTMLElement>('.mobile-detail-sheet-scroll');
      const footer = sheet.querySelector<HTMLElement>('.mobile-detail-sheet-footer');
      const summary = sheet.querySelector<HTMLElement>('.mobile-detail-summary');
      const artwork = sheet.querySelector<HTMLElement>('.mobile-detail-summary__artwork');
      const sheetStyle = getComputedStyle(sheet);
      const viewportStyle = viewport ? getComputedStyle(viewport) : null;
      const footerStyle = footer ? getComputedStyle(footer) : null;
      const summaryStyle = summary ? getComputedStyle(summary) : null;
      const artworkStyle = artwork ? getComputedStyle(artwork) : null;
      return {
        x: sheetBox.x,
        width: sheetBox.width,
        bottom: sheetBox.bottom,
        borderTopLeftRadius: sheetStyle.borderTopLeftRadius,
        gridRowCount: sheetStyle.gridTemplateRows.split(' ').filter(Boolean).length,
        handleWidth: handleBox?.width ?? 0,
        handleHeight: handleBox?.height ?? 0,
        viewportPaddingLeft: viewportStyle?.paddingLeft ?? '',
        viewportPaddingRight: viewportStyle?.paddingRight ?? '',
        footerPaddingLeft: footerStyle?.paddingLeft ?? '',
        footerPaddingRight: footerStyle?.paddingRight ?? '',
        footerPaddingBottom: footerStyle?.paddingBottom ?? '',
        summaryColumns: summaryStyle?.gridTemplateColumns ?? '',
        summaryGap: summaryStyle?.columnGap ?? '',
        artworkAspectRatio: artworkStyle?.aspectRatio ?? '',
      };
    });

    await page.goto('runtime-test.html?view=production&scenario=activity');
    await page.getByRole('button', { name: /机械工厂，数量 18，运行中/ }).click();
    const factoryDialog = page.getByRole('dialog', { name: /机械工厂/ });
    await expect(factoryDialog).toBeVisible();
    await waitForStableSheetLayout();
    const factoryGeometry = await readGeometry();
    await page.keyboard.press('Escape');
    await expect(factoryDialog).toBeHidden();

    await page.goto('runtime-test.html?view=research&scenario=research-active');
    await page.getByRole('button', { name: /C3 产业技术，研发中/ }).click();
    const researchDialog = page.getByRole('dialog', { name: 'C3 研发新技术' });
    await expect(researchDialog).toBeVisible();
    await waitForStableSheetLayout();
    const researchGeometry = await readGeometry();

    for (const key of ['x', 'width', 'bottom', 'handleWidth', 'handleHeight'] as const) {
      expect(researchGeometry[key]).toBeCloseTo(factoryGeometry[key], 1);
    }
    for (const key of [
      'borderTopLeftRadius',
      'viewportPaddingLeft',
      'viewportPaddingRight',
      'footerPaddingLeft',
      'footerPaddingRight',
      'footerPaddingBottom',
      'summaryColumns',
      'summaryGap',
      'artworkAspectRatio',
    ] as const) {
      expect(researchGeometry[key]).toBe(factoryGeometry[key]);
    }
    expect(factoryGeometry.gridRowCount).toBe(3);
    expect(researchGeometry.gridRowCount).toBe(factoryGeometry.gridRowCount);
  });
});
