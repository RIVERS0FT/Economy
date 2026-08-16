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
  pendingItems: PendingNotificationItem[];
  notifications: NotificationRecord[];
  toasts: NotificationToast[];
  pendingCount: number;
  unreadCount: number;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
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
  const [notifications, setNotifications] = useState<NotificationRecord[]>(() => (
    loadNotifications(model.user.id)
  ));
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const panelOpenRef = useRef(false);
  const toastSequenceRef = useRef(0);
  const toastTimersRef = useRef(new Map<string, number>());
  const lastNoticeRef = useRef('');
  const pendingSignaturesRef = useRef<Map<string, string> | null>(null);
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

  const enqueueToast = useCallback((title: string, tone: NotificationTone) => {
    if (panelOpenRef.current || !title.trim()) return;
    toastSequenceRef.current += 1;
    const toastId = `notification-toast-${Date.now().toString(36)}-${toastSequenceRef.current.toString(36)}`;
    setToasts((current) => [
      ...current,
      { id: toastId, title, tone },
    ].slice(-MAX_TOAST_QUEUE));
    const timer = window.setTimeout(() => removeToast(toastId), TOAST_DURATION_MS);
    toastTimersRef.current.set(toastId, timer);
  }, [removeToast]);

  const addNotification = useCallback((title: string) => {
    const tone = inferNotificationTone(title);
    setNotifications((current) => appendNotification(
      current,
      { title, tone },
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
    panelOpenRef.current = false;
    setPanelOpen(false);
    clearToasts();
    lastNoticeRef.current = '';
    pendingSignaturesRef.current = null;
    setNotifications(loadNotifications(model.user.id));
  }, [clearToasts, model.user.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        notificationStorageKey(model.user.id),
        JSON.stringify(notifications),
      );
    } catch {
      // Notification history is optional and must never block gameplay.
    }
  }, [model.user.id, notifications]);

  useEffect(() => {
    const notice = model.notice.trim();
    if (!notice) {
      lastNoticeRef.current = '';
      return;
    }
    if (lastNoticeRef.current === notice) return;
    lastNoticeRef.current = notice;
    addNotification(notice);
  }, [addNotification, model.notice]);

  useEffect(() => {
    const nextSignatures = new Map(pendingItems.map((item) => [item.key, item.signature]));
    const previousSignatures = pendingSignaturesRef.current;
    pendingSignaturesRef.current = nextSignatures;
    if (!previousSignatures) return;

    pendingItems.forEach((item) => {
      if (previousSignatures.get(item.key) === item.signature) return;
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
    pendingItems,
    notifications,
    toasts,
    pendingCount: pendingItems.length,
    unreadCount,
    openPanel,
    closePanel,
    togglePanel,
    clearRead: () => setNotifications((current) => clearReadNotifications(current)),
    deleteOne: (notificationId) => setNotifications((current) => (
      deleteNotification(current, notificationId)
    )),
  };
}
