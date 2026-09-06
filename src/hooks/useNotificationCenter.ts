import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameAuthorityDependencies } from '../app/gameAuthorityStore';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  appendNotification,
  clearReadNotifications,
  deleteNotification,
  derivePendingNotificationItems,
  inferNotificationTone,
  markNotificationsRead,
  normalizeNotificationRecords,
  notificationStorageKey,
  type NotificationRecord,
  type NotificationInput,
  type NotificationTone,
  type PendingNotificationItem,
} from '../notifications/notificationCenter';

export interface NotificationToast {
  id: string;
  title: string;
  tone: NotificationTone;
}

const TOAST_DURATION_MS = 4_500;
const MAX_TOAST_QUEUE = 3;
const NOTIFICATION_ALERTS_STORAGE_VERSION = 1;

function notificationAlertsStorageKey(userId: number) {
  return `economy:notification-alerts:v${NOTIFICATION_ALERTS_STORAGE_VERSION}:${userId}`;
}

function loadNotificationAlertsEnabled(userId: number) {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(notificationAlertsStorageKey(userId)) !== 'disabled';
  } catch {
    return true;
  }
}

function loadNotifications(userId: number): NotificationRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(notificationStorageKey(userId));
    return raw ? normalizeNotificationRecords(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export interface NotificationCenterController {
  panelOpen: boolean;
  alertsEnabled: boolean;
  pendingItems: PendingNotificationItem[];
  notifications: NotificationRecord[];
  toasts: NotificationToast[];
  pendingCount: number;
  unreadCount: number;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setAlertsEnabled: (enabled: boolean) => void;
  clearRead: () => void;
  deleteOne: (notificationId: string) => void;
}

export function useNotificationCenter(model: LoadedGameViewModel): NotificationCenterController {
  const authorityGame = useGameAuthorityDependencies([
    'catalog',
    'player.production',
    'player.bank',
    'market.orders',
    'auction',
    'contract',
  ]);
  const game = authorityGame ?? model.game;
  const [panelOpen, setPanelOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabledState] = useState(() => (
    loadNotificationAlertsEnabled(model.user.id)
  ));
  const [notifications, setNotifications] = useState<NotificationRecord[]>(() => (
    loadNotifications(model.user.id)
  ));
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const panelOpenRef = useRef(false);
  const alertsEnabledRef = useRef(alertsEnabled);
  const toastSequenceRef = useRef(0);
  const toastTimersRef = useRef(new Map<string, number>());
  const lastNoticeRef = useRef('');
  const consumedEventsRef = useRef(new Set<string>());
  const [notificationOwnerId, setNotificationOwnerId] = useState(model.user.id);
  const pendingKeysRef = useRef<Set<string> | null>(null);
  const pendingItems = useMemo(
    () => derivePendingNotificationItems(game),
    [game],
  );

  const removeToast = useCallback((toastId: string) => {
    const timer = toastTimersRef.current.get(toastId);
    if (timer !== undefined) window.clearTimeout(timer);
    toastTimersRef.current.delete(toastId);
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const clearToasts = useCallback(() => {
    toastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    toastTimersRef.current.clear();
    setToasts([]);
  }, []);

  const setAlertsEnabled = useCallback((enabled: boolean) => {
    alertsEnabledRef.current = enabled;
    setAlertsEnabledState(enabled);
    if (!enabled) clearToasts();
    try {
      window.localStorage.setItem(
        notificationAlertsStorageKey(model.user.id),
        enabled ? 'enabled' : 'disabled',
      );
    } catch {
      // Alert preference persistence is optional and must never block gameplay.
    }
  }, [clearToasts, model.user.id]);

  const enqueueToast = useCallback((title: string, tone: NotificationTone) => {
    if (panelOpenRef.current || !alertsEnabledRef.current || !title.trim()) return;
    toastSequenceRef.current += 1;
    const toastId = `notification-toast-${Date.now().toString(36)}-${toastSequenceRef.current.toString(36)}`;
    setToasts((current) => [
      ...current,
      { id: toastId, title, tone },
    ].slice(-MAX_TOAST_QUEUE));
    const timer = window.setTimeout(() => removeToast(toastId), TOAST_DURATION_MS);
    toastTimersRef.current.set(toastId, timer);
  }, [removeToast]);

  const addNotification = useCallback((input: NotificationInput) => {
    const { title } = input;
    const tone = input.tone ?? inferNotificationTone(title);
    setNotifications((current) => appendNotification(
      current,
      { ...input, title, tone },
      panelOpenRef.current,
    ));
    enqueueToast(title, tone);
  }, [enqueueToast]);

  const openPanel = useCallback(() => {
    panelOpenRef.current = true;
    setPanelOpen(true);
    clearToasts();
    setNotifications((current) => markNotificationsRead(current));
  }, [clearToasts]);

  const closePanel = useCallback(() => {
    panelOpenRef.current = false;
    setPanelOpen(false);
  }, []);

  const togglePanel = useCallback(() => {
    if (panelOpenRef.current) closePanel();
    else openPanel();
  }, [closePanel, openPanel]);

  useEffect(() => {
    const nextAlertsEnabled = loadNotificationAlertsEnabled(model.user.id);
    panelOpenRef.current = false;
    alertsEnabledRef.current = nextAlertsEnabled;
    setPanelOpen(false);
    setAlertsEnabledState(nextAlertsEnabled);
    clearToasts();
    lastNoticeRef.current = '';
    pendingKeysRef.current = null;
    const stored = loadNotifications(model.user.id);
    consumedEventsRef.current = new Set(stored.map((item) => item.id));
    setNotificationOwnerId(model.user.id);
    setNotifications(stored);
  }, [clearToasts, model.user.id]);

  useEffect(() => {
    if (notificationOwnerId !== model.user.id) return;
    try {
      window.localStorage.setItem(
        notificationStorageKey(model.user.id),
        JSON.stringify(notifications),
      );
    } catch {
      // Notification history is optional and must never block gameplay.
    }
  }, [model.user.id, notificationOwnerId, notifications]);

  useEffect(() => {
    if (model.noticeEvents !== undefined) {
      for (const event of model.noticeEvents) {
        if (event.userId !== model.user.id || consumedEventsRef.current.has(event.id)) continue;
        consumedEventsRef.current.add(event.id);
        addNotification(event);
      }
      consumedEventsRef.current = new Set(model.noticeEvents.filter((event) => event.userId === model.user.id).map((event) => event.id));
      return;
    }
    // Compatibility for older read-only models. Real game actions always supply event IDs.
    const notice = model.notice.trim();
    if (!notice) {
      lastNoticeRef.current = '';
      return;
    }
    if (lastNoticeRef.current === notice) return;
    lastNoticeRef.current = notice;
    addNotification({ title: notice });
  }, [addNotification, model.notice, model.noticeEvents, model.user.id]);

  useEffect(() => {
    const nextKeys = new Set(pendingItems.map((item) => item.key));
    const previousKeys = pendingKeysRef.current;
    pendingKeysRef.current = nextKeys;
    if (!previousKeys) return;

    pendingItems.forEach((item) => {
      if (previousKeys.has(item.key)) return;
      enqueueToast(item.title, item.severity === 'critical' ? 'error' : 'warning');
    });
  }, [enqueueToast, pendingItems]);

  useEffect(() => () => {
    toastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    toastTimersRef.current.clear();
  }, []);

  const unreadCount = notifications.reduce(
    (count, notification) => count + (notification.readAt === null ? 1 : 0),
    0,
  );

  return {
    panelOpen,
    alertsEnabled,
    pendingItems,
    notifications,
    toasts,
    pendingCount: pendingItems.length,
    unreadCount,
    openPanel,
    closePanel,
    togglePanel,
    setAlertsEnabled,
    clearRead: () => setNotifications((current) => clearReadNotifications(current)),
    deleteOne: (notificationId) => setNotifications((current) => (
      deleteNotification(current, notificationId)
    )),
  };
}
