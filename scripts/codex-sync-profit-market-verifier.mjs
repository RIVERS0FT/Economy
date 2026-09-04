import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/verify-recipe-profit-analysis.mjs';
const source = readFileSync(path, 'utf8');
const oldText = "  ': selectedFacility ? game.facilityMarkets[selectedFacility.id] : undefined;',";
const newText = [
  "  'const selectedProductMarket = selectedProduct ? game.markets[selectedProduct.id] : undefined;',",
  "  'const selectedFacilityMarket = selectedFacility ? game.facilityMarkets[selectedFacility.id] : undefined;',",
  "  'const selectedMarket = selectedProductMarket ?? selectedFacilityMarket;',",
].join('\n');
if (!source.includes(oldText)) throw new Error('stale MarketPage union verifier token not found');
writeFileSync(path, source.replace(oldText, newText));

for (const temp of [
  'scripts/codex-sync-profit-market-verifier.mjs',
  '.github/workflows/codex-sync-profit-market-verifier.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
