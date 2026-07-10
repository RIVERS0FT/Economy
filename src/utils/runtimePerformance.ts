import { useGameStore } from '../store/gameStore';

let configured = false;

/**
 * The UI asks the store to process elapsed economy time every second so that
 * countdowns stay fresh. The original action cloned the complete state and
 * synchronously wrote localStorage on every tick, even when no factory or
 * population cycle had completed. Throttle those expensive snapshots while
 * keeping all player actions immediate. Elapsed-time processing catches up
 * automatically after the page becomes visible again.
 */
export function configureRuntimePerformance() {
  if (configured || typeof window === 'undefined') return;
  configured = true;

  const originalProcess = useGameStore.getState().process;
  let lastProcessedAt = 0;

  const processEconomy = () => {
    if (document.visibilityState === 'hidden') return;

    const now = performance.now();
    if (now - lastProcessedAt < 3_000) return;

    lastProcessedAt = now;
    originalProcess();
  };

  const catchUp = () => {
    if (document.visibilityState === 'hidden') return;
    lastProcessedAt = performance.now();
    originalProcess();
  };

  useGameStore.setState({ process: processEconomy });
  window.addEventListener('focus', catchUp, { passive: true });
  document.addEventListener('visibilitychange', catchUp, { passive: true });
}
