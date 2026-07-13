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
  'src/pages/MarketPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/pages/CollectionsPage.tsx',
  'src/pages/AuctionPage.tsx',
  'src/pages/LeaderboardPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/components/facilities/FacilityProductionFormula.tsx',
  'src/components/warehouse/WarehouseUpgradeCard.tsx',
  'src/components/shell/NavigationItems.tsx',
  'src/components/ui/VirtualList.tsx',
  'src/app/gameViewModel.ts',
  'src/config/navigation.ts',
  'src/app/GameApp.tsx',
  'src/app/AdminApp.tsx',
  'src/app/LoginPage.tsx',
  'src/styles/auth.css',
  'src/styles/virtual-list.css',
  'src/utils/formatters.ts',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'aria-busy={submitting}',
  'disabled={submitting}',
  "submitting ? '正在连接账号服务…' : '登录或注册'",
  'new FormData(event.currentTarget)',
  "formData.get('email')",
  "formData.get('password')",
  'name="email"',
  'name="password"',
]) requireText('src/app/LoginPage.tsx', text);
for (const text of [
  'value={email}',
  'value={password}',
  'setEmail(',
  'setPassword(',
]) forbidText('src/app/LoginPage.tsx', text);

for (const text of [
  'min-height: calc(100dvh - var(--space-8));',
  '@media (max-width: 720px) and (max-height: 560px)',
  'min-height: 48px;',
  'white-space: nowrap;',
]) requireText('src/styles/auth.css', text);
for (const text of [
  '.login-shell:focus-within',
  'transition: font-size',
]) forbidText('src/styles/auth.css', text);

for (const text of [
  'unified-asset-tabs',
  'placeAssetOrder',
  'single-order-book',
  'order-book-divider',
  'items={localTrades}',
  'local-trades-virtual-table',
  '<FactoryIcon />',
  'formatNumber(order.remaining)',
  'formatCurrency(order.price)',
]) requireText('src/pages/MarketPage.tsx', text);

for (const text of [
  'localTrades.map(',
  'market-stat-strip',
  '工厂数量市场',
  '仅保存在当前浏览器；更换设备或清除网站数据后不会恢复。',
  '>⚙</span>',
]) forbidText('src/pages/MarketPage.tsx', text);

for (const text of [
  'title="生产"',
  'SwitchControl',
  'checked={group.enabled}',
  '>运行 {formatNumber(model.derived.runningFacilities)}',
  '>停止 {formatNumber(model.derived.stoppedFacilities)}',
  '>异常 {formatNumber(model.derived.blockedFacilities)}',
  'facility-status-header',
  '异常：资金不足',
  '异常：仓库已满',
  '异常：原料不足',
  '运行中',
  '下一周期加入',
  '冻结中',
  'FacilityProductionFormula',
  'products={game.products}',
  'inventories={game.inventories}',
  'production-plan-heading',
  'production-plan-fields',
  '<strong>当前计划</strong>',
  'placeholder="目标产量"',
  '下一周期生效',
  'scheduleTargetPlanSave',
  'queuePlanSave',
  '在统一订单簿中买卖该工厂',
  '>前往市场 →',
  'formatNumber(group.count)',
]) requireText('src/pages/ProductionPage.tsx', text);

for (const text of [
  'facility-formula-input-group',
  'facility-formula-center',
  'facility-formula-output-group',
  'facility-formula-progress',
  'facility-formula-summary',
  'CycleIcon',
  'CreditsIcon',
  'WarehouseIcon',
]) requireText('src/components/facilities/FacilityProductionFormula.tsx', text);

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
]) forbidText('src/pages/ProductionPage.tsx', text);

for (const text of [
  'title="资产"',
  '查看现金、商品、工厂资产与当前浏览器中的资产变化记录。',
  'title="本地资产变动"',
  'className="widget span-3 asset-event-panel"',
  'items={filteredEvents}',
  'asset-event-virtual-list',
  'ProductIconLabel',
  'formatNumber(change.availableAfter)',
  'formatNumber(change.outputQuantity)',
]) requireText('src/pages/AssetsPage.tsx', text);

for (const text of [
  'filteredEvents.map(',
  '商品库存与估值',
  'product-asset-grid',
  'product-asset-card',
  'setSelectedProductId',
]) forbidText('src/pages/AssetsPage.tsx', text);

for (const text of [
  'items={collectibles}',
  'items={giftCodes}',
  'items={ownership}',
  'items={redemptions}',
  'admin-collectibles-virtual-table',
  'admin-gifts-virtual-table',
  'admin-redemptions-virtual-table',
]) requireText('src/app/AdminApp.tsx', text);
for (const text of [
  'collectibles.map(',
  'giftCodes.map(',
  'ownership.map(',
  'redemptions.map(',
]) forbidText('src/app/AdminApp.tsx', text);

for (const text of [
  'ResizeObserver',
  'measuredSizesRef',
  'overscan',
  'aria-setsize',
  'virtual-list__canvas',
]) requireText('src/components/ui/VirtualList.tsx', text);
for (const text of [
  '.virtual-list',
  '.virtual-record-table',
  '.virtual-record-row',
  '.asset-event-virtual-list',
]) requireText('src/styles/virtual-list.css', text);

for (const text of [
  "{ id: 'assets', label: '资产' }",
  "{ id: 'collections', label: '藏品' }",
  "{ id: 'auction', label: '拍卖' }",
]) requireText('src/config/navigation.ts', text);
forbidText('src/config/navigation.ts', "{ id: 'assets', label: '资金' }");

for (const text of [
  'title="藏品"',
  'getCollectibleState',
  'collectible-gallery',
  '芝加哥艺术博物馆 IIIF',
  "model.setTab('auction')",
]) requireText('src/pages/CollectionsPage.tsx', text);

for (const text of [
  'title="拍卖"',
  'createCollectibleAuction',
  'placeCollectibleBid',
  'cancelCollectibleAuction',
  '最高出价资金会冻结',
  '等待服务器结算',
]) requireText('src/pages/AuctionPage.tsx', text);

for (const text of [
  'const stockedProducts = useMemo',
  'inventory.available > 0 || inventory.frozen > 0',
  'ProductIconLabel',
  '<strong>可用 {formatNumber(inventory.available)}</strong>',
  '<small>冻结 {formatNumber(inventory.frozen)}</small>',
  '等级 {formatNumber(game.warehouseLevel)}',
]) requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);
for (const text of [
  'WarehouseContentFilter',
  '全部商品',
  '查看全部商品',
  'warehouseMaxLevel',
  '已达最高等级',
  '种商品有库存',
  'const total = inventory.available + inventory.frozen',
  '<strong>库存 {total}</strong>',
]) forbidText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);

for (const text of [
  "window.matchMedia('(max-width: 720px)').matches",
  'const [compactNumbers, setCompactNumbers] = useState(() =>',
]) requireText('src/app/gameViewModel.ts', text);

for (const text of [
  '点击工作次数',
  '生产商品总数',
  '买入商品总数',
  '卖出商品总数',
  '礼品兑换',
  '退出登录',
  '重置经济状态',
  '全局使用 K/M/B/T 缩写大额金额、库存、数量与容量',
  'formatNumber(game.stats.workClicks)',
]) requireText('src/pages/SettingsPage.tsx', text);

for (const text of [
  '登录会话',
  '重置服务器经济状态',
  '使用万和百万单位缩写大额资产',
  '全局使用 K/M/B/T 缩写大额金额与状态栏容量',
]) forbidText('src/pages/SettingsPage.tsx', text);
for (const text of [
  "label: '仓库剩余'",
  "id: 'warehouse'",
  'setCompactNumbersEnabled(model.compactNumbers)',
  'formatNumber(game.warehouseUsedCapacity)',
]) requireText('src/app/GameApp.tsx', text);
for (const text of ["id: 'inventory'", "id: 'market'"]) forbidText('src/app/GameApp.tsx', text);

for (const text of [
  'let compactNumbersEnabled = false',
  'export function setCompactNumbersEnabled',
  'export function formatNumber',
  'return compactNumbersEnabled ? formatAbbreviatedNumber(value) : formatFullNumber(value)',
  'return formatNumber(value)',
  "suffix: 'K'",
  "suffix: 'M'",
  "suffix: 'B'",
  "suffix: 'T'",
]) requireText('src/utils/formatters.ts', text);

for (const [path, text] of [
  ['src/pages/OverviewPage.tsx', 'formatNumber(derived.runningFacilities)'],
  ['src/pages/LeaderboardPage.tsx', 'formatNumber(entry.facilityCount)'],
  ['src/components/shell/NavigationItems.tsx', 'formatNumber(openOrderCount)'],
]) requireText(path, text);

for (const text of [
  '概览｜市场｜生产｜资产｜藏品｜拍卖｜排行｜设置',
  '| 藏品 | `collections` | `CollectionsPage` | 当前玩家持有的唯一艺术藏品 |',
  '| 拍卖 | `auction` | `AuctionPage` | 藏品竞价拍卖与结算结果 |',
  '页面主标题固定为“生产”',
  '不显示独立库存总量行',
  '平板、手机和极窄屏保持双列',
  '资产页不得再显示逐商品“商品库存与估值”卡片',
  '仓库不再提供“有库存／全部商品”筛选',
  '建设新工厂卡独占左侧列并在桌面滚动时常驻',
  '大于 1380px 时工厂列表固定四列',
  '单座生产公式',
  '多输入、多输出和逐输入库存兼容展示',
  '以箭头替代生产进度条',
  '最高出价资金、退款、拍卖状态和归属转移全部由服务器判定',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  '“紧凑数字”是全局客户端显示偏好',
  '`GameApp` 必须在状态栏和页面内容渲染前通过 `setCompactNumbersEnabled` 同步当前偏好',
  '`formatCurrency` 和 `formatCompactNumber` 对大额数值统一使用 K/M/B/T',
  '切换后当前游戏外壳和所有使用统一格式器的页面立即同步',
  '`VirtualList` 是高增长记录的唯一窗口化基础组件',
  'DOM 只渲染可视区域和少量预加载行',
  '移动登录页面通过 `100dvh` 和矮屏媒体查询适配软键盘',
  '输入、按钮焦点和提交中的原生 `disabled` 状态不得改变标题字号、区块间距或整体对齐',
  '表单使用 `aria-busy` 表达提交状态',
  '账号和密码必须保留原生未受控表单值',
  '提交时通过 `FormData(event.currentTarget)` 读取浏览器自动填充内容',
  '不得把账号或密码重新绑定到初始为空的 React `value` 状态',
  '使用 `.login-shell:focus-within` 或其他焦点选择器改变移动登录页标题字号、区块间距或整体对齐',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

for (const text of [
  '资产页资产事件和市场页本地成交属于高增长记录列表，必须使用共享 `VirtualList` 窗口化组件',
  '对资产事件或本地成交直接使用全量 `.map()` 创建全部 DOM',
]) requireText('docs/LOCAL_ACTIVITY_LOG_DESIGN.md', text);
for (const text of [
  '藏品列表、礼品码列表、归属历史和兑换记录可能持续增长，必须复用共享 `VirtualList`',
  '对管理员藏品、礼品码、归属或兑换记录恢复全量 `.map()` DOM 渲染',
]) requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', text);

for (const text of [
  '实际数字格式遵循全局“紧凑数字”偏好',
  '玩家关闭全局“紧凑数字”后，桌面和移动状态栏都显示带千分位的完整整数',
]) requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', text);

if (failures.length) {
  console.error(`页面内容与职责验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('页面内容、八页导航、高增长记录窗口化、登录自动填充、藏品拍卖、全局紧凑数字、生产公式和仓库职责验证通过。');
