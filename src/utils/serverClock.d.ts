export interface ServerClock {
  now(fallbackNow?: number): number;
  accept(serverNow: unknown): boolean;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

export function createServerClock(monotonicNow?: () => number): ServerClock;
export function acceptServerNow(serverNow: unknown): boolean;
export function estimateServerNow(fallbackNow?: number): number;
export function resetServerClock(): void;
export function subscribeServerClock(listener: () => void): () => void;
