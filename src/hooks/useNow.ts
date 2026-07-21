import { useEffect, useState } from 'react';
import { estimateServerNow, subscribeServerClock } from '../utils/serverClock.js';

export function useNow(referenceNow = Date.now(), intervalMs = 1_000) {
  const [now, setNow] = useState(() => estimateServerNow(referenceNow));

  useEffect(() => {
    const update = () => setNow((current) => Math.max(current, estimateServerNow(referenceNow)));
    update();
    const unsubscribe = subscribeServerClock(update);
    const timer = window.setInterval(update, intervalMs);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [intervalMs, referenceNow]);

  return now;
}
