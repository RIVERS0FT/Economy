import { useEffect, useMemo, useReducer } from 'react';
import type { EconomyState, ProvinceDefinition } from '../types';
import { estimateServerNow, subscribeServerClock } from '../utils/serverClock.js';
import { transportCycleDurationMs, transportTraversalStopIds } from '../utils/provinceLogistics';
import type { TransportPlanningRoute } from './transportPlanning.js';

/** Forecasts update for authoritative inputs and quote boundaries, not countdown ticks. */
export function useTransportForecastNow(
  game: EconomyState,
  routes: readonly TransportPlanningRoute[],
  provinceById: Map<string, ProvinceDefinition>,
) {
  const [generation, advance] = useReducer((value: number) => value + 1, 0);
  const now = useMemo(() => estimateServerNow(game.lastProcessedAt), [game, routes, generation]);
  useEffect(() => {
    const current = estimateServerNow(game.lastProcessedAt);
    let next = Number.POSITIVE_INFINITY;
    for (const route of routes) {
      const duration = transportCycleDurationMs(route, route.mode, provinceById);
      for (const provinceId of new Set(transportTraversalStopIds(route))) {
        const markets = game.provinceMarkets?.[provinceId]
          ?? (provinceId === game.defaultProvinceId ? game.markets : {});
        for (const market of Object.values(markets ?? {})) {
          const boundary = Number(market.nextPriceAt);
          for (const candidate of [boundary - duration, boundary]) {
            if (Number.isFinite(candidate) && candidate > current) next = Math.min(next, candidate);
          }
        }
      }
    }
    const timer = Number.isFinite(next)
      ? window.setTimeout(advance, Math.min(2_147_483_647, Math.max(1, next - current + 1))) : null;
    const unsubscribe = subscribeServerClock(advance);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [game, routes, provinceById, generation]);
  return now;
}
