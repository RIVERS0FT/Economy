import type { ReactNode } from 'react';
import { useNow } from '../../hooks/useNow';
import { formatDuration } from '../../utils/formatters';

export function LiveServerTime({
  referenceNow,
  intervalMs = 1_000,
  children,
}: {
  referenceNow: number;
  intervalMs?: number;
  children: (now: number) => ReactNode;
}) {
  const now = useNow(referenceNow, intervalMs);
  return <>{children(now)}</>;
}

export function LiveDurationUntil({
  deadline,
  referenceNow,
  zeroText = '0s',
}: {
  deadline: number;
  referenceNow: number;
  zeroText?: ReactNode;
}) {
  return (
    <LiveServerTime referenceNow={referenceNow}>
      {(now) => {
        const remaining = Math.max(0, deadline - now);
        return remaining === 0 ? zeroText : formatDuration(remaining);
      }}
    </LiveServerTime>
  );
}
