import { expect, test } from '@playwright/test';

test.describe('research technology tree', () => {
  test('renders seven stages and split technology nodes', async ({ page }) => {
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
    await expect(page.locator('.research-stage-node')).toHaveCount(7);
    await expect(page.locator('.research-technology-node')).toHaveCount(24);
    const researchGeometry = await page.evaluate(() => {
      const action = document.querySelector<HTMLElement>('.research-action-panel')?.getBoundingClientRect();
      const tree = document.querySelector<HTMLElement>('.research-tree-panel')?.getBoundingClientRect();
      const stage = document.querySelector<HTMLElement>('.research-stage-node');
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
        stageRadius: stage ? getComputedStyle(stage).borderRadius : '',
        detailArtworkWidth: detailArtworkBox?.width ?? 0,
        detailArtworkHeight: detailArtworkBox?.height ?? 0,
        detailArtworkAspectRatio: detailArtworkStyle?.aspectRatio ?? '',
        expectedDetailArtworkSize: rootFontSize * 4.5,
        fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
      };
    });

    expect(Math.abs(researchGeometry.actionWidth - productionGeometry.actionWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentLeft - productionGeometry.contentLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentRight - productionGeometry.contentRight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.stageRadius).toBe('50%');
    expect(researchGeometry.detailArtworkWidth).toBeCloseTo(researchGeometry.expectedDetailArtworkSize, 0);
    expect(Math.abs(researchGeometry.detailArtworkWidth - researchGeometry.detailArtworkHeight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.detailArtworkAspectRatio).toBe('1 / 1');
    expect(researchGeometry.fitsViewport).toBe(true);
  });

  test('preserves an explicit technology selection across refreshed snapshots', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const applianceNode = page.getByRole('button', { name: /家电工程，尚未开放/ });
    await applianceNode.click();
    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');

    const assetsButton = page.locator('button').filter({ hasText: '净资产' }).first();
    await expect(assetsButton).toBeVisible();
    await assetsButton.click();

    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');
    await expect(page.getByRole('button', { name: /冶金技术，研发中/ })).toHaveAttribute('aria-pressed', 'false');
  });

  test('shows concrete prerequisite requirements and active acceleration', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    await page.getByRole('button', { name: /家电工程，尚未开放/ }).click();
    await expect(page.locator('.research-action-panel')).toContainText('还需完成');
    await expect(page.locator('.research-action-panel')).toContainText('电子工程');
    await expect(page.locator('.research-action-panel')).toContainText('研发费用');

    await page.getByRole('button', { name: /冶金技术，研发中/ }).click();
    await expect(page.locator('.research-action-panel')).toContainText('宝石加速');
    await expect(page.getByRole('button', { name: '1 宝石 · 加速 30m' })).toBeVisible();
  });

  test('uses the stored base duration for accelerated node research progress', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-accelerated');

    await expect(page.getByRole('progressbar', { name: '机械工程研发进度' })).toHaveAttribute('aria-valuenow', '67');
    const ringProgress = await page.getByRole('button', { name: /机械工程，研发中/ }).evaluate((element) => (
      getComputedStyle(element).getPropertyValue('--research-node-progress').trim()
    ));
    expect(ringProgress).toBe('240deg');
  });

  test('opens technology details in the shared mobile sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    await expect(page.locator('.research-action-panel')).toBeHidden();
    await expect(page.locator('.research-tree')).toBeVisible();
    const activeNode = page.getByRole('button', { name: /冶金技术，研发中/ });
    await activeNode.click();
    const dialog = page.getByRole('dialog', { name: '冶金技术研发新技术' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/mobile-detail-sheet/);
    await expect(dialog).toContainText('具体要求');
    await expect(dialog).toContainText('宝石加速');
    await expect(dialog.locator('.mobile-detail-summary')).toBeVisible();
    await expect(dialog.locator('.mobile-detail-sheet-footer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(activeNode).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
