import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  appendNotification,
  clearReadNotifications,
  deleteNotification,
  derivePendingNotificationItems,
  markNotificationsRead,
  NOTIFICATION_HISTORY_LIMIT,
} from '../src/notifications/notificationCenter.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

assert.equal(NOTIFICATION_HISTORY_LIMIT, 20, 'ordinary notification history must remain capped at 20');

let notifications = [];
for (let index = 0; index < 25; index += 1) {
  notifications = appendNotification(notifications, {
    title: `通知 ${index}`,
    createdAt: 1_000 + index * 1_000,
  });
}
assert.equal(notifications.length, 20, 'only the newest 20 notifications should be retained');
assert.equal(notifications[0]?.title, '通知 24');
assert.equal(notifications.at(-1)?.title, '通知 5');

notifications = markNotificationsRead(notifications, 99_000);
assert.ok(notifications.every((notification) => notification.readAt === 99_000));
notifications = clearReadNotifications(notifications);
assert.deepEqual(notifications, [], 'clear-read must remove only read ordinary notifications');

notifications = appendNotification([], { title: '可删除通知', createdAt: 123_000 });
assert.equal(deleteNotification(notifications, notifications[0].id).length, 0);

const pendingItems = derivePendingNotificationItems({
  facilityTypes: [{ id: 'farm', name: '农场' }, { id: 'mill', name: '磨坊' }],
  facilityGroups: [{
    facilityTypeId: 'farm',
    count: 2,
    status: 'error',
    statusReason: 'insufficient_input',
  }, {
    facilityTypeId: 'mill',
    count: 1,
    status: 'stopped',
    statusReason: 'manual',
  }],
  orders: [{ id: 'order-1', isOwn: true, status: 'open', remaining: 3, side: 'buy' }],
  bankAccount: { activeLoan: { status: 'grace' } },
  bankSummary: { weeklyCashSettlement: { outstandingCredits: 8 } },
  assetAuctions: [{ id: 'auction-1', status: 'open', isOutbid: true }],
  productionContracts: [{
    id: 'contract-1',
    status: 'active',
    issue: '供应商品不足',
    isSupplier: true,
  }],
});
assert.deepEqual(
  new Set(pendingItems.map((item) => item.key)),
  new Set([
    'facility:farm',
    'facility:mill',
    'market:open-orders',
    'contract:issue:contract-1',
    'auction:outbid:auction-1',
    'bank:loan-grace',
    'bank:weekly-settlement',
  ]),
  'pending items must be stable, deduplicated, state-derived records',
);

const marketPendingBefore = derivePendingNotificationItems({
  orders: [{ id: 'order-1', isOwn: true, status: 'open', remaining: 3, side: 'buy' }],
});
const marketPendingAfter = derivePendingNotificationItems({
  orders: [{ id: 'order-1', isOwn: true, status: 'partial', remaining: 2, side: 'buy' }],
});
assert.equal(marketPendingBefore[0]?.key, 'market:open-orders');
assert.equal(marketPendingAfter[0]?.key, marketPendingBefore[0]?.key);
assert.notEqual(
  marketPendingAfter[0]?.signature,
  marketPendingBefore[0]?.signature,
  'pending content may update while the stable problem key remains the same',
);

assert.deepEqual(
  derivePendingNotificationItems({}),
  [],
  'missing domain partitions must produce no pending items instead of blocking the shell',
);
assert.deepEqual(
  derivePendingNotificationItems({
    facilityTypes: [],
    facilityGroups: [],
    bankAccount: undefined,
    bankSummary: undefined,
  }),
  [],
  'partial browser and migration states must remain safe',
);

const gameShell = read('src/components/shell/GameShell.tsx');
assert.match(gameShell, /useNotificationCenter\(model\)/);
assert.match(gameShell, /NotificationCenterButton/);
assert.match(gameShell, /NotificationCenterPanel/);
assert.match(gameShell, /NotificationToasts/);
assert.equal((gameShell.match(/<NotificationToasts/g) ?? []).length, 2, 'desktop and mobile toast hosts must remain separate');
assert.match(gameShell, /surface="mobile"/);
assert.match(gameShell, /surface="desktop"/);
assert.match(gameShell, /workspaceChrome=\{\([\s\S]*?<StrategicWorkspaceChrome[\s\S]*?<NotificationToasts[\s\S]*?surface="desktop"/);
assert.match(gameShell, /notificationCenter\.panelOpen \? null : \(/);
assert.match(gameShell, /alertsEnabled=\{notificationCenter\.alertsEnabled\}/);
assert.match(gameShell, /onSetAlertsEnabled=\{notificationCenter\.setAlertsEnabled\}/);
assert.match(gameShell, /workspaceSheetOpen=\{mobileSheetOpen\}/);
assert.doesNotMatch(gameShell, /model\.notice\s*\?/);
assert.doesNotMatch(gameShell, /CurrencyText/);

const statusBar = read('src/components/shell/StatusBar.tsx');
assert.match(statusBar, /action\?: ReactNode/);
assert.match(statusBar, /className="asset-bar-layout"/);
assert.match(statusBar, /className="asset-bar-identity"/);
assert.match(statusBar, /className="asset-bar-content"/);
assert.match(statusBar, /className="asset-bar-action"/);

const gameThreeLayerVerifier = read('scripts/verify-game-three-layer.mjs');
assert.match(gameThreeLayerVerifier, /NotificationCenterButton/);
assert.doesNotMatch(gameThreeLayerVerifier, /<StatusBar items=\{statusItems\} \/>/);

const hook = read('src/hooks/useNotificationCenter.ts');
assert.match(hook, /panelOpenRef\.current/);
assert.match(hook, /alertsEnabledRef\.current/);
assert.match(hook, /notification-alerts:v/);
assert.match(hook, /setAlertsEnabled/);
assert.match(hook, /if \(panelOpenRef\.current \|\| !alertsEnabledRef\.current \|\| !title\.trim\(\)\) return/);
assert.match(hook, /pendingKeysRef/);
assert.match(hook, /previousKeys\.has\(item\.key\)/);
assert.doesNotMatch(hook, /pendingSignaturesRef/);
assert.match(hook, /clearToasts\(\)/);
assert.match(hook, /markNotificationsRead/);
assert.match(hook, /clearReadNotifications/);
assert.match(hook, /deleteNotification/);
assert.match(hook, /TOAST_DURATION_MS = 4_500/);
assert.match(hook, /MAX_TOAST_QUEUE = 3/);
assert.match(hook, /'market\.orders'/);

const notificationModel = read('src/notifications/notificationCenter.ts');
assert.match(notificationModel, /Omit<Partial<EconomyState>/);
assert.match(notificationModel, /Array\.isArray\(game\.facilityTypes\)/);
assert.match(notificationModel, /Array\.isArray\(game\.facilityGroups\)/);
assert.match(notificationModel, /function marketPendingItems/);
assert.match(notificationModel, /key: 'market:open-orders'/);
assert.match(notificationModel, /group\.status !== 'error' && group\.status !== 'stopped'/);
assert.doesNotMatch(notificationModel, /warehouseAvailableCapacity|inventoryCapacity/);
assert.match(notificationModel, /game\.bankAccount\?\.activeLoan\?\.status/);
assert.match(notificationModel, /game\.bankSummary\?\.weeklyCashSettlement\?\.outstandingCredits/);

const component = read('src/components/notifications/NotificationCenter.tsx');
assert.match(component, /useWorkspaceFloatingLayer/);
assert.match(component, /useWorkspaceDialogLayer/);
assert.match(component, /const targetLayer = mobile \? dialogLayer : floatingLayer/);
assert.match(component, /data-notification-layer=\{mobile \? 'dialog' : 'floating'\}/);
assert.match(component, /window\.addEventListener\('keydown', onKeyDown, true\)/);
assert.match(component, /event\.stopPropagation\(\)/);
assert.match(component, /createPortal/);
assert.match(component, /CurrencyText/);
assert.match(component, /禁用通知/);
assert.match(component, /启用通知/);
assert.match(component, /onSetAlertsEnabled/);
assert.match(component, /清除已读/);
assert.match(component, /删除通知/);
assert.doesNotMatch(component, /<p>\{pendingItems\.length > 0/);
assert.match(component, /<small><CurrencyText>\{item\.message\}<\/CurrencyText><\/small>/);
assert.match(component, /MOBILE_NOTIFICATION_QUERY = '\(max-width: 720px\)'/);
assert.match(component, /MOBILE_ISLAND_EXIT_MS = 230/);
assert.match(component, /NotificationToastSurface = 'auto' \| 'desktop' \| 'mobile'/);
assert.match(component, /const enabled = surface === 'auto'/);
assert.match(component, /const renderMobile = surface === 'mobile'/);
assert.match(component, /function MobileNotificationIsland/);
assert.match(component, /renderedToasts\[renderedToasts\.length - 1\]/);
assert.match(component, /hiddenCount = Math\.max\(0, renderedToasts\.length - 1\)/);
assert.match(component, /className="mobile-notice-region notification-island-region"/);
assert.match(component, /data-phase=\{phase\}/);
assert.match(component, /aria-live="polite"/);
assert.match(component, /onPointerDown=\{onClose\}/);
assert.match(component, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
assert.doesNotMatch(component, /onMouseDown=/);
assert.doesNotMatch(component, /LiquidGlassSurface/);
assert.doesNotMatch(component, /notice-toast/);

const browserTest = read('tests/browser/notification-center.spec.ts');
assert.match(browserTest, /partial runtime state keeps the signed-in shell/);
assert.match(browserTest, /mountDesktopToast/);
assert.match(browserTest, /mountMobileIsland/);
assert.match(browserTest, /notification strategic chrome fixture is incomplete/);
assert.match(browserTest, /getByRole\('dialog', \{ name: '通知' \}\)/);
assert.match(browserTest, /pointer press on the blank overlay closes the panel while panel content stays open/);
assert.match(browserTest, /toast shares the outliner layer at bottom-right/);
assert.match(browserTest, /desktop toast remains bottom-right while the outliner persists on fullscreen pages/);
assert.match(browserTest, /toastStackZIndex\)\.toBe\(geometry\.outlinerZIndex\)/);
assert.match(browserTest, /Math\.abs\(geometry\.toast\.width - geometry\.outliner\.width\)/);
assert.match(browserTest, /document\.elementsFromPoint/);
assert.match(browserTest, /toastPrecedesOutlinerAtOverlap/);
assert.doesNotMatch(browserTest, /toastOwnsOverlap/);
assert.match(browserTest, /outlinerParentIsStrategicChrome/);
assert.match(browserTest, /geometry\.toastStack\.bottom\)\.toBeCloseTo\(geometry\.workspace\.bottom - 8, 0\)/);
assert.match(browserTest, /document\.querySelectorAll\('\.asset-bar \.frosted-glass-surface'\)/);
assert.match(browserTest, /geometry\.trigger\.width\)\.toBeCloseTo\(44, 0\)/);
assert.match(browserTest, /geometry\.trigger\.height\)\.toBeCloseTo\(44, 0\)/);
assert.match(browserTest, /mobile notification panel overlays an open workspace sheet without leaving an island mounted/);
assert.match(browserTest, /data-notification-layer', 'dialog'/);
assert.match(browserTest, /document\.elementFromPoint/);
assert.match(browserTest, /panelAboveSheet/);
assert.match(browserTest, /statusIsTopmost/);
assert.match(browserTest, /panelParentIsDialogLayer/);
assert.match(browserTest, /panelLayerZIndex\)\.toBeGreaterThan\(geometry\.sheetBackdropZIndex\)/);
assert.match(browserTest, /page\.locator\('\.notification-island'\)\)\.toHaveCount\(0\)/);
assert.match(browserTest, /await expect\(workspaceSheet\)\.toBeVisible\(\)/);
assert.match(browserTest, /reduced motion/);
assert.match(browserTest, /animationName\)\.toBe\('none'\)/);
assert.doesNotMatch(browserTest, /panel remains above extreme workspace z-index/);
assert.doesNotMatch(browserTest, /notification-layer-regression-sentinel/);
assert.doesNotMatch(browserTest, /floatingLayerZIndex\)\.toBe\('4'\)/);
assert.doesNotMatch(browserTest, /layout\.classList/);
assert.doesNotMatch(browserTest, /notice-toast/);
assert.doesNotMatch(browserTest, /toBeCloseTo\(36, 0\)/);

const reserveBrowserTest = read('tests/browser/mobile-notification-sheet-reserve.spec.ts');
assert.match(reserveBrowserTest, /even when no island is mounted/);
assert.match(reserveBrowserTest, /notification-island-height/);
assert.match(reserveBrowserTest, /sheetTop/);
assert.match(reserveBrowserTest, /overlays the sheet without changing its reserved top edge/);
assert.match(reserveBrowserTest, /禁用通知/);
assert.match(reserveBrowserTest, /启用通知/);
assert.match(reserveBrowserTest, /notification-alerts:v1:/);
assert.match(reserveBrowserTest, /page\.reload\(\)/);

const currencyVerifier = read('scripts/verify-currency-svg.mjs');
assert.match(currencyVerifier, /src\/components\/notifications\/NotificationCenter\.tsx/);
assert.doesNotMatch(currencyVerifier, /src\/components\/shell\/GameShell\.tsx/);

const styles = read('src/styles/notification-center.css');
assert.match(styles, /\.asset-bar-layout/);
assert.match(styles, /\.asset-bar-layout\s*\{[\s\S]*?align-items:\s*center;/);
assert.match(styles, /grid-template-columns:\s*minmax\(164px, 210px\) minmax\(0, 1fr\) 56px/);
assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?grid-template-columns:\s*40px minmax\(0, 1fr\) 48px/);
assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.notification-center-trigger\s*\{[\s\S]*?width:\s*44px;[\s\S]*?min-width:\s*44px;[\s\S]*?height:\s*44px;[\s\S]*?min-height:\s*44px;/);
assert.doesNotMatch(styles, /@media \(max-width: 720px\)[\s\S]*?\.notification-center-trigger\s*\{[\s\S]*?(?:width|height):\s*36px;/);
assert.match(styles, /\.notification-panel-layer/);
assert.match(styles, /\.notification-panel__alerts/);
assert.match(styles, /\.notification-panel-layer\s*\{[\s\S]*?padding:\s*0 var\(--layout-gutter\) var\(--layout-gutter\);/);
assert.match(styles, /\.notification-panel-layer\s*\{[^}]*background:\s*transparent;/);
assert.doesNotMatch(styles, /\.notification-panel-layer\s*\{[^}]*background:\s*rgba\(/);
assert.match(styles, /\.notification-toast-stack\s*\{[\s\S]*?z-index:\s*2;[\s\S]*?right:\s*var\(--notification-toast-inset\);[\s\S]*?bottom:\s*var\(--notification-toast-inset\);[\s\S]*?width:\s*min\(360px,/);
assert.doesNotMatch(styles, /\.notification-toast-stack\s*\{[^}]*top:/);
assert.match(styles, /\.game-shell \.workspace-strategic-chrome > \.notification-toast-stack\s*\{\s*pointer-events:\s*none;/);
assert.match(styles, /from \{ opacity: 0; transform: translateY\(8px\); \}/);
assert.match(styles, /\.notification-island\s*\{/);
assert.match(styles, /height:\s*var\(--mobile-notification-island-height, 56px\)/);
assert.match(styles, /transform-origin:\s*center center/);
assert.match(styles, /@keyframes notification-island-enter/);
assert.match(styles, /@keyframes notification-island-exit/);
assert.match(styles, /@keyframes notification-panel-mobile-enter/);
assert.match(styles, /\.notification-island\[data-phase="exiting"\]/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)/);
assert.match(styles, /html\[data-input-modality="mouse"\] \.notification-island:hover/);
assert.match(styles, /overscroll-behavior-y:\s*auto/);
assert.doesNotMatch(styles, /overscroll-behavior:\s*contain/);
assert.doesNotMatch(styles, /backdrop-filter/);

const viewportStyles = read('src/styles/viewport.css');
assert.match(viewportStyles, /\.workspace-dialog-layer\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*3000;/);
assert.match(viewportStyles, /@media \(max-width: 720px\)[\s\S]*?\.signed-in-shell__body\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*auto;[\s\S]*?order:\s*1;/);
assert.match(viewportStyles, /@media \(max-width: 720px\)[\s\S]*?\.workspace-floating-layer\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*auto;[\s\S]*?order:\s*2;/);

const mobileStatusStyles = read('src/styles/mobile-status-layout.css');
assert.match(mobileStatusStyles, /\.signed-in-shell__chrome\s*\{\s*z-index:\s*3001;/);
assert.match(mobileStatusStyles, /--mobile-notification-island-height:\s*56px/);
assert.match(mobileStatusStyles, /\.workspace-dialog-layer > \.notification-panel-layer\[data-notification-layer='dialog'\]/);
assert.match(mobileStatusStyles, /z-index:\s*10/);
assert.match(mobileStatusStyles, /var\(--mobile-status-top-inset\)/);
assert.match(mobileStatusStyles, /\.notification-island-region/);
assert.match(mobileStatusStyles, /50vw/);
assert.match(mobileStatusStyles, /transform:\s*translateX\(-50%\)/);
assert.match(mobileStatusStyles, /safe-area-inset-left/);
assert.match(mobileStatusStyles, /safe-area-inset-right/);
assert.match(mobileStatusStyles, /\.notification-island-region \.notification-island/);
assert.match(mobileStatusStyles, /pointer-events:\s*auto/);

const mobileSheetHost = read('src/components/ui/MobileWorkspaceSheetHost.tsx');
assert.match(mobileSheetHost, /--mobile-notification-island-height/);
assert.match(mobileSheetHost, /reservedNotificationHeight/);
assert.match(mobileSheetHost, /statusGap \+ islandHeight \+ statusGap/);
assert.match(mobileSheetHost, /viewportBottom - statusBottom - reservedNotificationHeight/);

const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
assert.match(pageDesign, /状态栏最右侧/);
assert.match(pageDesign, /最近 20 条/);
assert.match(pageDesign, /面板关闭/);
assert.match(pageDesign, /待处理事项不能删除/);
assert.match(pageDesign, /概览不得再维护第二套经营提醒列表/);
assert.match(pageDesign, /同一稳定待处理键持续存在期间/);
assert.match(pageDesign, /禁用主动通知提醒/);
const liquidDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
assert.match(liquidDesign, /通知面板作为 Chrome 级临时覆盖层始终位于 Sheet 之上/);
assert.match(liquidDesign, /通知面板打开期间不得挂载通知岛/);
assert.match(liquidDesign, /\.asset-bar-layout/);
assert.match(liquidDesign, /桌面关闭态 Toast/);
assert.match(liquidDesign, /\.workspace-strategic-chrome/);
assert.match(liquidDesign, /相同局部 `z-index: 2`/);
assert.match(liquidDesign, /独立最大宽度 `360px`/);
assert.match(liquidDesign, /整个右栏不挂载也仍必须保留桌面 Toast/);
assert.match(liquidDesign, /通知灵动岛/);
assert.match(liquidDesign, /物理屏幕水平中线/);
assert.match(liquidDesign, /从中心对称展开/);
assert.match(liquidDesign, /即使当前没有通知岛/);
assert.match(liquidDesign, /面板打开时立即清空 Toast 队列/);
assert.match(liquidDesign, /点击面板外遮罩空白必须关闭/);
assert.match(liquidDesign, /状态栏始终位于 Sheet 与通知面板之上/);
assert.match(liquidDesign, /Sheet 外部区域不得压暗或模糊/);

const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
assert.match(uiDesign, /## 通知面板与关闭态 Toast/);
assert.match(uiDesign, /移动只显示队列最后一条/);
assert.match(uiDesign, /标题只保留主标题和必要说明/);
assert.match(uiDesign, /关闭后焦点返回通知入口/);
assert.match(uiDesign, /缺失领域不得阻断登录后外壳/);
assert.match(uiDesign, /`48px` 工具轨道和 `44×44px` 触控目标/);
assert.match(uiDesign, /不得缩回旧测试夹具的 `36px`/);
assert.match(uiDesign, /Sheet 自身承担唯一移动毛玻璃模糊/);

console.log('notification center verification passed');
