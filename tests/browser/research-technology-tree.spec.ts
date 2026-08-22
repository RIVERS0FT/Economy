import { expect, test } from '@playwright/test';

test.describe('research technology tree', () => {
  test('renders a downward prerequisite tree on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });

    await page.goto('runtime-test.html?view=research&scenario=research-active');
    await expect(page.locator('.signed-in-shell__primary-card')).toHaveAttribute('data-frosted-glass-variant', 'workspaceCard');
    await expect(page.locator('.page-card-scroll-area')).toHaveCount(0);
    await expect(page.locator('.page-card-static')).toBeVisible();
    await expect(page.locator('.page-heading-actions')).toHaveCount(0);
    await expect(page.getByText('完整阶段', { exact: false })).toHaveCount(0);
    await expect(page.getByText('研发「石油炼化」', { exact: true })).toHaveCount(0);
    const fixedPageOverflow = await page.locator('.page-card-static').evaluate((element) => {
      const stack = element.querySelector<HTMLElement>(':scope > .ui-page-stack');
      if (!stack) throw new Error('fixed page stack is missing');
      const fixedBodyStyle = getComputedStyle(element);
      const stackStyle = getComputedStyle(stack);
      const stackChildren = Array.from(stack.children);
      return {
        overflowY: fixedBodyStyle.overflowY,
        paddingInlineStart: fixedBodyStyle.paddingInlineStart,
        paddingInlineEnd: fixedBodyStyle.paddingInlineEnd,
        scrollTop: element.scrollTop,
        stackRows: stackStyle.gridTemplateRows,
        stackAlignContent: stackStyle.alignContent,
        stackChildCount: stackChildren.length,
        stackOnlyWorkspace: stackChildren[0]?.classList.contains('research-workspace') ?? false,
        stackScrollHeight: stack.scrollHeight,
        stackClientHeight: stack.clientHeight,
      };
    });
    expect(fixedPageOverflow.overflowY).toBe('hidden');
    expect(fixedPageOverflow.paddingInlineStart).toBe('0px');
    expect(fixedPageOverflow.paddingInlineEnd).toBe('0px');
    expect(fixedPageOverflow.scrollTop).toBe(0);
    expect(fixedPageOverflow.stackRows).not.toBe('none');
    expect(fixedPageOverflow.stackAlignContent).toBe('stretch');
    expect(fixedPageOverflow.stackChildCount).toBe(1);
    expect(fixedPageOverflow.stackOnlyWorkspace).toBe(true);
    expect(fixedPageOverflow.stackScrollHeight).toBeLessThanOrEqual(fixedPageOverflow.stackClientHeight + 1);
    await expect(page.locator('.research-stage-node')).toHaveCount(0);
    await expect(page.locator('.research-technology-node')).toHaveCount(32);
    await expect(page.locator('.research-tree-heading')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '技术树' })).toHaveCount(0);
    await expect(page.getByText('32 项科技', { exact: true })).toHaveCount(0);
    const researchGeometry = await page.evaluate(() => {
      const action = document.querySelector<HTMLElement>('.research-action-panel')?.getBoundingClientRect();
      const fixedBody = document.querySelector<HTMLElement>('.page-card-static')?.getBoundingClientRect();
      const workspace = document.querySelector<HTMLElement>('.research-workspace')?.getBoundingClientRect();
      const treePanel = document.querySelector<HTMLElement>('.research-tree-panel')?.getBoundingClientRect();
      const treeViewportElement = document.querySelector<HTMLElement>('.research-tree-viewport');
      const treeViewport = treeViewportElement?.getBoundingClientRect();
      const primaryCard = document.querySelector<HTMLElement>('.signed-in-shell__primary-card');
      const primaryCardStyle = primaryCard ? getComputedStyle(primaryCard) : null;
      const primaryCardBeforeStyle = primaryCard ? getComputedStyle(primaryCard, '::before') : null;
      const treeViewportStyle = treeViewportElement ? getComputedStyle(treeViewportElement) : null;
      const actionElement = document.querySelector<HTMLElement>('.research-action-panel');
      const treePanelElement = document.querySelector<HTMLElement>('.research-tree-panel');
      const tree = document.querySelector<HTMLElement>('.research-tree');
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
        actionLeftInset: (action?.left ?? 0) - (treePanel?.left ?? 0),
        actionTopInset: (action?.top ?? 0) - (treePanel?.top ?? 0),
        actionInsideTree: actionElement?.parentElement === treePanelElement,
        fixedBody: fixedBody ? { left: fixedBody.left, right: fixedBody.right } : null,
        workspace: workspace ? { left: workspace.left, top: workspace.top, right: workspace.right, bottom: workspace.bottom } : null,
        treePanel: treePanel ? { left: treePanel.left, top: treePanel.top, right: treePanel.right, bottom: treePanel.bottom } : null,
        treeViewport: treeViewport ? { left: treeViewport.left, top: treeViewport.top, right: treeViewport.right, bottom: treeViewport.bottom } : null,
        layoutGutter: Number.parseFloat(getComputedStyle(treePanelElement!).getPropertyValue('--layout-gutter')),
        detailArtworkWidth: detailArtworkBox?.width ?? 0,
        detailArtworkHeight: detailArtworkBox?.height ?? 0,
        detailArtworkAspectRatio: detailArtworkStyle?.aspectRatio ?? '',
        expectedDetailArtworkSize: rootFontSize * 4.5,
        layoutDirection: tree?.dataset.layoutDirection ?? '',
        connectionCount: document.querySelectorAll('.research-tree-connections .research-tree-edge').length,
        allDependenciesDownward,
        viewportClipsCanvas: treeViewportStyle?.overflow === 'hidden',
        fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
        outerCard: primaryCardStyle && primaryCardBeforeStyle ? {
          borderTopWidth: primaryCardStyle.borderTopWidth,
          borderRadius: primaryCardStyle.borderRadius,
          backgroundColor: primaryCardStyle.backgroundColor,
          boxShadow: primaryCardStyle.boxShadow,
          backdropFilter: primaryCardStyle.backdropFilter,
          beforeDisplay: primaryCardBeforeStyle.display,
        } : null,
        treeSurface: treeViewportStyle ? {
          borderTopWidth: treeViewportStyle.borderTopWidth,
          borderRadius: treeViewportStyle.borderRadius,
          backgroundColor: treeViewportStyle.backgroundColor,
        } : null,
      };
    });

    expect(researchGeometry.actionInsideTree).toBe(true);
    expect(researchGeometry.actionWidth).toBeLessThanOrEqual(321);
    expect((researchGeometry.workspace?.right ?? 0) - (researchGeometry.workspace?.left ?? 0)).toBeGreaterThan(0);
    expect((researchGeometry.workspace?.bottom ?? 0) - (researchGeometry.workspace?.top ?? 0)).toBeGreaterThan(0);
    expect(researchGeometry.actionLeftInset).toBeCloseTo(researchGeometry.layoutGutter, 0);
    expect(researchGeometry.actionTopInset).toBeCloseTo(researchGeometry.layoutGutter, 0);
    expect(researchGeometry.workspace?.left).toBeCloseTo(researchGeometry.fixedBody?.left ?? 0, 0);
    expect(researchGeometry.workspace?.right).toBeCloseTo(researchGeometry.fixedBody?.right ?? 0, 0);
    expect(researchGeometry.treePanel).toEqual(researchGeometry.workspace);
    expect(researchGeometry.treeViewport).toEqual(researchGeometry.treePanel);
    expect(researchGeometry.detailArtworkWidth).toBeCloseTo(researchGeometry.expectedDetailArtworkSize, 0);
    expect(Math.abs(researchGeometry.detailArtworkWidth - researchGeometry.detailArtworkHeight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.detailArtworkAspectRatio).toBe('1 / 1');
    expect(researchGeometry.layoutDirection).toBe('downward');
    expect(researchGeometry.connectionCount).toBeGreaterThan(0);
    expect(researchGeometry.allDependenciesDownward).toBe(true);
    expect(researchGeometry.viewportClipsCanvas).toBe(true);
    expect(researchGeometry.fitsViewport).toBe(true);
    expect(researchGeometry.outerCard?.borderTopWidth).toBe('1px');
    expect(researchGeometry.outerCard?.borderRadius).not.toBe('0px');
    expect(researchGeometry.outerCard?.backgroundColor).toBe('rgba(5, 20, 14, 0.76)');
    expect(researchGeometry.outerCard?.boxShadow).not.toBe('none');
    expect(researchGeometry.outerCard?.backdropFilter).toContain('blur(18px)');
    expect(researchGeometry.outerCard?.beforeDisplay).not.toBe('none');
    expect(researchGeometry.treeSurface).toEqual({
      borderTopWidth: '0px',
      borderRadius: '0px',
      backgroundColor: 'rgba(0, 0, 0, 0)',
    });
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
      return { highlighted: check('.research-tree-connections [data-highlighted="true"]'), related: check('.research-tree-connections [data-related="true"]') };
    });
    expect(state.highlighted.count).toBeGreaterThan(0);
    expect(state.related.count).toBeGreaterThan(0);
    expect(state.highlighted.visible).toBe(true);
    expect(state.related.visible).toBe(true);
  });

  test('supports desktop drag, wheel zoom, and double-click focus without changing world coordinates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');
    const viewport = page.locator('.research-tree-viewport');
    const node = page.getByRole('button', { name: /工具作业，可研发，C2 作业科技/ });
    const activeNode = page.getByRole('button', { name: /冶金技术，研发中/ });
    const beforeWorld = await node.evaluate((element) => ({
      x: (element as HTMLElement).style.getPropertyValue('--research-node-x'),
      y: (element as HTMLElement).style.getPropertyValue('--research-node-y'),
    }));
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();

    // The fullscreen research host can fit the tree at its default zoom, where pan is
    // intentionally clamped to center. Zoom first so the regression exercises real panning.
    const zoomBefore = Number(await viewport.getAttribute('data-zoom'));
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
    await page.mouse.wheel(0, -420);
    await expect.poll(async () => Number(await viewport.getAttribute('data-zoom'))).toBeGreaterThan(zoomBefore);

    const findBlankPoint = () => viewport.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      for (const [rx, ry] of [[0.15, 0.82], [0.85, 0.82], [0.15, 0.2], [0.85, 0.2], [0.5, 0.86]]) {
        const x = rect.left + rect.width * rx;
        const y = rect.top + rect.height * ry;
        const target = document.elementFromPoint(x, y) as HTMLElement | null;
        if (target && element.contains(target) && !target.closest('.research-tree-controls, .research-technology-node')) {
          return { x, y };
        }
      }
      throw new Error('Could not find an empty research-tree interaction point');
    });
    const dragPoint = await findBlankPoint();
    const panBefore = {
      x: Number(await viewport.getAttribute('data-pan-x')),
      y: Number(await viewport.getAttribute('data-pan-y')),
    };
    await page.mouse.move(dragPoint.x, dragPoint.y);
    await page.mouse.down();
    await page.mouse.move(dragPoint.x - 40, dragPoint.y + 50, { steps: 4 });
    await page.mouse.up();
    const panAfter = {
      x: Number(await viewport.getAttribute('data-pan-x')),
      y: Number(await viewport.getAttribute('data-pan-y')),
    };
    expect(Math.hypot(panAfter.x - panBefore.x, panAfter.y - panBefore.y)).toBeGreaterThan(10);

    const zoomBeforeDoubleClick = Number(await viewport.getAttribute('data-zoom'));
    const doubleClickPoint = await findBlankPoint();
    await page.mouse.dblclick(doubleClickPoint.x, doubleClickPoint.y);
    await expect.poll(async () => Number(await viewport.getAttribute('data-zoom'))).toBeCloseTo(zoomBeforeDoubleClick, 3);
    const focusedGeometry = await page.evaluate(() => {
      const viewportRect = document.querySelector<HTMLElement>('.research-tree-viewport')!.getBoundingClientRect();
      const activeRect = document.querySelector<HTMLElement>('.research-technology-node[data-status="active"]')!.getBoundingClientRect();
      return {
        expectedX: viewportRect.left + viewportRect.width / 2,
        expectedY: viewportRect.top + viewportRect.height * 0.42,
        actualX: activeRect.left + activeRect.width / 2,
        actualY: activeRect.top + activeRect.height / 2,
      };
    });
    expect(Math.abs(focusedGeometry.actualX - focusedGeometry.expectedX)).toBeLessThanOrEqual(2);
    expect(Math.abs(focusedGeometry.actualY - focusedGeometry.expectedY)).toBeLessThanOrEqual(2);
    await expect(activeNode).toHaveAttribute('aria-pressed', 'true');

    const afterWorld = await node.evaluate((element) => ({
      x: (element as HTMLElement).style.getPropertyValue('--research-node-x'),
      y: (element as HTMLElement).style.getPropertyValue('--research-node-y'),
    }));
    expect(afterWorld).toEqual(beforeWorld);
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

    const mechanicalEngineering = page.getByRole('button', { name: /机械工程，尚未开放，C5 生产科技/ });
    await mechanicalEngineering.press('Enter');
    await expect(panel).toContainText('生产科技');
    await expect(panel).toContainText('解锁工厂');
    await expect(panel.getByLabel('机械厂可生产产物')).toContainText('机械');
  });

  test('preserves an explicit technology selection across refreshed snapshots', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const applianceNode = page.getByRole('button', { name: /家电工程，尚未开放/ });
    await applianceNode.press('Enter');
    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');
    const beforeRefreshPosition = await applianceNode.evaluate((element) => ({
      x: (element as HTMLElement).style.getPropertyValue('--research-node-x'),
      y: (element as HTMLElement).style.getPropertyValue('--research-node-y'),
    }));

    const assetsButton = page.locator('button').filter({ hasText: '净资产' }).first();
    await expect(assetsButton).toBeVisible();
    await assetsButton.click();

    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');
    await expect(page.getByRole('button', { name: /冶金技术，研发中/ })).toHaveAttribute('aria-pressed', 'false');
    const afterRefreshPosition = await applianceNode.evaluate((element) => ({
      x: (element as HTMLElement).style.getPropertyValue('--research-node-x'),
      y: (element as HTMLElement).style.getPropertyValue('--research-node-y'),
    }));
    expect(afterRefreshPosition).toEqual(beforeRefreshPosition);
  });

  test('shows only research cost and time while merging active acceleration into the research action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    await page.getByRole('button', { name: /家电工程，尚未开放/ }).press('Enter');
    const panel = page.locator('.research-action-panel');
    await expect(panel).toContainText('研发投入');
    await expect(panel).toContainText('研发费用');
    await expect(panel).toContainText('研发时间');
    await expect(panel).not.toContainText('具体要求');
    await expect(panel).not.toContainText('前置科技');
    await expect(panel).not.toContainText('研发队列');
    await expect(panel).not.toContainText('产业经营视角');
    await expect(panel).not.toContainText('就业资金已释放');

    await page.getByRole('button', { name: /冶金技术，研发中/ }).press('Enter');
    await expect(panel.getByRole('button', { name: '研发中 · 1 宝石加速 30m' })).toBeVisible();
    await expect(panel.locator('.research-gem-acceleration')).toHaveCount(0);
    await expect(panel).not.toContainText('使用后剩余');
    await expect(panel.locator('.research-detail-actions .ui-helper-text')).toHaveCount(0);
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

  test('uses one world geometry on mobile with pan and zoom instead of two-lane reflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');
    const desktopWorld = await page.locator('.research-technology-node').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [
      (node as HTMLElement).dataset.technologyId,
      {
        x: (node as HTMLElement).style.getPropertyValue('--research-node-x'),
        y: (node as HTMLElement).style.getPropertyValue('--research-node-y'),
      },
    ])));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');
    const viewport = page.locator('.research-tree-viewport');
    const mobileWorld = await page.locator('.research-technology-node').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [
      (node as HTMLElement).dataset.technologyId,
      {
        x: (node as HTMLElement).style.getPropertyValue('--research-node-x'),
        y: (node as HTMLElement).style.getPropertyValue('--research-node-y'),
      },
    ])));
    expect(mobileWorld).toEqual(desktopWorld);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const beforePan = Number(await viewport.getAttribute('data-pan-x'));
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move((box?.x ?? 0) + 120, (box?.y ?? 0) + 180);
    await page.mouse.down();
    await page.mouse.move((box?.x ?? 0) + 170, (box?.y ?? 0) + 210, { steps: 4 });
    await page.mouse.up();
    const afterPan = Number(await viewport.getAttribute('data-pan-x'));
    expect(Math.abs(afterPan - beforePan)).toBeGreaterThan(10);

    const beforeZoom = Number(await viewport.getAttribute('data-zoom'));
    await page.getByRole('button', { name: '放大技术树' }).click();
    const afterZoom = Number(await viewport.getAttribute('data-zoom'));
    expect(afterZoom).toBeGreaterThan(beforeZoom);

    await viewport.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const fire = (type: string, pointerId: number, x: number, y: number, buttons: number) => element.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        pointerId,
        pointerType: 'touch',
        clientX: rect.left + x,
        clientY: rect.top + y,
        buttons,
      }));
      fire('pointerdown', 41, 120, 180, 1);
      fire('pointerdown', 42, 220, 180, 1);
      fire('pointermove', 42, 270, 180, 1);
      fire('pointerup', 42, 270, 180, 0);
      fire('pointerup', 41, 120, 180, 0);
    });
    const pinchZoom = Number(await viewport.getAttribute('data-zoom'));
    expect(pinchZoom).toBeGreaterThan(afterZoom);
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
    const mobilePageStructure = await page.locator('.page-card-static > .ui-page-stack').evaluate((stack) => ({
      childCount: stack.children.length,
      onlyWorkspace: stack.firstElementChild?.classList.contains('research-workspace') ?? false,
      containsDialog: stack.contains(document.querySelector('.mobile-detail-sheet')),
    }));
    expect(mobilePageStructure.childCount).toBe(1);
    expect(mobilePageStructure.onlyWorkspace).toBe(true);
    expect(mobilePageStructure.containsDialog).toBe(false);
    const detailView = dialog.locator('.mobile-workspace-sheet-detail-view');
    await expect(detailView).toBeVisible();
    await expect(detailView).toContainText('研发投入');
    await expect(detailView).not.toContainText('具体要求');
    await expect(detailView).not.toContainText('产业经营视角');
    await expect(detailView).not.toContainText('就业资金已释放');
    await expect(detailView.getByRole('button', { name: '研发中 · 1 宝石加速 30m' })).toBeVisible();
    await expect(detailView.locator('.mobile-detail-summary')).toHaveCount(1);
    await expect(detailView.locator('.mobile-detail-sheet-footer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(activeNode).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});