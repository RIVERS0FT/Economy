import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameActionResult } from '../api/game';
import { NOTIFICATION_HISTORY_LIMIT, type NotificationInput, type NotificationTone } from '../notifications/notificationCenter';

export interface OperationNotice extends NotificationInput {
  id: string;
  userId: number;
}

const EMPTY_EVENTS: readonly OperationNotice[] = [];
let sequence = 0;

function makeEvent(userId: number, title: string, tone?: NotificationTone): OperationNotice {
  const createdAt = Date.now();
  return { id: `operation-${userId}-${createdAt.toString(36)}-${++sequence}`, userId, title, tone, createdAt };
}

/** One event per receipt, including identical receipts delivered in the same React batch. */
export function useOperationNotifications(userId: number, initialMessage = '') {
  const [state, setState] = useState(() => ({
    userId,
    notice: initialMessage,
    events: initialMessage ? [makeEvent(userId, initialMessage, 'info')] : [] as OperationNotice[],
  }));
  const activeUserRef = useRef<number | null>(userId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef(new WeakSet<object>());

  useEffect(() => {
    activeUserRef.current = userId;
    reportedRef.current = new WeakSet<object>();
    return () => {
      activeUserRef.current = null;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [userId]);

  const notify = useCallback((message: string, tone?: NotificationTone) => {
    const title = message.trim();
    if (!title || activeUserRef.current !== userId) return;
    const event = makeEvent(userId, title, tone);
    setState((current) => ({
      userId,
      notice: title,
      events: [...(current.userId === userId ? current.events : []), event].slice(-NOTIFICATION_HISTORY_LIMIT),
    }));
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setState((current) => current.userId === userId ? { ...current, notice: '' } : current);
    }, 3_000);
  }, [userId]);

  const showResult = useCallback(async (source: GameActionResult | Promise<GameActionResult>) => {
    const result = await source;
    if (activeUserRef.current !== userId || reportedRef.current.has(source) || reportedRef.current.has(result)) return;
    reportedRef.current.add(source);
    reportedRef.current.add(result);
    notify(result.message, (result.code === 'ACTION_RESULT_UNCONFIRMED' || result.code === 'WRITE_RESULT_UNCONFIRMED') ? 'warning' : result.ok ? 'success' : 'error');
  }, [notify, userId]);

  return {
    notice: state.userId === userId ? state.notice : '',
    noticeEvents: state.userId === userId ? state.events : EMPTY_EVENTS,
    notify,
    showResult,
  };
}
