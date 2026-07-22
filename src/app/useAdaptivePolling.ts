import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  effectivePollingRate,
  isConfiguredPollingRate,
  normalizeConfiguredPollingRate,
  POLLING_IDLE_AFTER_MS,
} from './adaptivePolling.js';

interface AdaptivePollingTarget {
  refreshRate: string;
  setRefreshRate: Dispatch<SetStateAction<string>>;
  refresh: () => Promise<void>;
}

export interface AdaptivePollingPreference {
  refreshRate: string;
  setRefreshRate: Dispatch<SetStateAction<string>>;
}

export function useAdaptivePolling({
  refreshRate: effectiveRate,
  setRefreshRate: setEffectiveRate,
  refresh,
}: AdaptivePollingTarget): AdaptivePollingPreference {
  const [configuredRate, setConfiguredRateState] = useState(() => (
    normalizeConfiguredPollingRate(effectiveRate)
  ));
  const configuredRateRef = useRef(configuredRate);
  const effectiveRateRef = useRef(effectiveRate);
  const lastActivityAtRef = useRef(Date.now());
  const idleTimerRef = useRef<number | null>(null);

  const applyEffectiveRate = useCallback((nextRate: string) => {
    effectiveRateRef.current = nextRate;
    setEffectiveRate((current) => (current === nextRate ? current : nextRate));
  }, [setEffectiveRate]);

  const scheduleCurrentMode = useCallback(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    const elapsed = Math.max(0, Date.now() - lastActivityAtRef.current);
    const hidden = document.visibilityState === 'hidden';
    const idle = !hidden && elapsed >= POLLING_IDLE_AFTER_MS;
    applyEffectiveRate(effectivePollingRate({
      configuredRate: configuredRateRef.current,
      hidden,
      idle,
    }));

    if (!hidden && !idle) {
      idleTimerRef.current = window.setTimeout(
        scheduleCurrentMode,
        Math.max(0, POLLING_IDLE_AFTER_MS - elapsed),
      );
    }
  }, [applyEffectiveRate]);

  useEffect(() => {
    effectiveRateRef.current = effectiveRate;
    if (!isConfiguredPollingRate(effectiveRate) || effectiveRate === configuredRateRef.current) return;
    configuredRateRef.current = effectiveRate;
    setConfiguredRateState(effectiveRate);
  }, [effectiveRate]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;

    const markActive = () => {
      const wasThrottled = effectiveRateRef.current !== configuredRateRef.current;
      lastActivityAtRef.current = Date.now();
      scheduleCurrentMode();
      if (wasThrottled) void refresh();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        scheduleCurrentMode();
        return;
      }
      lastActivityAtRef.current = Date.now();
      scheduleCurrentMode();
      void refresh();
    };
    const handleOnline = () => {
      lastActivityAtRef.current = Date.now();
      scheduleCurrentMode();
      void refresh();
    };

    document.addEventListener('pointerdown', markActive, { passive: true });
    document.addEventListener('keydown', markActive);
    document.addEventListener('focusin', markActive);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    scheduleCurrentMode();

    return () => {
      document.removeEventListener('pointerdown', markActive);
      document.removeEventListener('keydown', markActive);
      document.removeEventListener('focusin', markActive);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    };
  }, [refresh, scheduleCurrentMode]);

  const setConfiguredRate = useCallback<Dispatch<SetStateAction<string>>>((value) => {
    setConfiguredRateState((current) => {
      const requested = typeof value === 'function' ? value(current) : value;
      const nextRate = normalizeConfiguredPollingRate(requested, current);
      configuredRateRef.current = nextRate;
      const active = typeof document === 'undefined'
        || (document.visibilityState !== 'hidden'
          && Date.now() - lastActivityAtRef.current < POLLING_IDLE_AFTER_MS);
      if (active) applyEffectiveRate(nextRate);
      return nextRate;
    });
  }, [applyEffectiveRate]);

  return { refreshRate: configuredRate, setRefreshRate: setConfiguredRate };
}
