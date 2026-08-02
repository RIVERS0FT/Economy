import type { ReactNode } from 'react';

export function ApplicationLoadingState({ children }: { children: ReactNode }) {
  return (
    <main className="game-state-shell">
      <div className="loading-screen" role="status" aria-live="polite">{children}</div>
    </main>
  );
}
