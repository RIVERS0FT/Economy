import { useCallback, useSyncExternalStore } from 'react';
import { estimateServerNow, subscribeServerClock } from '../utils/serverClock.js';

interface SharedTicker {
  version: number;
  listeners: Set<() => void>;
  timer: number | null;
  unsubscribeClock: (() => void) | null;
}

const sharedTickers = new Map<number, SharedTicker>();

function normalizedInterval(intervalMs: number) {
  const interval = Math.floor(Number(intervalMs));
  return Number.isFinite(interval) && interval >= 250 ? interval : 1_000;
}

function tickerFor(intervalMs: number) {
  const interval = normalizedInterval(intervalMs);
  let ticker = sharedTickers.get(interval);
  if (!ticker) {
    ticker = {
      version: 0,
      listeners: new Set(),
      timer: null,
      unsubscribeClock: null,
    };
    sharedTickers.set(interval, ticker);
  }
  return { interval, ticker };
}

function signalTicker(ticker: SharedTicker) {
  ticker.version += 1;
  for (const listener of [...ticker.listeners]) listener();
}

function subscribeSharedTicker(intervalMs: number, listener: () => void) {
  const { interval, ticker } = tickerFor(intervalMs);
  ticker.listeners.add(listener);
  if (ticker.listeners.size === 1) {
    ticker.unsubscribeClock = subscribeServerClock(() => signalTicker(ticker));
    ticker.timer = window.setInterval(() => signalTicker(ticker), interval);
  }
  return () => {
    ticker.listeners.delete(listener);
    if (ticker.listeners.size > 0) return;
    if (ticker.timer !== null) window.clearInterval(ticker.timer);
    ticker.timer = null;
    ticker.unsubscribeClock?.();
    ticker.unsubscribeClock = null;
  };
}

function sharedTickerVersion(intervalMs: number) {
  return tickerFor(intervalMs).ticker.version;
}

export function useNow(referenceNow = Date.now(), intervalMs = 1_000) {
  const interval = normalizedInterval(intervalMs);
  const subscribe = useCallback(
    (listener: () => void) => subscribeSharedTicker(interval, listener),
    [interval],
  );
  const getSnapshot = useCallback(() => sharedTickerVersion(interval), [interval]);
  useSyncExternalStore(subscribe, getSnapshot, () => 0);
  return estimateServerNow(referenceNow);
}
