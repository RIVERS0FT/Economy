import { useEffect } from 'react';
import type { RefreshOptions } from '../../app/gameViewModel';
import type { EconomyState } from '../../types';
import { nextAuthoritativeCountdownDeadline } from '../../utils/authoritativeCountdowns';

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
    const receivedAt = Date.now();
    const estimatedServerNow = () => (
      game.lastProcessedAt + Math.max(0, Date.now() - receivedAt)
    );

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
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && deadline <= estimatedServerNow()) beginConfirmation();
    };

    const remaining = Math.max(0, deadline - estimatedServerNow());
    if (remaining === 0) beginConfirmation();
    else deadlineTimer = window.setTimeout(beginConfirmation, remaining);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (deadlineTimer !== null) window.clearTimeout(deadlineTimer);
      if (confirmationTimer !== null) window.clearTimeout(confirmationTimer);
    };
  }, [deadline, game.lastProcessedAt, refresh]);

  return null;
}
