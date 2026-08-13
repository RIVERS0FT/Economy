import { expect, test } from '@playwright/test';

test.describe('research technology tree', () => {
  test('renders a downward prerequisite tree on desktop', async ({ page }) => {
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
    await expect(page.locator('.research-stage-node')).toHaveCount(0);
    await expect(page.locator('.research-technology-node')).toHaveCount(32);
    const researchGeometry = await page.evaluate(() => {
      const action = document.querySelector<HTMLElement>('.research-action-panel')?.getBoundingClientRect();
      const treePanel = document.querySelector<HTMLElement>('.research-tree-panel')?.getBoundingClientRect();
      const tree = document.querySelector<HTMLElement>('.research-tree');
      const treeScroll = document.querySelector<HTMLElement>('.research-tree-scroll');
      const detailArtwork = document.querySelector<HTMLElement>('.research-action-panel .research-detail-level-artwork');
      const detailArtworkBox = detailArtwork?.getBoundingClientRect();
      const detailArtworkStyle = detailArtwork ? getComputedStyle(detailArtwork) : null;
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.research-technology-node'));
      const topById = new Map(nodes.map((node) => [node.dataset.technologyId ?? '', node.getBoundingClientRect().top]));
      const allDependenciesDownward = nodes.every((node) => {
        const childTop = node.getBoundingClientRect().top;
        const prerequisiteIds = (node.dataset.prerequisites ?? '').split(',').filter(Boolean);
        return prerequisiteIds.every((parentId) => childTop > (topById.get(parentId) ?? -Infinity) + 24);
      });
      return {
        actionWidth: action?.width ?? 0,
        contentLeft: treePanel?.left ?? 0,
        contentRight: treePanel?.right ?? 0,
        detailArtworkWidth: detailArtworkBox?.width ?? 0,
        detailArtworkHeight: detailArtworkBox?.height ?? 0,
        detailArtworkAspectRatio: detailArtworkStyle?.aspectRatio ?? '',
        expectedDetailArtworkSize: rootFontSize * 4.5,
        layoutDirection: tree?.dataset.layoutDirection ?? '',
        connectionCount: document.querySelectorAll('.research-tree-connections--desktop .research-tree-edge').length,
        allDependenciesDownward,
        treeOwnsHorizontalOverflow: (treeScroll?.scrollWidth ?? 0) >= (treeScroll?.clientWidth ?? 0),
        fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
      };
    });

    expect(Math.abs(researchGeometry.actionWidth - productionGeometry.actionWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentLeft - productionGeometry.contentLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentRight - productionGeometry.contentRight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.detailArtworkWidth).toBeCloseTo(researchGeometry.expectedDetailArtworkSize, 0);
    expect(Math.abs(researchGeometry.detailArtworkWidth - researchGeometry.detailArtworkHeight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.detailArtworkAspectRatio).toBe('1 / 1');
    expect(researchGeometry.layoutDirection).toBe('downward');
    expect(researchGeometry.connectionCount).toBeGreaterThan(0);
    expect(researchGeometry.allDependenciesDownward).toBe(true);
    expect(researchGeometry.treeOwnsHorizontalOverflow).toBe(true);
    expect(researchGeometry.fitsViewport).toBe(true);
  });

  test('keeps node geometry stable on hover and selected dependency lines visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');
    const node = page.getByRole('button', { name: /工具作业，可研发，C2 作业科技/ });
    await node.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const before = await node.boundingBox();
    await node.hover();
    const after = await node.boundingBox();
    expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(2);
    await expect(node).toHaveCSS('translate', '-50% -50%');
    await node.click();
    const state = await page.evaluate(() => {
      const check = (selector: string) => {
        const edges = Array.from(document.querySelectorAll(selector));
        return { count: edges.length, visible: edges.every((edge) => getComputedStyle(edge).stroke !== 'none') };
      };
      return { highlighted: check('.research-tree-connections--desktop [data-highlighted=\"true\"]'), related: check('.research-tree-connections--desktop [data-related=\"true\"]') };
    });
    expect(state.highlighted.count).toBeGreaterThan(0);
    expect(state.related.count).toBeGreaterThan(0);
    expect(state.highlighted.visible).toBe(true);
    expect(state.related.visible).toBe(true);
  });

  test('distinguishes operation research from production research', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const toolOperation = page.getByRole('button', { name: /工具作业，可研发，C2 作业科技/ });
    await toolOperation.click();
    const panel = page.locator('.research-action-panel');
    await expect(panel).toContainText('工具作业');
    await expect(panel).toContainText('作业科技');
    await expect(panel).toContainText('解锁作业制度');
    await expect(panel).toContainText('工具');
    await expect(panel).not.toContainText('工具作坊');

    const toolManufacturing = page.getByRole('button', { name: /工具制造，尚未开放，C4 生产科技/ });
    await toolManufacturing.click();
    await expect(panel).toContainText('生产科技');
    await expect(panel).toContainText('解锁工厂');
  });

  test('preserves an explicit technology selection across refreshed snapshots', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const applianceNode = page.getByRole('button', { name: /家电工程，尚未开放/ });
    await applianceNode.click();
    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');
    const beforeRefreshPosition = await applianceNode.evaluate((element) => ({
      x: (element as HTMLElement).style.getPropertyValue('--research-node-desktop-x'),
      y: (element as HTMLElement).style.getPropertyValue('--research-node-desktop-y'),
    }));

    const assetsButton = page.locator('button').filter({ hasText: '净资产' }).first();
    await expect(assetsButton).toBeVisible();
    await assetsButton.click();

    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');
    await expect(page.getByRole('button', { name: /冶金技术，研发中/ })).toHaveAttribute('aria-pressed', 'false');
    const afterRefreshPosition = await applianceNode.evaluate((element) => ({
      x: (element as HTMLElement).style.getPropertyValue('--research-node-desktop-x'),
      y: (element as HTMLElement).style.getPropertyValue('--research-node-desktop-y'),
    }));
    expect(afterRefreshPosition).toEqual(beforeRefreshPosition);
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

  test('keeps every mobile dependency below its prerequisite without horizontal tree scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const geometry = await page.evaluate(() => {
      const treeScroll = document.querySelector<HTMLElement>('.research-tree-scroll');
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.research-technology-node'));
      const topById = new Map(nodes.map((node) => [node.dataset.technologyId ?? '', node.getBoundingClientRect().top]));
      const allDependenciesDownward = nodes.every((node) => {
        const childTop = node.getBoundingClientRect().top;
        const prerequisiteIds = (node.dataset.prerequisites ?? '').split(',').filter(Boolean);
        return prerequisiteIds.every((parentId) => childTop > (topById.get(parentId) ?? -Infinity) + 20);
      });
      return {
        allDependenciesDownward,
        treeHasNoHorizontalScroll: (treeScroll?.scrollWidth ?? 0) <= (treeScroll?.clientWidth ?? 0) + 1,
        pageFitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
        mobileConnectionsVisible: getComputedStyle(document.querySelector<HTMLElement>('.research-tree-connections--mobile')!).display !== 'none',
      };
    });

    expect(geometry.allDependenciesDownward).toBe(true);
    expect(geometry.treeHasNoHorizontalScroll).toBe(true);
    expect(geometry.pageFitsViewport).toBe(true);
    expect(geometry.mobileConnectionsVisible).toBe(true);
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
