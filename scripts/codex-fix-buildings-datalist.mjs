import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

function replaceOnce(path, oldText, newText, label) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`${label} not found in ${path}`);
  writeFileSync(path, source.replace(oldText, newText));
}

replaceOnce(
  'src/pages/BuildingsPage.tsx',
  `        ) : null}\n      <Button\n        block`,
  `        ) : null}\n      </DataList>\n      <Button\n        block`,
  'BuildingsPage build DataList tail',
);

replaceOnce(
  'src/api/game.ts',
  `import type { FacilityBuildProcurementGroup } from '../utils/facilityBuildProcurementGroups';\n`,
  '',
  'retired procurement group type import',
);
replaceOnce(
  'src/api/game.ts',
  `export interface FacilityBuildProcurementActionResult extends GameActionResult {\n  procurementGroup?: FacilityBuildProcurementGroup;\n}\nexport interface FacilityBuildProcurementActionResponse {\n  result: FacilityBuildProcurementActionResult;\n  revision: number;\n}`,
  `export type FacilityBuildProcurementActionResult = GameActionResult;\nexport type FacilityBuildProcurementActionResponse = GameActionResponse;`,
  'retired procurement group response shape',
);

replaceOnce(
  'src/pages/MarketPage.tsx',
  `  const selectedMarket = selectedProduct\n    ? game.markets[selectedProduct.id]\n    : selectedFacility ? game.facilityMarkets[selectedFacility.id] : undefined;`,
  `  const selectedProductMarket = selectedProduct ? game.markets[selectedProduct.id] : undefined;\n  const selectedFacilityMarket = selectedFacility ? game.facilityMarkets[selectedFacility.id] : undefined;\n  const selectedMarket = selectedProductMarket ?? selectedFacilityMarket;`,
  'MarketPage selected market union',
);
replaceOnce(
  'src/pages/MarketPage.tsx',
  `    selectedProduct ? selectedMarket?.officialPrice ?? '' : '',\n    selectedProduct ? selectedMarket?.nextPriceAt ?? '' : '',`,
  `    selectedProductMarket?.officialPrice ?? '',\n    selectedProductMarket?.nextPriceAt ?? '',`,
  'MarketPage product refresh token',
);
replaceOnce(
  'src/pages/MarketPage.tsx',
  `  const officialPrice = selectedProduct\n    ? detailedProductMarket?.officialPrice ?? selectedMarket?.officialPrice ?? selectedProduct.basePrice\n    : undefined;\n  const nextPriceAt = selectedProduct\n    ? detailedProductMarket?.nextPriceAt ?? selectedMarket?.nextPriceAt\n    : undefined;\n  const todayVolume = selectedProduct\n    ? Math.max(0, Number(selectedMarket?.todayBuyQuantity || 0)) + Math.max(0, Number(selectedMarket?.todaySellQuantity || 0))\n    : 0;`,
  `  const officialPrice = selectedProduct\n    ? detailedProductMarket?.officialPrice ?? selectedProductMarket?.officialPrice ?? selectedProduct.basePrice\n    : undefined;\n  const nextPriceAt = selectedProduct\n    ? detailedProductMarket?.nextPriceAt ?? selectedProductMarket?.nextPriceAt\n    : undefined;\n  const todayVolume = selectedProduct\n    ? Math.max(0, Number(selectedProductMarket?.todayBuyQuantity || 0)) + Math.max(0, Number(selectedProductMarket?.todaySellQuantity || 0))\n    : 0;`,
  'MarketPage product market fields',
);

for (const temp of [
  'scripts/codex-fix-buildings-datalist.mjs',
  '.github/workflows/codex-fix-buildings-datalist.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
