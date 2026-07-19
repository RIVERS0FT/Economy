import { expect, test, type Page } from '@playwright/test';

type ShellGeometry = {
  viewportWidth: number;
  viewportHeight: number;
  shell: { left: number; top: number; right: number; bottom: number };
  sidebar: { left: number; top: number; right: number; bottom: number };
  workspace: { left: number; top: number; right: number; bottom: number };
  assetBar: { left: number; top: number; right: number; bottom: number };
  pageScroll: { left: number; top: number; right: number; bottom: number };
  pageContent: { left: number; width: number; right: number };
  pageScrollClientWidth: number;
  pageScrollHasHorizontalOverflow: boolean;
  shellGap: string;
  shellPadding: [string, string, string, string];
  workspaceMargin: [string, string, string, string];
  pageContentMaxWidth: string;
  pageContentMargin: [string, string];
  pageContentPadding: [string, string];
};

async function readShellGeometry(page: Page): Promise<ShellGeometry> {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.game-shell');
    const sidebar = document.querySelector<HTMLElement>('.desktop-sidebar');
    const workspace = document.querySelector<HTMLElement>('.workspace');
    const assetBar = document.querySelector<HTMLElement>('.asset-bar');
    const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
    const pageContent = document.querySelector<HTMLElement>('.page-content');
    if (!shell || !sidebar || !workspace || !assetBar || !pageScroll || !pageContent) {
      throw new Error('game shell geometry fixture is incomplete');
    }

    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    const shellStyle = getComputedStyle(shell);
    const workspaceStyle = getComputedStyle(workspace);
    const pageContentStyle = getComputedStyle(pageContent);
    const pageContentRect = pageContent.getBoundingClientRect();

    return {
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      shell: rect(shell),
      sidebar: rect(sidebar),
      workspace: rect(workspace),
      assetBar: rect(assetBar),
      pageScroll: rect(pageScroll),
      pageContent: {
        left: pageContentRect.left,
        width: pageContentRect.width,
        right: pageContentRect.right,
      },
      pageScrollClientWidth: pageScroll.clientWidth,
      pageScrollHasHorizontalOverflow: pageScroll.scrollWidth > pageScroll.clientWidth + 1,
      shellGap: shellStyle.gap,
      shellPadding: [
        shellStyle.paddingTop,
        shellStyle.paddingRight,
        shellStyle.paddingBottom,
        shellStyle.paddingLeft,
      ],
      workspaceMargin: [
        workspaceStyle.marginTop,
        workspaceStyle.marginRight,
        workspaceStyle.marginBottom,
        workspaceStyle.marginLeft,
      ],
      pageContentMaxWidth: pageContentStyle.maxWidth,
      pageContentMargin: [pageContentStyle.marginLeft, pageContentStyle.marginRight],
      pageContentPadding: [pageContentStyle.paddingLeft, pageContentStyle.paddingRight],
    };
  });
}

function expectFlushWorkspace(layout: ShellGeometry, sidebarInset: number) {
  expect(layout.shell.left).toBeCloseTo(0, 0);
  expect(layout.shell.top).toBeCloseTo(0, 0);
  expect(layout.shell.right).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.shell.bottom).toBeCloseTo(layout.viewportHeight, 0);
  expect(layout.shellGap).toBe('0px');
  expect(layout.shellPadding).toEqual(['0px', '0px', '0px', '0px']);

  expect(layout.sidebar.left).toBeCloseTo(sidebarInset, 0);
  expect(layout.sidebar.top).toBeCloseTo(sidebarInset, 0);
  expect(layout.viewportHeight - layout.sidebar.bottom).toBeCloseTo(sidebarInset, 0);
  expect(layout.workspace.left - layout.sidebar.right).toBeCloseTo(sidebarInset, 0);

  expect(layout.workspace.top).toBeCloseTo(0, 0);
  expect(layout.workspace.right).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.workspace.bottom).toBeCloseTo(layout.viewportHeight, 0);
  expect(layout.workspaceMargin).toEqual(['0px', '0px', '0px', '0px']);

  expect(layout.assetBar.left).toBeCloseTo(layout.workspace.left, 0);
  expect(layout.assetBar.top).toBeCloseTo(layout.workspace.top, 0);
  expect(layout.assetBar.right).toBeCloseTo(layout.workspace.right, 0);

  expect(layout.pageScroll.left).toBeCloseTo(layout.workspace.left, 0);
  expect(layout.pageScroll.top).toBeCloseTo(layout.workspace.top, 0);
  expect(layout.pageScroll.right).toBeCloseTo(layout.workspace.right, 0);
  expect(layout.pageScroll.bottom).toBeCloseTo(layout.workspace.bottom, 0);

  expect(layout.pageContent.left).toBeCloseTo(layout.pageScroll.left, 0);
  expect(layout.pageContent.width).toBeCloseTo(layout.pageScrollClientWidth, 0);
  expect(layout.pageContent.right).toBeLessThanOrEqual(layout.pageScroll.right + 1);
  expect(layout.pageContentMaxWidth).toBe('none');
  expect(layout.pageContentMargin).toEqual(['0px', '0px']);
  expect(layout.pageContentPadding).toEqual(['0px', '0px']);
  expect(layout.pageScrollHasHorizontalOverflow).toBe(false);
}

test.describe('full-width signed-in game shell', () => {
  test('game shell keeps only the sidebar inset while the workspace stays flush', async ({ page }) => {
    await page.setViewportSize({ width: 1684, height: 931 });
    await page.goto('runtime-test.html?view=overview&scenario=empty');
    await expect(page.locator('.game-shell')).toBeVisible();
    await expect(page.locator('.workspace')).toBeVisible();
    await expect(page.locator('.asset-bar')).toBeVisible();
    await expect(page.locator('.page-scroll')).toBeVisible();
    await expect(page.locator('.page-content')).toBeVisible();

    expectFlushWorkspace(await readShellGeometry(page), 12);
  });

  test('sidebar collapse keeps the status bar and page on the same workspace track', async ({ page }) => {
    await page.setViewportSize({ width: 1684, height: 931 });
    await page.goto('runtime-test.html?view=overview&scenario=empty');

    const expanded = await readShellGeometry(page);
    expectFlushWorkspace(expanded, 12);

    await page.getByRole('button', { name: '折叠侧栏' }).click();
    await expect(page.locator('.desktop-sidebar')).toHaveAttribute('data-collapsed', 'true');
    await page.waitForTimeout(240);

    const collapsed = await readShellGeometry(page);
    expectFlushWorkspace(collapsed, 12);
    expect(expanded.sidebar.left).toBeCloseTo(collapsed.sidebar.left, 0);
    expect(expanded.workspace.left - collapsed.workspace.left).toBeCloseTo(146, 0);
    expect(expanded.assetBar.left - collapsed.assetBar.left).toBeCloseTo(146, 0);
    expect(expanded.pageScroll.left - collapsed.pageScroll.left).toBeCloseTo(146, 0);
    expect(expanded.pageContent.left - collapsed.pageContent.left).toBeCloseTo(146, 0);
  });
});
