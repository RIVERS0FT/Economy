import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'tests/browser/all-pages-preview.spec.ts';
const source = readFileSync(path, 'utf8');
const startMarker = "test('overview, market, buildings, transport, and settings share a one-third card width while research, auction, contracts, bank, leaderboard, and shop stay full-area with one persistent strategic outliner', async ({ page }) => {";
const endMarker = "\ntest('page navigation unfolds only the active page while the persistent map keeps its instance and geometry', async ({ page }) => {";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('strategic layout monolithic ST block not found');

const replacement = `test('overview, market, buildings, transport, and settings share a one-third card width with one persistent strategic outliner', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');
  const workspaceCard = page.locator('.signed-in-shell__primary-card');
  const outliner = page.locator('.strategic-outliner');
  const compactWidths: number[] = [];
  const compactCardWidths: number[] = [];

  await expect(workspaceCard).toHaveCount(1);
  await expect(workspaceCard.locator(':scope .desktop-sidebar')).toHaveCount(1);
  await expect(workspaceCard.locator(':scope .strategic-page-host')).toHaveCount(1);
  await expect(outliner).toBeVisible();
  await outliner.evaluate((element) => element.setAttribute('data-preview-outliner-sentinel', 'persistent'));

  await clickMapProvinceLabel(page, '得克萨斯');
  const provinceHost = page.locator('.strategic-page-host');
  const provinceContent = provinceHost.locator(':scope > .page-content:not(.page-loading)');
  await expect(provinceHost).toHaveAttribute('data-strategic-presentation', 'building');
  await expect(provinceHost.locator(':scope > .page-loading')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: '得克萨斯' })).toBeVisible();
  await expect(provinceContent).toBeVisible();
  await expect(outliner).toHaveAttribute('data-preview-outliner-sentinel', 'persistent');
  const provinceContentBox = await provinceContent.boundingBox();
  const provinceCardBox = await workspaceCard.boundingBox();
  expect(provinceContentBox).not.toBeNull();
  expect(provinceCardBox).not.toBeNull();
  compactWidths.push(provinceContentBox!.width);
  compactCardWidths.push(provinceCardBox!.width);

  for (const label of ['概览', '市场', '建筑', '运输', '设置']) {
    const button = label === '设置'
      ? sidebar.locator('.sidebar-footer').getByRole('button', { name: '设置', exact: true })
      : sidebar.getByRole('button', { name: new RegExp(\`^\${label}\`) });
    await button.click();
    const host = page.locator('.strategic-page-host');
    await expect(host.locator(':scope > .page-loading')).toHaveCount(0);
    const content = host.locator(':scope > .page-content:not(.page-loading)');
    await expect(host).toHaveAttribute('data-strategic-presentation', 'building');
    await expect(content).toBeVisible();
    await expect(outliner).toBeVisible();
    await expect(outliner).toHaveAttribute('data-preview-outliner-sentinel', 'persistent');
    await expect(content.locator('.strategic-outliner')).toHaveCount(0);
    const contentBox = await content.boundingBox();
    const cardBox = await workspaceCard.boundingBox();
    const outlinerBox = await outliner.boundingBox();
    expect(contentBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect(outlinerBox).not.toBeNull();
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(outlinerBox!.x - 8);
    compactWidths.push(contentBox!.width);
    compactCardWidths.push(cardBox!.width);
  }
  expect(Math.max(...compactWidths) - Math.min(...compactWidths)).toBeLessThanOrEqual(1);
  expect(Math.max(...compactCardWidths) - Math.min(...compactCardWidths)).toBeLessThanOrEqual(1);
  expect(compactCardWidths[0]).toBeLessThanOrEqual(1684 / 3);
  expect(compactCardWidths[0]).toBeCloseTo(1684 / 3, 0);
});

test('transport route picking keeps the one-third card and persistent strategic outliner', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');
  const outliner = page.locator('.strategic-outliner');
  await expect(outliner).toBeVisible();
  await outliner.evaluate((element) => element.setAttribute('data-preview-outliner-sentinel', 'persistent'));

  await sidebar.getByRole('button', { name: /^运输/ }).click();
  const transportContent = page.locator('.transport-page-content');
  await expect(transportContent).toBeVisible();
  const transportHeader = page.locator('.page-fixed-header');
  const addRouteButton = transportContent.locator('.transport-page-footer').getByRole('button', { name: '增加路线', exact: true });
  await expect(transportHeader.getByRole('button')).toHaveCount(2);
  await expect(transportHeader.getByRole('button', { name: '增加路线', exact: true })).toHaveCount(0);
  await expect(addRouteButton).toBeVisible();
  const transportOverflow = await transportContent.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(transportOverflow.scrollWidth).toBeLessThanOrEqual(transportOverflow.clientWidth + 1);
  await addRouteButton.click();
  const transportMapPickingBar = page.locator('.transport-map-picking-bar');
  await expect(page.getByTestId('us-mainland-map')).toHaveAttribute('data-route-picking', 'true');
  await expect(transportMapPickingBar).toBeVisible();
  await expect(page.locator('.transport-route-draft-panel')).toHaveCount(0);
  await expect(outliner).toBeVisible();
  await expect(outliner).toHaveAttribute('data-preview-outliner-sentinel', 'persistent');
  await transportMapPickingBar.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByTestId('us-mainland-map')).toHaveAttribute('data-route-picking', 'false');
});

test('research, auction, contracts, bank, leaderboard, and shop stay full-area while preserving the strategic outliner instance', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');
  const workspace = page.locator('.workspace');
  const workspaceCard = page.locator('.signed-in-shell__primary-card');
  const outliner = page.locator('.strategic-outliner');
  await expect(outliner).toBeVisible();
  await outliner.evaluate((element) => element.setAttribute('data-preview-outliner-sentinel', 'persistent'));

  await sidebar.getByRole('button', { name: /^市场/ }).click();
  const compactHost = page.locator('.strategic-page-host');
  await expect(compactHost).toHaveAttribute('data-strategic-presentation', 'building');
  const compactContent = compactHost.locator(':scope > .page-content:not(.page-loading)');
  await expect(compactContent).toBeVisible();
  const compactBox = await compactContent.boundingBox();
  expect(compactBox).not.toBeNull();

  const fullAreaWidths = new Map<string, number>();
  for (const label of ['研发', '拍卖', '合同', '银行', '排行', '商店']) {
    await sidebar.getByRole('button', { name: new RegExp(\`^\${label}\`) }).click();
    const host = page.locator('.strategic-page-host');
    await expect(host.locator(':scope > .page-loading')).toHaveCount(0);
    const content = host.locator(':scope > .page-content:not(.page-loading)');
    await expect(host).toHaveAttribute('data-strategic-presentation', 'fullscreen');
    await expect(content).toBeVisible();
    await expect(outliner).toBeHidden();
    await expect(outliner).toHaveAttribute('data-preview-outliner-sentinel', 'persistent');
    const hostBox = await host.boundingBox();
    const contentBox = await content.boundingBox();
    const cardBox = await workspaceCard.boundingBox();
    const workspaceBox = await workspace.boundingBox();
    expect(hostBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    expect(contentBox!.width).toBeCloseTo(hostBox!.width, 0);
    expect(contentBox!.width).toBeGreaterThan(compactBox!.width + 200);
    expect(workspaceBox!.x + workspaceBox!.width - (cardBox!.x + cardBox!.width)).toBeCloseTo(8, 0);
    fullAreaWidths.set(label, contentBox!.width);
  }
  expect(fullAreaWidths.get('排行')).toBeCloseTo(fullAreaWidths.get('商店')!, 0);
});
`;

writeFileSync(path, source.slice(0, start) + replacement + source.slice(end));

if (existsSync('scripts/codex-split-strategic-layout-st.mjs')) unlinkSync('scripts/codex-split-strategic-layout-st.mjs');
