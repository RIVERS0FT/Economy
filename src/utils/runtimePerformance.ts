let configured = false;

/**
 * Economy progression is authoritative on the server. The browser only keeps
 * lightweight presentation timers and requests periodic snapshots, so no local
 * economy processing or localStorage persistence is installed here.
 */
export function configureRuntimePerformance() {
  if (configured || typeof document === 'undefined') return;
  configured = true;
  document.documentElement.dataset.economyRuntime = 'server-authoritative';
}
