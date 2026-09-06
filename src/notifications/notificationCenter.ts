import type { TabId } from '../config/navigation';
import type { EconomyState, FacilityStatusReason } from '../types';

export const NOTIFICATION_HISTORY_LIMIT = 20;
export const NOTIFICATION_STORAGE_VERSION = 1;

export type NotificationTone = 'info' | 'success' | 'warning' | 'error';
export type PendingNotificationSeverity = 'attention' | 'warning' | 'critical';

export interface NotificationRecord {
  id: string;
  title: string;
  message?: string;
  tone: NotificationTone;
  targetTab?: TabId;
  createdAt: number;
  readAt: number | null;
}

export interface NotificationInput {
  id?: string;
  title: string;
  message?: string;
  tone?: NotificationTone;
  targetTab?: TabId;
  createdAt?: number;
}

export interface PendingNotificationItem {
  key: string;
  signature: string;
  category: 'production' | 'market' | 'auction' | 'contracts' | 'bank';
  severity: PendingNotificationSeverity;
  title: string;
  message: string;
  targetTab: TabId;
}

interface NotificationAuction {
  id: string;
  status: 'open' | 'sold' | 'ended' | 'cancelled';
  isOutbid?: boolean;
}

interface NotificationContract {
  id: string;
  status: 'open' | 'active' | 'completed' | 'cancelled' | 'terminated' | 'expired';
  issue?: string | null;
  isBuyer?: boolean;
  isSupplier?: boolean;
}

type NotificationGameState = Omit<Partial<EconomyState>, 'assetAuctions' | 'productionContracts'> & {
  assetAuctions?: NotificationAuction[];
  productionContracts?: NotificationContract[];
};

const VALID_TABS = new Set<TabId>([
  'home',
  'market',
  'buildings',
  'research',
  'auction',
  'contracts',
  'bank',
  'leaderboard',
  'gem-shop',
  'settings',
]);

const FACILITY_REASON_COPY: Record<FacilityStatusReason, {
  severity: PendingNotificationSeverity;
  title: string;
  detail: string;
}> = {
  manual: {
    severity: 'attention',
    title: '已停止运行',
    detail: '处于手动停止状态',
  },
  insufficient_funds: {
    severity: 'critical',
    title: '运营资金不足',
    detail: '因运营资金不足停止生产',
  },
  insufficient_input: {
    severity: 'warning',
    title: '缺少生产原料',
    detail: '因生产原料不足停止生产',
  },
  no_available_facility: {
    severity: 'warning',
    title: '没有可参与生产的设施',
    detail: '全部工厂当前被冻结或不可参与生产',
  },
  maintenance: {
    severity: 'attention',
    title: '正在维护',
    detail: '因系统维护暂时停止生产',
  },
};

const SEVERITY_ORDER: Record<PendingNotificationSeverity, number> = {
  critical: 0,
  warning: 1,
  attention: 2,
};

const CATEGORY_ORDER: Record<PendingNotificationItem['category'], number> = {
  production: 0,
  market: 1,
  contracts: 2,
  auction: 3,
  bank: 4,
};

let notificationSequence = 0;

function nextNotificationId(createdAt: number) {
  notificationSequence = (notificationSequence + 1) % 1_000_000;
  return `${createdAt.toString(36)}-${notificationSequence.toString(36)}`;
}

function normalizedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedTargetTab(value: unknown): TabId | undefined {
  return typeof value === 'string' && VALID_TABS.has(value as TabId)
    ? value as TabId
    : undefined;
}

function normalizedTone(value: unknown): NotificationTone {
  return value === 'success' || value === 'warning' || value === 'error'
    ? value
    : 'info';
}

function normalizeNotificationRecord(value: unknown): NotificationRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<NotificationRecord>;
  const id = normalizedString(record.id);
  const title = normalizedString(record.title);
  const createdAt = Number(record.createdAt);
  if (!id || !title || !Number.isFinite(createdAt) || createdAt <= 0) return null;
  const message = normalizedString(record.message);
  const readAtValue = Number(record.readAt);
  return {
    id,
    title,
    message: message || undefined,
    tone: normalizedTone(record.tone),
    targetTab: normalizedTargetTab(record.targetTab),
    createdAt,
    readAt: Number.isFinite(readAtValue) && readAtValue > 0 ? readAtValue : null,
  };
}

export function normalizeNotificationRecords(value: unknown): NotificationRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeNotificationRecord)
    .filter((record): record is NotificationRecord => Boolean(record))
    .sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id))
    .slice(0, NOTIFICATION_HISTORY_LIMIT);
}

export function notificationStorageKey(userId: number) {
  return `economy:notifications:v${NOTIFICATION_STORAGE_VERSION}:${userId}`;
}

export function appendNotification(
  current: NotificationRecord[],
  input: NotificationInput,
  readImmediately = false,
): NotificationRecord[] {
  const title = normalizedString(input.title);
  if (!title) return current;
  const createdAt = Number.isFinite(input.createdAt) ? Number(input.createdAt) : Date.now();
  const message = normalizedString(input.message) || undefined;
  const id = normalizedString(input.id) || nextNotificationId(createdAt);
  if (current.some((item) => item.id === id)) return current;
  const record: NotificationRecord = {
    id,
    title,
    message,
    tone: input.tone ?? inferNotificationTone(title),
    targetTab: input.targetTab ?? targetTabFromMessage(title),
    createdAt,
    readAt: readImmediately ? createdAt : null,
  };
  return [record, ...current].slice(0, NOTIFICATION_HISTORY_LIMIT);
}

export function markNotificationsRead(current: NotificationRecord[], readAt = Date.now()) {
  let changed = false;
  const next = current.map((notification) => {
    if (notification.readAt !== null) return notification;
    changed = true;
    return { ...notification, readAt };
  });
  return changed ? next : current;
}

export function clearReadNotifications(current: NotificationRecord[]) {
  const next = current.filter((notification) => notification.readAt === null);
  return next.length === current.length ? current : next;
}

export function deleteNotification(current: NotificationRecord[], notificationId: string) {
  const next = current.filter((notification) => notification.id !== notificationId);
  return next.length === current.length ? current : next;
}

export function inferNotificationTone(message: string): NotificationTone {
  if (/失败|错误|异常|不足|无法|拒绝|超出|失效|封禁/.test(message)) return 'error';
  if (/警告|即将|等待|处理中|部分成交|被超过|被超价/.test(message)) return 'warning';
  if (/成功|完成|已提交|已保存|已兑换|已签到|已恢复|全部成交|已清除/.test(message)) return 'success';
  return 'info';
}

export function targetTabFromMessage(message: string): TabId | undefined {
  if (/拍卖|出价|竞拍/.test(message)) return 'auction';
  if (/合同|履约|交付/.test(message)) return 'contracts';
  if (/贷款|还款|存款|取款|银行|利息|周结算/.test(message)) return 'bank';
  if (/仓库/.test(message)) return 'province';
  if (/工厂|建筑|生产|原料|施工/.test(message)) return 'buildings';
  if (/订单|买单|卖单|成交|市场/.test(message)) return 'market';
  if (/研发|技术/.test(message)) return 'research';
  if (/排行|排名|结算/.test(message)) return 'leaderboard';
  if (/宝石|兑换|商店|邀请/.test(message)) return 'gem-shop';
  if (/工作|签到|教程/.test(message)) return 'home';
  return undefined;
}

function facilityPendingItems(game: NotificationGameState): PendingNotificationItem[] {
  const facilityTypes = Array.isArray(game.facilityTypes) ? game.facilityTypes : [];
  const facilityGroups = Array.isArray(game.facilityGroups) ? game.facilityGroups : [];
  const facilityNames = new Map(facilityTypes.map((facility) => [facility.id, facility.name]));
  return facilityGroups.flatMap((group) => {
    if (group.status !== 'error' && group.status !== 'stopped') return [];
    const reason = group.statusReason ?? 'maintenance';
    const copy = FACILITY_REASON_COPY[reason] ?? FACILITY_REASON_COPY.maintenance;
    const facilityName = facilityNames.get(group.facilityTypeId) ?? group.facilityTypeId;
    return [{
      key: `facility:${group.facilityTypeId}`,
      signature: `facility:${group.facilityTypeId}:${reason}`,
      category: 'production' as const,
      severity: copy.severity,
      title: `${facilityName}${copy.title}`,
      message: `${Math.max(1, group.count)} 座${facilityName}${copy.detail}`,
      targetTab: 'buildings' as const,
    }];
  });
}

function marketPendingItems(game: NotificationGameState): PendingNotificationItem[] {
  const openOrders = (Array.isArray(game.orders) ? game.orders : []).filter((order) => (
    order.isOwn
    && (order.status === 'open' || order.status === 'partial')
    && order.remaining > 0
  ));
  if (openOrders.length === 0) return [];
  const buyCount = openOrders.filter((order) => order.side === 'buy').length;
  const sellCount = openOrders.length - buyCount;
  return [{
    key: 'market:open-orders',
    signature: `market:open-orders:${openOrders.map((order) => `${order.id}:${order.status}:${order.remaining}`).sort().join('|')}`,
    category: 'market',
    severity: 'attention',
    title: `${openOrders.length} 笔挂单等待处理`,
    message: `买单 ${buyCount} 笔，卖单 ${sellCount} 笔`,
    targetTab: 'market',
  }];
}


function auctionPendingItems(game: NotificationGameState): PendingNotificationItem[] {
  const auctions = Array.isArray(game.assetAuctions) ? game.assetAuctions : [];
  return auctions
    .filter((auction) => auction.status === 'open' && Boolean(auction.isOutbid))
    .map((auction) => ({
      key: `auction:outbid:${auction.id}`,
      signature: `auction:outbid:${auction.id}`,
      category: 'auction' as const,
      severity: 'warning' as const,
      title: '拍卖出价已被超过',
      message: `拍卖 ${auction.id} 当前需要重新评估出价`,
      targetTab: 'auction' as const,
    }));
}

function contractPendingItems(game: NotificationGameState): PendingNotificationItem[] {
  const contracts = Array.isArray(game.productionContracts) ? game.productionContracts : [];
  return contracts
    .filter((contract) => (
      contract.status === 'active'
      && (contract.isBuyer || contract.isSupplier)
      && Boolean(contract.issue)
    ))
    .map((contract) => ({
      key: `contract:issue:${contract.id}`,
      signature: `contract:issue:${contract.id}:${normalizedString(contract.issue)}`,
      category: 'contracts' as const,
      severity: 'critical' as const,
      title: '合同履约需要处理',
      message: normalizedString(contract.issue) || `合同 ${contract.id} 当前存在履约问题`,
      targetTab: 'contracts' as const,
    }));
}

function bankPendingItems(game: NotificationGameState): PendingNotificationItem[] {
  const items: PendingNotificationItem[] = [];
  if (game.bankAccount?.activeLoan?.status === 'grace') {
    items.push({
      key: 'bank:loan-grace',
      signature: 'bank:loan-grace',
      category: 'bank',
      severity: 'critical',
      title: '贷款已经进入宽限期',
      message: '请在宽限期结束前完成还款，避免冻结工厂被处置',
      targetTab: 'bank',
    });
  }
  const outstandingCredits = Number(
    game.bankSummary?.weeklyCashSettlement?.outstandingCredits,
  );
  if (Number.isFinite(outstandingCredits) && outstandingCredits > 0) {
    items.push({
      key: 'bank:weekly-settlement',
      signature: 'bank:weekly-settlement',
      category: 'bank',
      severity: 'warning',
      title: '周资金结算尚未完成',
      message: '当前存在待补缴的周资金结算金额',
      targetTab: 'bank',
    });
  }
  return items;
}

export function derivePendingNotificationItems(
  game: NotificationGameState,
): PendingNotificationItem[] {
  return [
    ...facilityPendingItems(game),
    ...marketPendingItems(game),
    ...contractPendingItems(game),
    ...auctionPendingItems(game),
    ...bankPendingItems(game),
  ].sort((left, right) => (
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    || CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category]
    || left.title.localeCompare(right.title, 'zh-CN')
    || left.key.localeCompare(right.key)
  ));
}
