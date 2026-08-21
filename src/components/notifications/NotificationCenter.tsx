import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { TabId } from '../../config/navigation';
import type {
  NotificationRecord,
  NotificationTone,
  PendingNotificationItem,
} from '../../notifications/notificationCenter';
import type { NotificationToast } from '../../hooks/useNotificationCenter';
import { CurrencyText } from '../ui/CurrencyAmount';
import {
  useWorkspaceDialogLayer,
  useWorkspaceFloatingLayer,
} from '../ui/WorkspaceFloatingLayer';

const MOBILE_NOTIFICATION_QUERY = '(max-width: 720px)';
const MOBILE_ISLAND_EXIT_MS = 230;

type MobileIslandPhase = 'visible' | 'exiting';
export type NotificationToastSurface = 'auto' | 'desktop' | 'mobile';

function useMobileNotificationSurface() {
  const [mobile, setMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(MOBILE_NOTIFICATION_QUERY).matches
  ));

  useEffect(() => {
    const query = window.matchMedia(MOBILE_NOTIFICATION_QUERY);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return mobile;
}

function NotificationIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="notification-icon"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function BellIcon() {
  return (
    <NotificationIcon>
      <path d="M6.5 9.8a5.5 5.5 0 0 1 11 0c0 6 2.5 6.2 2.5 7.7H4c0-1.5 2.5-1.7 2.5-7.7Z" />
      <path d="M9.5 20h5" />
    </NotificationIcon>
  );
}

function CloseIcon() {
  return <NotificationIcon><path d="m7 7 10 10M17 7 7 17" /></NotificationIcon>;
}

function DeleteIcon() {
  return (
    <NotificationIcon>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </NotificationIcon>
  );
}

function AlertIcon() {
  return (
    <NotificationIcon>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </NotificationIcon>
  );
}

function InfoIcon() {
  return (
    <NotificationIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 7h.01" />
    </NotificationIcon>
  );
}

function SuccessIcon() {
  return (
    <NotificationIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.4 2.5 2.5L16.5 9" />
    </NotificationIcon>
  );
}

function iconForTone(tone: NotificationTone) {
  if (tone === 'success') return <SuccessIcon />;
  return tone === 'warning' || tone === 'error' ? <AlertIcon /> : <InfoIcon />;
}

function labelForTone(tone: NotificationTone) {
  if (tone === 'success') return '完成';
  if (tone === 'warning') return '需要关注';
  if (tone === 'error') return '需要处理';
  return '通知';
}

function formatNotificationTime(createdAt: number) {
  const date = new Date(createdAt);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  return new Intl.DateTimeFormat('zh-CN', sameDay
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(date);
}

export function NotificationCenterButton({
  open,
  pendingCount,
  unreadCount,
  onToggle,
  buttonRef,
}: {
  open: boolean;
  pendingCount: number;
  unreadCount: number;
  onToggle: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const pendingLabel = pendingCount > 99 ? '99+' : String(pendingCount);
  const ariaLabel = [
    '通知',
    pendingCount > 0 ? `${pendingCount} 项待处理` : '没有待处理事项',
    unreadCount > 0 ? `${unreadCount} 条未读通知` : '没有未读通知',
  ].join('，');

  return (
    <button
      ref={buttonRef}
      type="button"
      className={open ? 'notification-center-trigger active' : 'notification-center-trigger'}
      aria-label={ariaLabel}
      aria-controls="notification-center-panel"
      aria-expanded={open}
      title={ariaLabel}
      onClick={onToggle}
    >
      <BellIcon />
      {pendingCount > 0 ? (
        <span className="notification-center-trigger__count" aria-hidden="true">{pendingLabel}</span>
      ) : null}
      {unreadCount > 0 ? (
        <span className="notification-center-trigger__unread" aria-hidden="true" />
      ) : null}
    </button>
  );
}

function PendingItem({
  item,
  onNavigate,
}: {
  item: PendingNotificationItem;
  onNavigate: (tab: TabId) => void;
}) {
  return (
    <button
      type="button"
      className={`notification-pending-item severity-${item.severity}`}
      onClick={() => onNavigate(item.targetTab)}
    >
      <span className="notification-pending-item__icon" aria-hidden="true"><AlertIcon /></span>
      <span className="notification-pending-item__content">
        <strong>{item.title}</strong>
        <small><CurrencyText>{item.message}</CurrencyText></small>
      </span>
      <span className="notification-pending-item__action" aria-hidden="true">查看</span>
    </button>
  );
}

function NotificationItem({
  notification,
  onNavigate,
  onDelete,
}: {
  notification: NotificationRecord;
  onNavigate: (tab: TabId) => void;
  onDelete: (notificationId: string) => void;
}) {
  const content = (
    <>
      <span className="notification-record__icon" aria-hidden="true">
        {iconForTone(notification.tone)}
      </span>
      <span className="notification-record__content">
        <strong><CurrencyText>{notification.title}</CurrencyText></strong>
        {notification.message ? <small><CurrencyText>{notification.message}</CurrencyText></small> : null}
      </span>
      <time dateTime={new Date(notification.createdAt).toISOString()}>
        {formatNotificationTime(notification.createdAt)}
      </time>
    </>
  );

  return (
    <article className={notification.readAt === null ? 'notification-record unread' : 'notification-record'}>
      {notification.targetTab ? (
        <button
          type="button"
          className="notification-record__body notification-record__body--interactive"
          onClick={() => onNavigate(notification.targetTab as TabId)}
        >
          {content}
        </button>
      ) : (
        <div className="notification-record__body">{content}</div>
      )}
      <button
        type="button"
        className="notification-record__delete"
        aria-label={`删除通知：${notification.title}`}
        title="删除通知"
        onClick={() => onDelete(notification.id)}
      >
        <DeleteIcon />
      </button>
    </article>
  );
}

export function NotificationCenterPanel({
  open,
  pendingItems,
  notifications,
  onClose,
  onClearRead,
  onDelete,
  onNavigate,
  returnFocusRef,
}: {
  open: boolean;
  pendingItems: PendingNotificationItem[];
  notifications: NotificationRecord[];
  onClose: () => void;
  onClearRead: () => void;
  onDelete: (notificationId: string) => void;
  onNavigate: (tab: TabId) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const mobile = useMobileNotificationSurface();
  const floatingLayer = useWorkspaceFloatingLayer();
  const dialogLayer = useWorkspaceDialogLayer();
  const targetLayer = mobile ? dialogLayer : floatingLayer;
  const panelRef = useRef<HTMLElement>(null);
  const hasReadNotifications = useMemo(
    () => notifications.some((notification) => notification.readAt !== null),
    [notifications],
  );

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      returnFocusRef?.current?.focus({ preventScroll: true });
    };
  }, [onClose, open, returnFocusRef]);

  if (!open || !targetLayer) return null;

  return createPortal(
    <div
      className="notification-panel-layer"
      data-notification-layer={mobile ? 'dialog' : 'floating'}
      onPointerDown={onClose}
    >
      <section
        id="notification-center-panel"
        ref={panelRef}
        className="notification-panel"
        role="dialog"
        aria-labelledby="notification-center-title"
        tabIndex={-1}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="notification-panel__header">
          <div>
            <h2 id="notification-center-title">通知</h2>
            <p>{pendingItems.length > 0 ? `${pendingItems.length} 项待处理` : '当前没有待处理事项'}</p>
          </div>
          <div className="notification-panel__actions">
            <button
              type="button"
              className="notification-panel__clear"
              disabled={!hasReadNotifications}
              onClick={onClearRead}
            >
              清除已读
            </button>
            <button
              type="button"
              className="notification-panel__close"
              aria-label="关闭通知面板"
              title="关闭"
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="notification-panel__scroll">
          <section className="notification-panel__section" aria-labelledby="notification-pending-title">
            <div className="notification-panel__section-heading">
              <h3 id="notification-pending-title">待处理</h3>
              <span>{pendingItems.length}</span>
            </div>
            {pendingItems.length > 0 ? (
              <div className="notification-pending-list">
                {pendingItems.map((item) => (
                  <PendingItem key={item.key} item={item} onNavigate={onNavigate} />
                ))}
              </div>
            ) : (
              <p className="notification-panel__empty">经营状态正常，没有需要立即处理的问题。</p>
            )}
          </section>

          <section className="notification-panel__section" aria-labelledby="notification-recent-title">
            <div className="notification-panel__section-heading">
              <h3 id="notification-recent-title">最近通知</h3>
              <span>{notifications.length}/20</span>
            </div>
            {notifications.length > 0 ? (
              <div className="notification-record-list">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onNavigate={onNavigate}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            ) : (
              <p className="notification-panel__empty">暂时没有通知记录。</p>
            )}
          </section>
        </div>
      </section>
    </div>,
    targetLayer,
  );
}

function DesktopNotificationToasts({
  toasts,
  onOpen,
}: {
  toasts: NotificationToast[];
  onOpen: () => void;
}) {
  return (
    <div className="notification-toast-stack" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <button
          type="button"
          className={`notification-toast notification-toast--${toast.tone}`}
          key={toast.id}
          onClick={onOpen}
        >
          <span aria-hidden="true">{iconForTone(toast.tone)}</span>
          <strong><CurrencyText>{toast.title}</CurrencyText></strong>
        </button>
      ))}
    </div>
  );
}

function MobileNotificationIsland({
  toasts,
  onOpen,
}: {
  toasts: NotificationToast[];
  onOpen: () => void;
}) {
  const [renderedToasts, setRenderedToasts] = useState<NotificationToast[]>(toasts);
  const [phase, setPhase] = useState<MobileIslandPhase>('visible');

  useEffect(() => {
    if (toasts.length > 0) {
      setRenderedToasts(toasts);
      setPhase('visible');
      return undefined;
    }
    if (renderedToasts.length === 0) return undefined;

    setPhase('exiting');
    const timer = window.setTimeout(() => {
      setRenderedToasts([]);
      setPhase('visible');
    }, MOBILE_ISLAND_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [renderedToasts.length, toasts]);

  const latestToast = renderedToasts[renderedToasts.length - 1];
  if (!latestToast) return null;

  const hiddenCount = Math.max(0, renderedToasts.length - 1);
  const toneLabel = labelForTone(latestToast.tone);
  const ariaLabel = hiddenCount > 0
    ? `${toneLabel}：${latestToast.title}，另有 ${hiddenCount} 条通知`
    : `${toneLabel}：${latestToast.title}`;

  return (
    <div
      className="mobile-notice-region notification-island-region"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <button
        type="button"
        className={`notification-island notification-island--${latestToast.tone}`}
        data-phase={phase}
        aria-label={ariaLabel}
        onClick={onOpen}
      >
        <span
          key={`${latestToast.id}-icon`}
          className="notification-island__icon"
          aria-hidden="true"
        >
          {iconForTone(latestToast.tone)}
        </span>
        <span
          key={latestToast.id}
          className="notification-island__content"
          aria-hidden="true"
        >
          <strong><CurrencyText>{latestToast.title}</CurrencyText></strong>
        </span>
        <span className="notification-island__status" aria-hidden="true">
          {hiddenCount > 0 ? `+${hiddenCount}` : toneLabel}
        </span>
      </button>
    </div>
  );
}

export function NotificationToasts({
  toasts,
  onOpen,
  surface = 'auto',
}: {
  toasts: NotificationToast[];
  onOpen: () => void;
  surface?: NotificationToastSurface;
}) {
  const mobile = useMobileNotificationSurface();
  const enabled = surface === 'auto'
    || (surface === 'mobile' ? mobile : !mobile);
  if (!enabled) return null;

  const renderMobile = surface === 'mobile' || (surface === 'auto' && mobile);
  if (renderMobile) return <MobileNotificationIsland toasts={toasts} onOpen={onOpen} />;
  if (toasts.length === 0) return null;
  return <DesktopNotificationToasts toasts={toasts} onOpen={onOpen} />;
}
