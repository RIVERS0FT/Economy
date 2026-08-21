import { expect, test } from '@playwright/test';

async function requireBox(locator: import('@playwright/test').Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function openRegionalBuildings(page: import('@playwright/test').Page) {
  await page.goto('runtime-test.html?view=production&scenario=activity');
  await expect(page.locator('.production-workspace')).toBeVisible();
  await expect(page.locator('.facility-cluster-navigation')).toBeVisible();
  await expect(page.locator('.production-build-card')).toBeVisible();
  await expect(page.locator('.facility-cluster-selector-card').first()).toBeVisible();
}

test('regional buildings uses a dense ledger before build and detail surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRegionalBuildings(page);

  const workspace = page.locator('.production-workspace');
  const ledger = page.locator('.facility-cluster-navigation');
  const build = page.locator('.production-build-card');
  const detail = page.locator('.facility-cluster-detail-shell');
  const row = page.locator('.facility-cluster-selector-card').first();

  const workspaceBox = await requireBox(workspace);
  const ledgerBox = await requireBox(ledger);
  const buildBox = await requireBox(build);
  const rowBox = await requireBox(row);

  expect(ledgerBox.y).toBeLessThan(buildBox.y);
  expect(ledgerBox.x).toBeCloseTo(workspaceBox.x, 1);
  expect(ledgerBox.width).toBeCloseTo(workspaceBox.width, 1);
  expect(rowBox.width).toBeGreaterThan(rowBox.height * 3);
  expect(rowBox.height).toBeLessThanOrEqual(96);

  const geometry = await page.evaluate(() => {
    const workspaceElement = document.querySelector<HTMLElement>('.production-workspace');
    const ledgerElement = document.querySelector<HTMLElement>('.facility-cluster-navigation');
    const rowElement = document.querySelector<HTMLElement>('.facility-cluster-selector-card');
    const buildElement = document.querySelector<HTMLElement>('.production-build-card');
    const detailElement = document.querySelector<HTMLElement>('.facility-cluster-detail-shell');
    if (!workspaceElement || !ledgerElement || !rowElement || !buildElement || !detailElement) {
      throw new Error('building ledger fixture is incomplete');
    }
    return {
      workspaceScrollWidth: workspaceElement.scrollWidth,
      workspaceClientWidth: workspaceElement.clientWidth,
      ledgerScrollWidth: ledgerElement.scrollWidth,
      ledgerClientWidth: ledgerElement.clientWidth,
      rowAspectRatio: getComputedStyle(rowElement).aspectRatio,
      rowMaxWidth: getComputedStyle(rowElement).maxWidth,
      rowStatusContent: getComputedStyle(rowElement, '::after').content,
      buildPosition: getComputedStyle(buildElement).position,
      detailPosition: getComputedStyle(detailElement).position,
      buildOverflowY: getComputedStyle(buildElement).overflowY,
      detailOverflowY: getComputedStyle(detailElement).overflowY,
    };
  });

  expect(geometry.workspaceScrollWidth).toBeLessThanOrEqual(geometry.workspaceClientWidth + 1);
  expect(geometry.ledgerScrollWidth).toBeLessThanOrEqual(geometry.ledgerClientWidth + 1);
  expect(geometry.rowAspectRatio).toBe('auto');
  expect(geometry.rowMaxWidth).toBe('none');
  expect(geometry.rowStatusContent).not.toBe('none');
  expect(geometry.rowStatusContent).not.toBe('normal');
  expect(geometry.buildPosition).toBe('static');
  expect(geometry.detailPosition).toBe('static');
  expect(geometry.buildOverflowY).not.toBe('auto');
  expect(geometry.detailOverflowY).not.toBe('auto');
});

test('mobile building ledger stays inside the workspace sheet without horizontal clipping', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRegionalBuildings(page);

  const pageContent = page.locator('.page-content--player');
  const workspace = page.locator('.production-workspace');
  const ledger = page.locator('.facility-cluster-navigation');
  const build = page.locator('.production-build-card');
  const row = page.locator('.facility-cluster-selector-card').first();

  const ledgerBox = await requireBox(ledger);
  const buildBox = await requireBox(build);
  const rowBox = await requireBox(row);
  expect(ledgerBox.y).toBeLessThan(buildBox.y);
  expect(rowBox.width).toBeGreaterThan(rowBox.height * 2.5);

  const overflow = await page.evaluate(() => {
    const pageElement = document.querySelector<HTMLElement>('.page-content--player');
    const workspaceElement = document.querySelector<HTMLElement>('.production-workspace');
    const ledgerElement = document.querySelector<HTMLElement>('.facility-cluster-navigation');
    if (!pageElement || !workspaceElement || !ledgerElement) {
      throw new Error('mobile building ledger fixture is incomplete');
    }
    return {
      page: [pageElement.scrollWidth, pageElement.clientWidth],
      workspace: [workspaceElement.scrollWidth, workspaceElement.clientWidth],
      ledger: [ledgerElement.scrollWidth, ledgerElement.clientWidth],
    };
  });

  expect(overflow.page[0]).toBeLessThanOrEqual(overflow.page[1] + 1);
  expect(overflow.workspace[0]).toBeLessThanOrEqual(overflow.workspace[1] + 1);
  expect(overflow.ledger[0]).toBeLessThanOrEqual(overflow.ledger[1] + 1);

  await expect(pageContent).toBeVisible();
  await expect(workspace).toBeVisible();
  await expect(page.locator('.facility-cluster-detail-shell')).toBeHidden();
});
