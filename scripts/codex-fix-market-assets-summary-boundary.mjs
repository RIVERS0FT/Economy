import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/verify-market-assets.mjs';
let source = readFileSync(path, 'utf8');
const oldText = `  "assetKind === 'commodity' ? [] : publicDepth(getOrderBookDepth",\n  "assetKind === 'commodity'\\n      ? EMPTY_PUBLIC_ORDER_BOOK",\n]) requireText('server/src/market-state-delivery.js', text);`;
const newText = `  "assetKind === 'commodity' ? [] : publicDepth(getOrderBookDepth",\n  'includeOrderBook = true',\n  "includeOrderBook: assetKind !== 'commodity'",\n  "const bids = assetKind === 'commodity' ? [] : publicDepth",\n  "const asks = assetKind === 'commodity' ? [] : publicDepth",\n]) requireText('server/src/market-state-delivery.js', text);`;
if (!source.includes(oldText)) throw new Error('market assets legacy summary assertion not found');
source = source.replace(oldText, newText);
writeFileSync(path, source);
for (const temp of [
  'scripts/codex-fix-market-assets-summary-boundary.mjs',
  '.github/workflows/codex-fix-market-assets-summary-boundary.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
