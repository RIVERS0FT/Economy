import { useEffect } from 'react';
import type { RefreshOptions } from '../../app/gameViewModel';
import type { EconomyState } from '../../types';
import { nextAuthoritativeCountdownDeadline } from '../../utils/authoritativeCountdowns';
import { estimateServerNow, subscribeServerClock } from '../../utils/serverClock.js';

export const AUTHORITY_CONFIRMATION_RETRY_MS = 1_000;

export function AuthoritativeCountdownRefresh({
  game,
  refresh,
}: {
  game: EconomyState;
  refresh: (options?: RefreshOptions) => Promise<void>;
}) {
  const deadline = nextAuthoritativeCountdownDeadline(game);

  useEffect(() => {
    if (deadline === null) return undefined;

    let disposed = false;
    let confirming = false;
    let deadlineTimer: number | null = null;
    let confirmationTimer: number | null = null;

    const confirmAuthority = async () => {
      if (disposed) return;
      await refresh({ mode: 'authoritative', expectedDeadline: deadline }).catch(() => undefined);
      if (!disposed) {
        confirmationTimer = window.setTimeout(() => void confirmAuthority(), AUTHORITY_CONFIRMATION_RETRY_MS);
      }
    };
    const beginConfirmation = () => {
      if (disposed || confirming) return;
      confirming = true;
      void confirmAuthority();
    };
    const scheduleDeadline = () => {
      if (disposed || confirming) return;
      if (deadlineTimer !== null) window.clearTimeout(deadlineTimer);
      const remaining = Math.max(0, deadline - estimateServerNow(game.lastProcessedAt));
      if (remaining === 0) beginConfirmation();
      else deadlineTimer = window.setTimeout(beginConfirmation, remaining);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleDeadline();
    };

    const unsubscribe = subscribeServerClock(scheduleDeadline);
    scheduleDeadline();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (deadlineTimer !== null) window.clearTimeout(deadlineTimer);
      if (confirmationTimer !== null) window.clearTimeout(confirmationTimer);
    };
  }, [deadline, game.lastProcessedAt, refresh]);

  return null;
}
