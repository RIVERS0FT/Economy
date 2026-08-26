import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

[
  'src/pages/OverviewPage.tsx',
  'src/pages/ProvincePage.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/BuildingsPage.tsx',
  'src/pages/ResearchPage.tsx',
  'tests/browser/production-status-summary.spec.ts',
  'src/components/assets/AssetOverviewPanel.tsx',
  'src/pages/BankPage.tsx',
  'src/pages/AuctionPage.tsx',
  'src/pages/ContractPage.tsx',
  'src/pages/LeaderboardPage.tsx',
  'src/pages/GemShopPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/pages/PageRouter.tsx',
  'all-pages-preview.html',
  'src/app/LocalGamePreviewApp.tsx',
  'src/dev/localGamePreviewFetch.ts',
  'src/dev/generated/local-game-preview-state.json',
  'scripts/generate-local-game-preview.mjs',
  'scripts/verify-local-game-preview.mjs',
  'tests/browser/all-pages-preview.spec.ts',
  'src/contracts/api.ts',
  'src/contracts/types.ts',
  'src/components/InvitationSettings.tsx',
  'src/components/facilities/FacilityProductionFormula.tsx',
  'src/components/warehouse/WarehouseInventoryPanel.tsx',
  'src/components/shell/NavigationItems.tsx',
  'src/components/shell/DesktopSidebar.tsx',
  'src/components/shell/SidebarFrame.tsx',
  'src/components/shell/AdminSidebar.tsx',
  'src/components/shell/GameShell.tsx',
  'src/components/shell/SignedInShell.tsx',
  'src/components/shell/AdminDesktopBar.tsx',
  'src/components/ui/VirtualList.tsx',
  'src/components/ui/VirtualRecordTable.tsx',
  'src/hooks/useVirtualWindow.ts',
  'src/app/gameViewModel.ts',
  'src/navigation/playerPageStack.ts',
  'src/config/navigation.ts',
  'src/app/GameApp.tsx',
  'src/app/AdminApp.tsx',
  'src/components/AdminOverview.tsx',
  'src/components/AdminCommunityLinkPanel.tsx',
  'src/components/AdminPlayerSection.tsx',
  'src/components/AdminPopulationSection.tsx',
  'src/components/AdminGiftCodesSection.tsx',
  'tests/browser/admin-runtime.spec.ts',
  'src/app/LoginPage.tsx',
  'src/config/brand.ts',
  'index.html',
  'src/styles/auth.css',
  'src/styles/globals.css',
  'src/styles/design-system.css',
  'src/styles/registration-auth.css',
  'src/styles/virtual-list.css',
  'src/styles/contracts.css',
  'src/utils/formatters.ts',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'Economy 免登录游戏模式',
  'url=./?preview=game',
  "window.location.replace('./?preview=game')",
]) requireText('all-pages-preview.html', text);
for (const text of [
  'installLocalGamePreviewFetch()',
  '<GameShell model={model} offline>',
  '<PageRouter model={model} />',
  'scopeEconomyState(authorityGame, selectedProvinceId)',
  'PREVIEW_ACTION_MESSAGE',
]) requireText('src/app/LocalGamePreviewApp.tsx', text);
for (const text of [
  "url.pathname.startsWith('/economy-api')",
  "method !== 'GET'",
  '不会提交真实操作',
]) requireText('src/dev/localGamePreviewFetch.ts', text);
for (const text of [
  'import.meta.env.DEV',
  "get('preview') === 'game'",
  "import('./LocalGamePreviewApp')",
]) requireText('src/app/App.tsx', text);
for (const text of [
  'offline = false',
  'if (offline) return undefined',
]) requireText('src/components/shell/GameShell.tsx', text);
for (const text of [
  "toHaveAttribute('data-local-game-preview', 'true')",
  "page.locator('.game-shell')",
  "sidebar-nav-button')).toHaveCount(9)",
  "sidebar-footer').getByRole('button', { name: '设置' })).toHaveCount(1)",
  "expect(apiRequests).toEqual([])",
  "page.locator('.leaderboard-board-card:visible')).toHaveCount(4)",
  "page.locator('.leaderboard-board-card:visible')).toHaveCount(1)",
  "toHaveAttribute('aria-label', '选择排行榜')",
  'expect(new Set(layout.padding).size).toBe(1)',
]) requireText('tests/browser/all-pages-preview.spec.ts', text);
for (const text of [
  "data-player-page-navigation={pageNavigation ? 'true' : undefined}",
  "classNames('page-heading', pageNavigation && 'page-heading--player-navigation')",
  'page-navigation-button--back',
  'page-heading-title',
  'page-navigation-button--close',
  'page-heading-actions--player',
  'className="page-fixed-header"',
  'className="page-card-scroll-area"',
  'viewportClassName="page-card-scroll"',
  "aria-label={backAction?.label ?? '返回上一页面'}",
  'aria-label="关闭当前页面并显示地图"',
  'disabled={!backAction && !pageNavigation.canGoBack}',
]) requireText('src/components/ui/layout.tsx', text);
forbidText('src/components/ui/layout.tsx', '<p>{description}</p>');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '不得在标题下方显示 `description` 说明段落');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '当前页面加历史总深度固定最多 20 层');
requireText('tests/browser/runtime.spec.ts', "page.locator('.page-heading p')).toHaveCount(0)");
for (const text of [
  '.page-fixed-header {',
  '.page-heading {',
  'padding: var(--layout-gutter);',
  'border-bottom: 1px solid var(--color-border-strong);',
  'background: color-mix(in srgb, var(--color-surface-panel) 88%, transparent);',
  'box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);',
]) requireText('src/styles/globals.css', text);
for (const text of [
  '.page-card-static > .ui-page-stack {',
  'grid-template-rows: minmax(0, 1fr);',
  'align-content: stretch;',
]) requireText('src/styles/design-system.css', text);
requireText('src/styles/game-shell-layout.css', '.signed-in-shell .page-heading {');
requireText('src/styles/game-shell-layout.css', 'padding: var(--layout-gutter);');
requireText('docs/UI_DESIGN_SYSTEM.md', '独立表面背景、底部分隔线和阴影与正文形成清晰分区');
for (const text of [
  'pageHistoryRef',
  'appendPlayerPageHistory',
  'playerPageLocationKey',
  'pushPlayerPage',
  'replacePlayerPage',
  '<PlayerPageNavigationProvider',
]) requireText('src/components/shell/GameShell.tsx', text);
for (const text of [
  'MAX_PLAYER_PAGE_STACK_DEPTH = 20',
  'maximumHistoryDepth = MAX_PLAYER_PAGE_STACK_DEPTH - 1',
  "next[0]?.type === 'map'",
]) requireText('src/navigation/playerPageStack.ts', text);

for (const text of [
  "type AuthMode = 'login' | 'register'",
  'ref={formRef}',
  'aria-busy={submitting || sendingCode}',
  'disabled={submitting || sendingCode}',
  'new FormData(event.currentTarget)',
  'new FormData(formRef.current)',
  "formData.get('email')",
  "formData.get('password')",
  "formData.get('code')",
  'name="email"',
  'name="password"',
  'name="code"',
  'autoComplete="one-time-code"',
  '发送验证码',
  '完成注册',
  'resendSeconds',
]) requireText('src/app/LoginPage.tsx', text);
for (const text of [
  'value={email}',
  'value={password}',
  'setEmail(',
  'setPassword(',
  '登录或注册',
]) forbidText('src/app/LoginPage.tsx', text);

for (const text of [
  "export const BRAND_LOGO_URL = 'https://riversoft.top/logo.svg';",
]) requireText('src/config/brand.ts', text);
for (const text of [
  '1000002880.png',
  '/brand-icon.svg',
]) forbidText('src/config/brand.ts', text);
for (const text of [
  '<link rel="icon" type="image/svg+xml" href="https://riversoft.top/logo.svg" />',
  '<link rel="apple-touch-icon" href="https://riversoft.top/1000002880.png" />',
  '<meta property="og:image" content="https://riversoft.top/1000002880.png" />',
  '<meta name="twitter:image" content="https://riversoft.top/1000002880.png" />',
]) requireText('index.html', text);
for (const text of [
  '<link rel="icon" type="image/png" href="https://riversoft.top/1000002880.png" />',
  'href="/brand-icon.svg"',
]) forbidText('index.html', text);

for (const text of [
  'min-height: calc(100dvh - var(--space-8));',
  '@media (max-width: 720px) and (max-height: 560px)',
  'min-height: 48px;',
  'white-space: nowrap;',
]) requireText('src/styles/auth.css', text);
for (const text of [
  '.auth-mode-switch',
  '.email-code-field',
  '.form-notice',
]) requireText('src/styles/registration-auth.css', text);
for (const text of ['.login-shell:focus-within', 'transition: font-size']) forbidText('src/styles/auth.css', text);

for (const text of [
  "if (!facilityAssetId && marketViewMode === 'catalog')",
  'market-catalog-filters',
  'fixedProductId={selectedProduct.id}',
  '挂单差额',
  '基准偏离',
  '商品基本面',
  '库存与生产',
  '预计生产速度',
  'backAction={{',
  'placeAssetOrder',
  'single-order-book',
  'items={selectedLocalTrades}',
  'local-trades-virtual-table',
  '<FactoryIcon />',
  '<CompactNumber value={order.remaining} />',
  'formatCurrency(order.price)',
]) requireText('src/pages/MarketPage.tsx', text);
for (const text of [
  'unified-asset-tabs',
  'asset-directory-shell',
  'localTrades.map(',
  'market-stat-strip',
  '工厂数量市场',
  '仅保存在当前浏览器；更换设备或清除网站数据后不会恢复。',
  '>⚙</span>',
  'order-book-columns',
  'order-book-midpoint',
]) forbidText('src/pages/MarketPage.tsx', text);
const marketPageSource = read('src/pages/MarketPage.tsx');
const marketCatalogStart = marketPageSource.indexOf("if (!facilityAssetId && marketViewMode === 'catalog')");
const marketDetailStart = marketPageSource.indexOf('\n  const detailContent =', marketCatalogStart);
const marketCatalogSource = marketPageSource.slice(marketCatalogStart, marketDetailStart);
if (marketCatalogSource.includes('<FacilityIcon facilityTypeId={entry.id}')) failures.push('市场商品目录不得恢复工厂资产行');
if (marketCatalogSource.includes('${catalogEntries.length} 项')) failures.push('市场目录态不应显示资产数量胶囊');
for (const text of ['market-catalog-kind', "setCatalogKind('facility')", '>工厂</Button>']) forbidText('src/pages/MarketPage.tsx', text);

for (const text of [
  "title={`${model.selectedProvince?.name || '加利福尼亚州'}建筑`}",
  'title="建筑概况"',
  'className="buildings-summary-metrics"',
  'className="buildings-list-filters"',
  'label="产业分类"',
  'label="运行状态"',
  'SwitchControl',
  'checked={group.enabled}',
  'if (!entry.constructionOnly)',
  'facility-status-header',
  'facility-card-title-row',
  'facility-card-title-block',
  '异常：资金不足',
  '异常：原料不足',
  '异常：原料不足',
  '运行中',
  '新增生产可用工厂立即参与运行并同步稀释满员率',
  '冻结中',
  'FacilityProductionFormula',
  'products={game.products}',
  'inventories={game.inventories}',
  'facility-recipe-section',
  '<strong>生产产物</strong>',
  '生产进度已清零',
  'setFacilityRecipe',
  '<EmbeddedFacilityAssetMarket',
  'facilityAssetId={facilityAssetTradeId}',
  'formatNumber(group.count)',
]) requireText('src/pages/BuildingsPage.tsx', text);
requireText('src/pages/production/ProductionFacilityDetail.tsx', '交易该建筑资产');
for (const text of [
  '运行 {formatNumber(model.derived.runningFacilities)}',
  '停止 {formatNumber(model.derived.stoppedFacilities)}',
  '异常 {formatNumber(model.derived.blockedFacilities)}',
  '施工 {formatNumber(model.derived.constructingFacilities)}',
  'const facilityClusterStatusCounts = useMemo(() => {',
  "const summary: Record<FacilityGroup['status'], number> = {",
  'summary[entry.group.status] += 1;',
  '运行 {formatNumber(facilityClusterStatusCounts.running)}',
  '停止 {formatNumber(facilityClusterStatusCounts.stopped)}',
  '异常 {formatNumber(facilityClusterStatusCounts.error)}',
]) forbidText('src/pages/BuildingsPage.tsx', text);
for (const text of [
  'scrollable={false}',
  'className="research-workspace"',
]) requireText('src/pages/ResearchPage.tsx', text);
for (const text of [
  '完整阶段',
  'actions={',
]) forbidText('src/pages/ResearchPage.tsx', text);
for (const text of [
  'facility-formula-input-group',
  'facility-formula-input-side',
  'facility-formula-meta',
  'facility-formula-output-group',
  'facility-formula-progress',
  'CycleIcon',
  'CreditsIcon',
  'WarehouseIcon',
]) requireText('src/components/facilities/FacilityProductionFormula.tsx', text);
forbidText('src/components/facilities/FacilityProductionFormula.tsx', 'facility-formula-summary');
forbidText('src/components/facilities/FacilityProductionFormula.tsx', 'facility-formula-center');
for (const text of [
  'title="工厂"',
  'facility-power-button',
  '产成品去向',
  '启动全部未挂牌工厂',
  '停止全部',
  'facility-stop-reason',
  'facility-auto-recovery-note',
  '手动停止',
  '正常生产中',
  '下一周期按 ',
  '持有 <strong>',
  '下一周期：',
  '当前计划：持续运行',
  '>保存计划</Button>',
  'facility-group-specs',
  'facility-card-status-row',
  'facility-detail-sheet-close',
  '下一周期加入',
  '下一周期切换为：',
]) forbidText('src/pages/BuildingsPage.tsx', text);

for (const text of [
  'export function AssetOverviewPanel',
  'title="资产总览"',
  'asset-total-summary',
  'asset-allocation-summary',
  'asset-composition-table',
  'aria-label="资产构成明细"',
]) requireText('src/components/assets/AssetOverviewPanel.tsx', text);
for (const text of [
  'title="银行"',
  '<AssetOverviewPanel model={model} />',
  'bank-account-balance-strip',
  '存款账户',
  '存款利息',
  '工厂抵押贷款',
  '银行记录',
]) requireText('src/pages/BankPage.tsx', text);
for (const text of ['bank-metric-grid', '本地资产变动', 'localAssetEvents']) forbidText('src/pages/BankPage.tsx', text);
if (existsSync(resolve(root, 'src/pages/AssetsPage.tsx'))) failures.push('独立 AssetsPage 不得恢复');

for (const text of [
  'items={giftCodes}',
  'items={redemptions}',
  'admin-gifts-virtual-table',
  'admin-redemptions-virtual-table',
  'StatusTag',
]) requireText('src/components/AdminGiftCodesSection.tsx', text);
for (const text of [
  '玩家社区入口',
  'adminApi.updateCommunityLink',
  'QQ群跳转链接',
]) requireText('src/components/AdminCommunityLinkPanel.tsx', text);
for (const text of [
  "visitedSections.has('players')",
  "visitedSections.has('population')",
  "visitedSections.has('gift-codes')",
  "visitedSections.has('bans')",
  '<AdminBanPanel',
  '<AdminSidebar',
  '<SignedInShell',
  '<AdminDesktopBar',
]) requireText('src/app/AdminApp.tsx', text);
for (const text of [
  'sidebar-community-link',
  '加入 QQ 群',
  'QqIcon',
  'SettingsIcon',
  'sidebar-settings',
  "excludedTabs={['settings']}",
  'showIdentity={false}',
  'target="_blank"',
  'rel="noopener noreferrer"',
]) requireText('src/components/shell/DesktopSidebar.tsx', text);
for (const text of [
  'sidebar-brand-copy',
  'onMouseEnter={expand}',
  'onMouseLeave={collapse}',
  'onFocusCapture={expand}',
  'onBlurCapture={handleBlur}',
]) requireText('src/components/shell/SidebarFrame.tsx', text);
for (const text of ['sidebar-logo-expand-button', 'sidebar-collapse-button', 'aria-label="展开侧栏"', 'aria-label="折叠侧栏"']) {
  forbidText('src/components/shell/SidebarFrame.tsx', text);
}
for (const text of [
  "export type AdminSectionId = 'overview' | 'players' | 'population' | 'gift-codes' | 'bans'",
  '管理员导航',
  'admin-mobile-navigation',
]) requireText('src/components/shell/AdminSidebar.tsx', text);
for (const text of [
  "import { ScrollArea } from '../ui/ScrollArea'",
  "'signed-in-shell'",
  'className="mobile-page-overlay"',
  "'mobile-chrome-overlay'",
]) requireText('src/components/shell/SignedInShell.tsx', text);
for (const text of [
  'className="asset-bar admin-command-bar"',
  'variant="statusBar"',
  '刷新当前分区',
]) requireText('src/components/shell/AdminDesktopBar.tsx', text);
for (const text of ['<span aria-hidden="true">QQ</span>', '>退出登录</Button>', 'LogoutIcon']) {
  forbidText('src/components/shell/DesktopSidebar.tsx', text);
}
for (const text of ['export function QqIcon', 'export function SettingsIcon']) {
  requireText('src/components/icons/GameIcons.tsx', text);
}
for (const text of [
  '.desktop-sidebar[data-collapsed="true"] .sidebar-footer-action strong',
  '.desktop-sidebar .sidebar-footer-action strong {',
  '.desktop-sidebar .sidebar-footer {',
  '.desktop-sidebar button:hover:not(:disabled)',
  '--desktop-sidebar-motion: 200ms',
]) requireText('src/styles/desktop-sidebar.css', text);
for (const text of ['sidebar-logo-expand-button', 'sidebar-collapse-button']) {
  forbidText('src/styles/desktop-sidebar.css', text);
}
for (const text of ['AdminBanApp', "path === '/economy/admin/bans'"]) forbidText('src/app/App.tsx', text);
forbidText('src/pages/SettingsPage.tsx', '/economy/admin/bans');
forbidText('src/pages/SettingsPage.tsx', 'InvitationSettings');
for (const text of ["import { InvitationSettings }", '<InvitationSettings />']) {
  requireText('src/pages/GemShopPage.tsx', text);
}
for (const text of ['填写好友邀请码', '确认填写', 'claimInvitation']) {
  forbidText('src/components/InvitationSettings.tsx', text);
}
for (const text of ['getCommunityLink(controller.signal)', 'DEFAULT_QQ_GROUP_URL']) {
  requireText('src/components/shell/GameShell.tsx', text);
}
for (const text of ['giftCodes.map(', 'redemptions.map(']) forbidText('src/components/AdminGiftCodesSection.tsx', text);
for (const text of ['collectibles', 'ownership']) forbidText('src/app/AdminApp.tsx', text);
for (const text of ['PageLayout', 'Button']) requireText('src/app/AdminApp.tsx', text);
for (const text of ['Panel', 'StatusTag', 'Button']) requireText('src/components/AdminGiftCodesSection.tsx', text);
requireText('src/components/AdminOverview.tsx', 'MetricCard');
for (const text of ['grid-template-columns: repeat(4, minmax(0, 1fr));', 'max-width: none;']) {
  requireText('src/styles/unified-market-admin.css', text);
}
for (const text of [
  '.signed-in-shell.sidebar-layout {',
  '--desktop-layout-gutter: var(--space-3);',
  '.signed-in-shell .page-scroll-area > .ui-scrollbar--vertical {',
]) requireText('src/styles/game-shell-layout.css', text);
for (const text of [
  '.admin-command-bar-content {',
  '.admin-page-frame .page-heading {',
  'display: none;',
  '.admin-mobile-chrome-layer .admin-mobile-bottom-navigation',
]) requireText('src/styles/admin-navigation.css', text);
for (const text of ['max-width: 1440px;', 'max-width: 1600px;', '.admin-mobile-navigation {']) {
  forbidText('src/styles/unified-market-admin.css', text);
}
if (existsSync(resolve(root, 'src/app/AdminBanApp.tsx'))) failures.push('独立 AdminBanApp 不得恢复');
for (const text of [
  'admin desktop shares the game shell gutter, command bar and edge scrollbar',
  'admin navigation uses the shared mobile overlay and stays above page cards',
]) requireText('tests/browser/admin-runtime.spec.ts', text);

for (const text of ['ResizeObserver', 'measuredSizesRef', 'overscan', 'requestAnimationFrame', 'findVisibleRange']) {
  requireText('src/hooks/useVirtualWindow.ts', text);
}
for (const text of ['useVirtualWindow', 'aria-setsize', 'virtual-list__canvas']) requireText('src/components/ui/VirtualList.tsx', text);
for (const text of ['useVirtualWindow', 'axis="both"', 'virtual-record-canvas']) requireText('src/components/ui/VirtualRecordTable.tsx', text);
for (const text of ['.virtual-list', '.virtual-record-table', '.virtual-record-row']) {
  requireText('src/styles/virtual-list.css', text);
}

for (const text of [
  "{ id: 'bank', label: '银行' }",
  "{ id: 'auction', label: '拍卖' }",
  "{ id: 'contracts', label: '合同' }",
  "{ id: 'gem-shop', label: '商店' }",
]) requireText('src/config/navigation.ts', text);
requireText('src/config/navigation.ts', "export type TabId = NavigationTabId | 'map' | 'province';");
forbidText('src/config/navigation.ts', "{ id: 'map', label: '地图' }");
forbidText('src/config/navigation.ts', "{ id: 'province', label:");
forbidText('src/config/navigation.ts', "{ id: 'assets', label: '资产' }");
forbidText('src/config/navigation.ts', "{ id: 'assets', label: '资金' }");
forbidText('src/config/navigation.ts', "{ id: 'collections'");

if (existsSync(resolve(root, 'src/pages/CollectionsPage.tsx'))) failures.push('已删除的 CollectionsPage 不得恢复');
for (const text of ['title="拍卖"', '发布资产包拍卖', 'createAuction', 'placeAuctionBid', 'cancelAuction', '商品', '工厂', '发布费', '保留价状态', '查看最近 10 条', '等待服务器结算']) {
  requireText('src/pages/AuctionPage.tsx', text);
}
for (const text of ['collectible', 'Collectible', '藏品']) forbidText('src/pages/AuctionPage.tsx', text);
for (const text of ['asset-auction-workspace', '发起拍卖', '正在进行的拍卖', 'auctionAttentionPriority', '被超价', '新增']) requireText('src/pages/AuctionPage.tsx', text);
for (const text of ['closedAuctions', '最近结束']) forbidText('src/pages/AuctionPage.tsx', text);
for (const text of [
  'title="合同"',
  '进行中的合同',
  '合同广场',
  '待处理',
  '历史合同',
  '发布合同',
  'contract-content-actions',
  'productionContractActions',
  '准备本批商品',
  '补充本批货款',
  '立即违约终止',
  "type PersonalContractView = 'active' | 'history'",
  "useState<PersonalContractView>('active')",
  'contractNeedsAttention',
  'contract-workspace',
  'contract-market-grid',
  'contract-personal-tabs',
  'contract-active-grid',
  "contract.graceEndsAt ? 'danger' : needsAttention ? 'attention' : 'normal'",
]) requireText('src/pages/ContractPage.tsx', text);
forbidText('src/pages/ContractPage.tsx', 'actions={<Button onClick');
for (const text of [
  '.contract-workspace {',
  'gap: var(--layout-gutter);',
]) requireText('src/styles/contracts.css', text);
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '工作区内部左右区域使用 `var(--layout-gutter)`');
for (const text of [
  'collectibleId',
  'facilityInstanceId',
  'type ContractTab',
  'contract-tab-market',
  'contract-tab-pending',
  "tab === 'market'",
  "tab === 'pending'",
]) forbidText('src/pages/ContractPage.tsx', text);
for (const text of [
  "'/contracts'",
  "'accept'",
  "'prepare'",
  "'fund'",
  "'auto-reserve'",
  "'auto-fund'",
]) requireText('src/contracts/api.ts', text);

for (const text of [
  'const stockedProducts = useMemo',
  'inventory.available > 0 || inventory.frozen > 0',
  'ProductIcon',
  'warehouse-product-card-name',
  'warehouse-product-card-icon',
  'warehouse-product-card-available',
  'warehouse-product-card-frozen',
  '<ProductIcon productId={product.id} />',
  '可用 {<CompactNumber value={inventory.available} />}',
  '冻结 {<CompactNumber value={inventory.frozen} />}',
  '无限容量',
]) requireText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);
for (const text of [
  'WarehouseContentFilter',
  '全部商品',
  '查看全部商品',
  'warehouseMaxLevel',
  '已达最高等级',
  '种商品有库存',
  'const total = inventory.available + inventory.frozen',
  '<strong>库存 {total}</strong>',
  'ProductIconLabel',
]) forbidText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);

for (const text of ['compactNumbers', 'setCompactNumbers']) forbidText('src/app/gameViewModel.ts', text);

for (const text of [
  '持有工厂总数',
  '生产商品总数',
  '买入商品总数',
  '卖出商品总数',
  '礼品兑换',
  '退出登录',
  'game.facilityGroups.reduce((sum, group) => sum + group.count, 0)',
]) requireText('src/pages/SettingsPage.tsx', text);
for (const text of ['邀请好友', '分享链接', '永久邀请码', '注册填写', '注册完成后不能补填或更换', '累计宝石']) {
  requireText('src/components/InvitationSettings.tsx', text);
}
for (const text of ['填写好友邀请码', '确认填写', 'claimInvitation']) {
  forbidText('src/components/InvitationSettings.tsx', text);
}
forbidText('src/pages/SettingsPage.tsx', 'InvitationSettings');
for (const text of ["import { InvitationSettings }", '<InvitationSettings />']) {
  requireText('src/pages/GemShopPage.tsx', text);
}
for (const text of ['登录会话', '重置经济状态', '重置服务器经济状态', '使用万和百万单位缩写大额资产', '全局使用 K/M/B/T 缩写大额金额与状态栏容量']) {
  forbidText('src/pages/SettingsPage.tsx', text);
}
for (const text of ['存档管理', '删除存档']) requireText('src/pages/SettingsPage.tsx', text);
forbidText('src/pages/SettingsPage.tsx', '紧凑数字');

for (const text of [
  "label: '仓库库存'",
  "id: 'warehouse'",
  'formatNumber(game.warehouseStoredQuantity)',
]) requireText('src/app/GameApp.tsx', text);
for (const text of ["id: 'inventory'", "id: 'market'", 'setCompactNumbersEnabled']) forbidText('src/app/GameApp.tsx', text);

for (const text of [
  'export function formatNumber',
  'return formatAbbreviatedNumber(value)',
  'return formatNumber(value)',
  "suffix: 'K'",
  "suffix: 'M'",
  "suffix: 'B'",
  "suffix: 'T'",
]) requireText('src/utils/formatters.ts', text);
for (const [path, text] of [
  ['src/pages/OverviewPage.tsx', '<CompactNumber value={derived.runningFacilities} />'],
  ['src/pages/LeaderboardPage.tsx', 'formatNumber(entry.facilityCount)'],
  ['src/components/shell/NavigationItems.tsx', 'badges: NavigationBadgeMap'],
  ['src/components/shell/NavigationItems.tsx', 'formatNavigationBadgeCount(navigationBadge.count)'],
]) requireText(path, text);
for (const text of ['openOrderCount', "id === 'market'", 'sidebar-nav-count']) {
  forbidText('src/components/shell/NavigationItems.tsx', text);
}

for (const text of [
  '概览｜市场｜建筑｜研发｜拍卖｜合同｜银行｜排行｜商店｜设置',
  '| 州级上下文页（无导航按钮） | `province` | `ProvincePage` |',
  '`province` 只是由地图州面打开的隐藏上下文页，不计为第十二个一级页面',
  '移动底栏显示除 `map` 外的十个业务导航按钮，桌面侧栏主导航显示其中九项，并把“设置”固定为侧栏底部操作',
  '返回按最近顺序回到上一个非地图业务页面',
  '| 拍卖 | `auction` | `AuctionPage` | 商品与工厂资产包发布及进行中竞价 |',
  '| 合同 | `contracts` | `ContractPage` | 商品供货、玩家抵押借贷和工厂使用权租赁合同的发布、承接、履约与历史 |',
  '| 银行 | `bank` | `BankPage` | 资产总览、存取款、活跃周固定存款利息、周资金结算、工厂抵押贷款、额度评估与还款 |',
  '| 商店 | `gem-shop` | `GemShopPage` | 邀请获取宝石、礼品码兑换与每日终端动态报价兑换普通货币 |',
  '| 设置 | `settings` | `SettingsPage` | 资料、偏好、教程控制、存档管理和退出 |',
  '建筑页不得渲染仓库库存卡或自动交易设置',
  '独立资产页面已经永久删除，资产总览唯一归属银行页',
  '银行资产总览不得再显示逐商品“商品库存与估值”卡片',
  '卖单量与买单量只来自公开订单簿',
  '仓库库存唯一显示在隐藏州级上下文页的“仓库”分区',
  '建设新工厂卡独占左侧控制列并在桌面滚动时常驻',
  '建筑页只显示按正式目录排序并经过当前筛选的紧凑选择卡和单张当前建筑完整详情',
  '集群生产公式',
  '多输入、多输出和逐输入库存兼容展示',
  '以箭头替代生产进度条',
  '移动详情不显示顶部关闭按钮',
  '点击遮罩、按 `Escape` 和有效下拉共用收起动画',
  '最高出价资金、商品仓库预占、卖方资产冻结、发布费托管、隐藏保留价、最低加价、自动延时、退款、成交手续费、拍卖状态和资产转移全部由服务器判定',
  '默认进入“进行中的合同”',
  '合同只允许商品合作、玩家抵押借贷和工厂使用权租赁三个正式领域',
  '单批货款 20% 的履约保证金',
  '合同交付不写入统一订单簿最近成交价、价格曲线、商品估值或交易榜',
  '登录模式只调用现有统一账号登录，不得在 401 后自动注册',
  '状态栏左侧玩家头像、游戏标题和玩家名统一位于身份轨道',
  '两个入口分别使用 `QqIcon` 与 `SettingsIcon`',
  '管理员后台左侧导航复用同一侧栏骨架与动画',
  '`all-pages-preview.html` 只属于本地开发预览目录',
  '所有玩家页面共享的常驻战略地图',
  '概览、州级上下文、市场、建筑、设置使用 `building`',
  '`MapPage` 不再拥有 `UsMainlandMap` 实例',
  '`MapPage` 只保留透明路由占位',
  '不得渲染左上“战略经营地图”卡片、左下图例／来源卡或“当前经营地区”卡片',
  '单击后同时更新经营州并打开 `province` 上下文页',
  '概览｜市场｜建筑｜仓库',
  '离开行为只清除地图视觉选中态，不清除经营州',
  '地图提供州界、资产、工业、市场和异常五种镜头',
  '不得注册为正式 `TabId`、正式路由或第十二个一级页面',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  "case 'province':",
  'renderPage = () => <ProvincePage model={model} />;',
  'province: loadProvincePage',
]) requireText('src/pages/PageRouter.tsx', text);
for (const text of [
  'title={provinceName}',
  'role="tablist"',
  'role="tabpanel"',
  '<EmbeddedMarketPage model={model} embedded />',
  '<EmbeddedBuildingsPage model={model} embedded />',
  '<WarehouseInventoryPanel model={model} className="province-warehouse-section" />',
]) requireText('src/pages/ProvincePage.tsx', text);

for (const text of [
  'const STRATEGIC_PAGE_PRESENTATION = {',
  "home: 'building'",
  "map: 'map'",
  "province: 'building'",
  "research: 'fullscreen'",
  "'gem-shop': 'fullscreen'",
  'data-strategic-presentation={pagePresentation}',
  'identity={{',
  'playerId: model.user.id',
  'title: BRAND_NAME',
]) requireText('src/components/shell/GameShell.tsx', text);
forbidText('src/pages/MapPage.tsx', '<UsMainlandMap');
for (const text of ['战略经营地图', '当前经营地区', 'province-map-command-panel', 'province-map-meta', 'province-map-legend']) {
  forbidText('src/pages/MapPage.tsx', text);
}
for (const text of ['当前经营地区', 'strategic-province-inspector']) {
  forbidText('src/components/shell/StrategicWorkspace.tsx', text);
}

for (const text of [
  '“紧凑数字”是全局固定显示规则',
  '数量、普通货币与排名等只读业务数值对绝对值达到 1,000 的内容统一使用 K/M/B/T',
  '`formatCurrency` 继续保留普通货币两位精确格式',
  '不提供关闭入口或按设备分流',
  '`VirtualList` 与 `VirtualRecordTable` 共用 `src/hooks/useVirtualWindow.ts` 的唯一窗口化内核',
  '根据滚动位置只挂载可视条目与少量 `overscan` 条目',
  '移动登录页面通过 `100dvh` 和矮屏媒体查询适配软键盘',
  '输入、按钮焦点和提交中的原生 `disabled` 状态不得改变标题字号、区块间距或整体对齐',
  '表单使用 `aria-busy` 表达提交状态',
  '账号和密码必须保留原生未受控表单值',
  '提交时通过 `FormData(event.currentTarget)` 读取浏览器自动填充内容',
  '不得把账号或密码重新绑定到初始为空的 React `value` 状态',
  '`https://riversoft.top/logo.svg` 是 Economy 登录页与玩家状态栏显示品牌 Logo 的唯一权威资源',
  '页面 favicon 使用同一 SVG，并声明 `image/svg+xml`',
  'Apple Touch Icon、Open Graph 和 Twitter 图片继续使用主页同步生成的 `https://riversoft.top/1000002880.png`',
  '兼容 PNG 不得替代页面内可见 Logo',
  '使用 `.login-shell:focus-within` 或其他焦点选择器改变移动登录页标题字号、区块间距或整体对齐',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

for (const text of [
  '本地文档版本：v7',
  'economy.local-activity.v7.<userId>',
  '市场页是本地匿名成交的唯一完整展示位置',
  '永久丢弃全部 `assetEvents[]`',
  '对本地成交直接使用全量 `.map()` 创建全部 DOM',
]) requireText('docs/LOCAL_ACTIVITY_LOG_DESIGN.md', text);
for (const text of [
  '礼品码列表和兑换记录可能持续增长，必须同时使用服务端游标分页和共享 `VirtualList`',
  '让礼品码或兑换记录接口恢复无边界全表返回',
  '社区入口默认使用 `https://qm.qq.com/q/eN8hya0Yn0`',
]) requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', text);
for (const text of [
  '数量、普通货币与排名等只读业务数值遵循全局固定紧凑规则',
  '悬停或键盘聚焦时通过共享 Tooltip 显示完整数字',
]) requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', text);

if (failures.length) {
  console.error(`页面内容与职责验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('页面内容、十一个正式页面与十项可见导航、隐藏州级上下文页、美国本土州级地图、统一返回关闭、银行资产总览、合同默认进行中视图、主页 SVG Logo、登录注册、高增长记录窗口化、邀请、商店、商品／工厂资产拍卖、管理员共享外壳、全局紧凑数字、生产公式和仓库职责验证通过。');
