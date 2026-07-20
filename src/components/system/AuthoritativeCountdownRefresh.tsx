import { useEffect } from 'react';
import type { EconomyState } from '../../types';
import { nextAuthoritativeCountdownDeadline } from '../../utils/authoritativeCountdowns';

export const AUTHORITY_CONFIRMATION_RETRY_MS = 1_000;

export function AuthoritativeCountdownRefresh({
  game,
  refresh,
}: {
  game: EconomyState;
  refresh: () => Promise<void>;
}) {
  const deadline = nextAuthoritativeCountdownDeadline(game);

  useEffect(() => {
    if (deadline === null) return undefined;

    let disposed = false;
    let deadlineTimer: number | null = null;
    let confirmationTimer: number | null = null;
    const receivedAt = Date.now();
    const estimatedServerNow = () => (
      game.lastProcessedAt + Math.max(0, Date.now() - receivedAt)
    );
    const confirmAuthority = () => {
      if (disposed) return;
      void refresh().catch(() => undefined);
    };
    const beginConfirmation = () => {
      confirmAuthority();
      confirmationTimer = window.setInterval(confirmAuthority, AUTHORITY_CONFIRMATION_RETRY_MS);
    };

    const remaining = Math.max(0, deadline - estimatedServerNow());
    if (remaining === 0) beginConfirmation();
    else deadlineTimer = window.setTimeout(beginConfirmation, remaining);

    return () => {
      disposed = true;
      if (deadlineTimer !== null) window.clearTimeout(deadlineTimer);
      if (confirmationTimer !== null) window.clearInterval(confirmationTimer);
    };
  }, [deadline, game.lastProcessedAt, refresh]);

  return null;
}
