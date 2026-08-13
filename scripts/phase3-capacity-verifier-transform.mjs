import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/verify-state-delivery-capacity.mjs';
let source = readFileSync(path, 'utf8');

function replaceOnce(from, to) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`missing exact fragment: ${from.slice(0, 120)}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error('duplicate exact fragment');
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

replaceOnce(
`requireText('src/hooks/useNow.ts', [
  'estimateServerNow(referenceNow)',
  'subscribeServerClock(update)',
  'Math.max(current, estimateServerNow(referenceNow))',
]);`,
`requireText('src/hooks/useNow.ts', [
  'estimateServerNow(referenceNow)',
  'const sharedTickers = new Map',
  'subscribeServerClock(() => signalTicker(ticker))',
  'useSyncExternalStore',
  'window.setInterval(() => signalTicker(ticker), interval)',
]);`,
);

replaceOnce(
`requireText('src/pages/OverviewPage.tsx', [
  "isWorking ? '处理中…'",
  'disabled={isWorking || workRemaining > 0}',
]);`,
`requireText('src/pages/OverviewPage.tsx', [
  '<OverviewWorkButton',
  'referenceNow={game.lastProcessedAt}',
  'cooldownUntil={game.work.cooldownUntil}',
]);
requireText('src/pages/overview/OverviewLiveSections.tsx', [
  "isWorking ? '处理中…'",
  'disabled={isWorking || remaining > 0}',
  '<LiveServerTime referenceNow={referenceNow}>',
]);`,
);

writeFileSync(path, source);
console.log('State delivery capacity verifier migrated to shared leaf clock.');
