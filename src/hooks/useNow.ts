import { useEffect, useState } from 'react';

export function useNow(referenceNow = Date.now(), intervalMs = 1_000) {
  const [now, setNow] = useState(referenceNow);

  useEffect(() => {
    const receivedAt = Date.now();
    const update = () => setNow(referenceNow + Math.max(0, Date.now() - receivedAt));
    update();
    const timer = window.setInterval(update, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, referenceNow]);

  return now;
}
