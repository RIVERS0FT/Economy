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

const component = read('src/components/notifications/NotificationCenter.tsx');
assert.match(component, /useWorkspaceFloatingLayer/);
assert.match(component, /createPortal/);
assert.match(component, /CurrencyText/);
assert.match(component, /清除已读/);
assert.match(component, /删除通知/);
assert.doesNotMatch(component, /LiquidGlassSurface/);
assert.doesNotMatch(component, /notice-toast/);

const browserTest = read('tests/browser/notification-center.spec.ts');
assert.match(browserTest, /layout\.classList\.add\('asset-bar-layout'\)/);
assert.doesNotMatch(browserTest, /layout\.className = 'asset-bar-layout'/);
assert.doesNotMatch(browserTest, /notice-toast/);

const currencyVerifier = read('scripts/verify-currency-svg.mjs');
assert.match(currencyVerifier, /src\/components\/notifications\/NotificationCenter\.tsx/);
assert.doesNotMatch(currencyVerifier, /src\/components\/shell\/GameShell\.tsx/);

const styles = read('src/styles/notification-center.css');
assert.match(styles, /\.asset-bar-layout/);
assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\) 56px/);
assert.match(styles, /\.notification-panel-layer/);
assert.match(styles, /\.notification-toast-stack/);
assert.match(styles, /@media \(max-width: 720px\)/);
assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)/);
assert.match(styles, /html\[data-input-modality="mouse"\] \.notification-toast:hover/);
assert.match(styles, /\.notification-toast:not\(:last-child\)/);
assert.match(styles, /overscroll-behavior-y:\s*auto/);
assert.doesNotMatch(styles, /overscroll-behavior:\s*contain/);

const mobileStatusStyles = read('src/styles/mobile-status-layout.css');
assert.match(mobileStatusStyles, /\.mobile-notice-region \.notification-toast/);
assert.match(mobileStatusStyles, /pointer-events:\s*auto/);

const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
assert.match(pageDesign, /状态栏最右侧/);
assert.match(pageDesign, /最近 20 条/);
assert.match(pageDesign, /面板关闭/);
assert.match(pageDesign, /待处理事项不能删除/);

const liquidDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
assert.match(liquidDesign, /\.asset-bar-layout/);
assert.match(liquidDesign, /实际 `\.notification-toast` 必须恢复 `pointer-events:auto`/);
assert.match(liquidDesign, /面板打开时立即清空 Toast 队列/);

const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
assert.match(uiDesign, /## 通知面板与关闭态 Toast/);
assert.match(uiDesign, /移动只显示队列最后一条/);
assert.match(uiDesign, /关闭后焦点返回通知入口/);

console.log('notification center verification passed');
