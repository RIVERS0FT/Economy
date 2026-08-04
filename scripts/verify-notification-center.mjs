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
  inventoryCapacity: 100,
  warehouseAvailableCapacity: 0,
  facilityTypes: [{ id: 'farm', name: '农场' }],
  facilityGroups: [{
    facilityTypeId: 'farm',
    count: 2,
    status: 'error',
    statusReason: 'insufficient_input',
  }],
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
    'warehouse:capacity',
    'contract:issue:contract-1',
    'auction:outbid:auction-1',
    'bank:loan-grace',
    'bank:weekly-settlement',
  ]),
  'pending items must be stable, deduplicated, state-derived records',
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
    inventoryCapacity: undefined,
    warehouseAvailableCapacity: undefined,
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
assert.doesNotMatch(gameShell, /model\.notice\s*\?/);
assert.doesNotMatch(gameShell, /CurrencyText/);

const statusBar = read('src/components/shell/StatusBar.tsx');
assert.match(statusBar, /action\?: ReactNode/);
assert.match(statusBar, /className="asset-bar-layout"/);
assert.match(statusBar, /className="asset-bar-content"/);
assert.match(statusBar, /className="asset-bar-action"/);

const gameThreeLayerVerifier = read('scripts/verify-game-three-layer.mjs');
assert.match(gameThreeLayerVerifier, /NotificationCenterButton/);
assert.doesNotMatch(gameThreeLayerVerifier, /<StatusBar items=\{statusItems\} \/>/);

const hook = read('src/hooks/useNotificationCenter.ts');
assert.match(hook, /panelOpenRef\.current/);
assert.match(hook, /if \(panelOpenRef\.current \|\| !title\.trim\(\)\) return/);
assert.match(hook, /markNotificationsRead/);
assert.match(hook, /clearReadNotifications/);
assert.match(hook, /deleteNotification/);
assert.match(hook, /TOAST_DURATION_MS = 4_500/);
assert.match(hook, /MAX_TOAST_QUEUE = 3/);

const notificationModel = read('src/notifications/notificationCenter.ts');
assert.match(notificationModel, /Omit<Partial<EconomyState>/);
assert.match(notificationModel, /Array\.isArray\(game\.facilityTypes\)/);
assert.match(notificationModel, /Array\.isArray\(game\.facilityGroups\)/);
assert.match(notificationModel, /Number\.isFinite\(inventoryCapacity\)/);
assert.match(notificationModel, /game\.bankAccount\?\.activeLoan\?\.status/);
assert.match(notificationModel, /game\.bankSummary\?\.weeklyCashSettlement\?\.outstandingCredits/);

const component = read('src/components/notifications/NotificationCenter.tsx');
assert.match(component, /useWorkspaceFloatingLayer/);
assert.match(component, /createPortal/);
assert.match(component, /CurrencyText/);
assert.match(component, /清除已读/);
assert.match(component, /删除通知/);
assert.match(component, /MOBILE_NOTIFICATION_QUERY = '\(max-width: 720px\)'/);
assert.match(component, /MOBILE_ISLAND_EXIT_MS = 230/);
assert.match(component, /function MobileNotificationIsland/);
assert.match(component, /renderedToasts\[renderedToasts\.length - 1\]/);
assert.match(component, /hiddenCount = Math\.max\(0, renderedToasts\.length - 1\)/);
assert.match(component, /className="mobile-notice-region notification-island-region"/);
assert.match(component, /data-phase=\{phase\}/);
assert.match(component, /aria-live="polite"/);
assert.doesNotMatch(component, /LiquidGlassSurface/);
assert.doesNotMatch(component, /notice-toast/);

const browserTest = read('tests/browser/notification-center.spec.ts');
assert.match(browserTest, /partial runtime state keeps the signed-in shell/);
assert.match(browserTest, /mountMobileIsland/);
assert.match(browserTest, /getByRole\('dialog', \{ name: '通知' \}\)/);
assert.match(browserTest, /document\.querySelectorAll\('\.asset-bar \.liquid-glass-surface'\)/);
assert.match(browserTest, /geometry\.trigger\.width\)\.toBeCloseTo\(44, 0\)/);
assert.match(browserTest, /geometry\.trigger\.height\)\.toBeCloseTo\(44, 0\)/);
assert.match(browserTest, /panel remains above extreme workspace z-index/);
assert.match(browserTest, /notification-layer-regression-sentinel/);
assert.match(browserTest, /document\.elementFromPoint/);
assert.match(browserTest, /panelCloseIsTopmost/);
assert.match(browserTest, /floatingLayerOrder/);
assert.match(browserTest, /floatingLayerZIndex\)\.toBe\('1'\)/);
assert.match(browserTest, /islandCenter\)\.toBeCloseTo\(geometry\.viewportWidth \/ 2, 0\)/);
assert.match(browserTest, /panel\.left\)\.toBeCloseTo\(geometry\.status\.left, 0\)/);
assert.match(browserTest, /reduced motion/);
assert.match(browserTest, /animationName\)\.toBe\('none'\)/);
assert.doesNotMatch(browserTest, /layout\.classList/);
assert.doesNotMatch(browserTest, /notice-toast/);
assert.doesNotMatch(browserTest, /toBeCloseTo\(36, 0\)/);

const currencyVerifier = read('scripts/verify-currency-svg.mjs');
assert.match(currencyVerifier, /src\/components\/notifications\/NotificationCenter\.tsx/);
assert.doesNotMatch(currencyVerifier, /src\/components\/shell\/GameShell\.tsx/);

const styles = read('src/styles/notification-center.css');
assert.match(styles, /\.asset-bar-layout/);
assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\) 56px/);
assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 48px/);
assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.notification-center-trigger\s*\{[\s\S]*?width:\s*44px;[\s\S]*?min-width:\s*44px;[\s\S]*?height:\s*44px;[\s\S]*?min-height:\s*44px;/);
assert.doesNotMatch(styles, /@media \(max-width: 720px\)[\s\S]*?\.notification-center-trigger\s*\{[\s\S]*?(?:width|height):\s*36px;/);
assert.match(styles, /\.notification-panel-layer/);
assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.notification-panel-layer\s*\{[\s\S]*?padding:\s*0;/);
assert.doesNotMatch(styles, /@media \(max-width: 720px\)[\s\S]*?\.notification-panel-layer\s*\{[\s\S]*?padding-inline-(?:start|end):/);
assert.match(styles, /\.notification-toast-stack/);
assert.match(styles, /\.notification-island\s*\{/);
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
assert.match(viewportStyles, /@media \(max-width: 720px\)[\s\S]*?\.signed-in-shell__body\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*0;[\s\S]*?order:\s*1;/);
assert.match(viewportStyles, /@media \(max-width: 720px\)[\s\S]*?\.mobile-page-overlay\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*0;[\s\S]*?order:\s*1;/);
assert.match(viewportStyles, /@media \(max-width: 720px\)[\s\S]*?\.workspace-floating-layer\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*1;[\s\S]*?order:\s*2;/);

const mobileStatusStyles = read('src/styles/mobile-status-layout.css');
assert.match(mobileStatusStyles, /\.notification-island-region/);
assert.match(mobileStatusStyles, /50vw/);
assert.match(mobileStatusStyles, /transform:\s*translateX\(-50%\)/);
assert.match(mobileStatusStyles, /safe-area-inset-left/);
assert.match(mobileStatusStyles, /safe-area-inset-right/);
assert.match(mobileStatusStyles, /\.notification-island-region \.notification-island/);
assert.match(mobileStatusStyles, /pointer-events:\s*auto/);

const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
assert.match(pageDesign, /状态栏最右侧/);
assert.match(pageDesign, /最近 20 条/);
assert.match(pageDesign, /面板关闭/);
assert.match(pageDesign, /待处理事项不能删除/);

const liquidDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
assert.match(liquidDesign, /\.asset-bar-layout/);
assert.match(liquidDesign, /通知灵动岛/);
assert.match(liquidDesign, /物理屏幕水平中线/);
assert.match(liquidDesign, /从中心对称展开/);
assert.match(liquidDesign, /工作区浮层根已经提供唯一水平边界/);
assert.match(liquidDesign, /面板打开时立即清空 Toast 队列/);
assert.match(liquidDesign, /移动工作区使用局部层级堆叠边界/);
assert.match(liquidDesign, /工作区浮层根固定 `order: 2; z-index: 1`/);
assert.match(liquidDesign, /页面内部任意正 `z-index`/);

const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
assert.match(uiDesign, /## 通知面板与关闭态 Toast/);
assert.match(uiDesign, /移动只显示队列最后一条/);
assert.match(uiDesign, /关闭后焦点返回通知入口/);
assert.match(uiDesign, /缺失领域不得阻断登录后外壳/);
assert.match(uiDesign, /`48px` 工具轨道和 `44×44px` 触控目标/);
assert.match(uiDesign, /不得缩回旧测试夹具的 `36px`/);

console.log('notification center verification passed');
