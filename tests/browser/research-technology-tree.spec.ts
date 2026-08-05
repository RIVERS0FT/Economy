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
      return {
        actionWidth: action?.width ?? 0,
        contentLeft: tree?.left ?? 0,
        contentRight: tree?.right ?? 0,
        nodeRadius: node ? getComputedStyle(node).borderRadius : '',
        fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
      };
    });

    expect(Math.abs(researchGeometry.actionWidth - productionGeometry.actionWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentLeft - productionGeometry.contentLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentRight - productionGeometry.contentRight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.nodeRadius).toBe('50%');
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
    await expect(dialog).toContainText('具体要求');
    await expect(dialog).toContainText('宝石加速');
    await expect(dialog.getByRole('button', { name: '1 宝石 · 加速 30m' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(activeNode).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
