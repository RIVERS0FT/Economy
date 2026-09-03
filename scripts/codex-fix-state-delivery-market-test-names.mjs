import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/verify-state-delivery-capacity.mjs';
let source = readFileSync(path, 'utf8');
source = source.replace(
  'initial player state keeps market summaries and only the current player orders',
  'initial player state keeps market summaries and only the current player legacy orders',
).replace(
  'market detail returns bounded public real-trade history, aggregated five-level depth, and a conditional revision',
  'commodity market detail returns bounded public real-trade history, empty public depth, and a conditional revision',
);
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of ['scripts/codex-fix-state-delivery-market-test-names.mjs', '.github/workflows/codex-fix-state-delivery-market-test-names.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
