function defaultMonotonicNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

export function createServerClock(monotonicNow = defaultMonotonicNow) {
  let anchor = null;
  const listeners = new Set();

  const estimatedNow = (fallbackNow = Date.now()) => {
    if (!anchor) return Number(fallbackNow);
    return anchor.serverNow + Math.max(0, monotonicNow() - anchor.receivedAt);
  };

  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    now(fallbackNow = Date.now()) {
      return estimatedNow(fallbackNow);
    },
    accept(value) {
      const incomingServerNow = Number(value);
      if (!Number.isFinite(incomingServerNow) || incomingServerNow < 0) return false;
      const receivedAt = monotonicNow();
      const currentEstimate = anchor
        ? anchor.serverNow + Math.max(0, receivedAt - anchor.receivedAt)
        : incomingServerNow;
      anchor = {
        serverNow: Math.max(incomingServerNow, currentEstimate),
        receivedAt,
      };
      emit();
      return true;
    },
    reset() {
      anchor = null;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const sharedServerClock = createServerClock();

export const acceptServerNow = (serverNow) => sharedServerClock.accept(serverNow);
export const estimateServerNow = (fallbackNow) => sharedServerClock.now(fallbackNow);
export const resetServerClock = () => sharedServerClock.reset();
export const subscribeServerClock = (listener) => sharedServerClock.subscribe(listener);
