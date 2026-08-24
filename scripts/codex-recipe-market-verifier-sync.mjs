import fs from 'node:fs';

const path = 'scripts/verify-recipe-profit-analysis.mjs';
let source = fs.readFileSync(path, 'utf8');
function replace(before, after) {
  if (!source.includes(before)) throw new Error(`missing verifier anchor: ${before.slice(0, 180)}`);
  source = source.replace(before, after);
}
replace(
  "const marketPageSource = read('src/pages/MarketPage.tsx');\nconst contextSource",
  "const marketPageSource = read('src/pages/MarketPage.tsx');\nconst marketCommodityRowSource = read('src/components/market/MarketCommodityRow.tsx');\nconst contextSource",
);
replace(
  `for (const text of [\n  'const market = game.markets[product.id];',\n  ': selectedFacility ? game.facilityMarkets[selectedFacility.id] : undefined;',\n  'lastTradePrice: typeof market?.lastTradePrice === \\'number\\' ? market.lastTradePrice : undefined',\n  \"typeof entry.marketPrice === 'number'\",\n  '<CurrencyAmount>{formatCurrency(entry.marketPrice)}</CurrencyAmount>',\n]) assert.ok(marketPageSource.includes(text), \`市场资产列表缺少真实成交价字段: \${text}\`);`,
  `for (const text of [\n  'const market = game.markets[product.id];',\n  ': selectedFacility ? game.facilityMarkets[selectedFacility.id] : undefined;',\n  'lastTradePrice: typeof market?.lastTradePrice === \\'number\\' ? market.lastTradePrice : undefined',\n  \"const marketPrice = typeof market?.officialPrice === 'number' ? market.officialPrice : undefined;\",\n  'marketPrice={entry.marketPrice}',\n]) assert.ok(marketPageSource.includes(text), \`地区市场目录缺少官方价／真实成交边界: \${text}\`);\nfor (const text of [\n  \"typeof marketPrice === 'number'\",\n  '<CurrencyAmount>{formatCurrency(marketPrice)}</CurrencyAmount>',\n]) assert.ok(marketCommodityRowSource.includes(text), \`共享市场商品行缺少官方系统价展示: \${text}\`);`,
);
replace(
  "  marketDesignSource.includes('商品列表的市场价、基准偏离和 24h 变化以官方系统价 `officialPrice` 为准'),\n  '统一订单簿设计必须锁定商品市场价使用官方系统价',",
  "  marketDesignSource.includes('地区商品目录和商品全局详情的地区行使用该地区官方系统价 `officialPrice` 与真实 24h 成交变化'),\n  '统一订单簿设计必须锁定地区商品列表使用官方系统价',",
);
fs.writeFileSync(path, source);
console.log('Recipe-profit market verifier synchronized.');
