import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);

function replace(path, from, to) {
  const source = read(path);
  if (!source.includes(from)) throw new Error(`${path} 缺少待替换片段: ${from.slice(0, 80)}`);
  write(path, source.replace(from, to));
}

function replaceAll(path, from, to) {
  const source = read(path);
  if (!source.includes(from)) throw new Error(`${path} 缺少待替换片段: ${from.slice(0, 80)}`);
  write(path, source.replaceAll(from, to));
}

replace(
  'server/src/leaderboards.js',
  "function safeNonNegativeInteger(value) {\n  const normalized = Math.floor(Number(value) || 0);\n  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;\n}\n",
  "function safeNonNegativeInteger(value) {\n  const normalized = Math.floor(Number(value) || 0);\n  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;\n}\n\nfunction safeNonNegativeNumber(value) {\n  const normalized = Number(value);\n  return Number.isFinite(normalized) && normalized >= 0 ? normalized : 0;\n}\n",
);
replace(
  'server/src/leaderboards.js',
  '  player.stats.marketSellScore = safeNonNegativeInteger(player.stats.marketSellScore);',
  '  player.stats.marketSellScore = safeNonNegativeNumber(player.stats.marketSellScore);',
);
replace(
  'server/src/leaderboards.js',
  "function tradeGrossFor(fill) {\n  const quantity = safeNonNegativeInteger(fill?.quantity);\n  const price = safeNonNegativeInteger(fill?.price);\n  if (quantity < 1 || price < 1) return 0;\n  return quantity * price;\n}",
  "function tradeGrossFor(fill) {\n  const explicitTotal = Number(fill?.total);\n  if (Number.isFinite(explicitTotal) && explicitTotal >= 0) return explicitTotal;\n  const quantity = safeNonNegativeInteger(fill?.quantity);\n  const price = safeNonNegativeNumber(fill?.price);\n  if (quantity < 1 || price <= 0) return 0;\n  return quantity * price;\n}",
);
replace(
  'server/src/leaderboards.js',
  '    stats.marketSellScore = Math.max(0, stats.marketSellScore - safeNonNegativeInteger(trading?.score));',
  '    stats.marketSellScore = Math.max(0, stats.marketSellScore - safeNonNegativeNumber(trading?.score));',
);
replaceAll(
  'server/src/leaderboards.js',
  'score: safeNonNegativeInteger(trading.score)',
  'score: safeNonNegativeNumber(trading.score)',
);
replace(
  'server/src/leaderboards.js',
  "  return { title: '交易榜', description: '本周订单簿实际卖出成交额', unit: 'currency', rewarded: true };",
  "  return { title: '交易榜', description: '本周即时市场实际卖出成交额', unit: 'currency', rewarded: true };",
);

replace(
  'scripts/verify-leaderboards.mjs',
  "check(server.includes('return quantity * price;'), 'trading board must use the full actual fill value');",
  "check(server.includes('return explicitTotal;'), 'trading board must prefer the authoritative fill total');\ncheck(server.includes('const price = safeNonNegativeNumber(fill?.price);'), 'trading board fallback must preserve decimal prices');",
);
replace(
  'scripts/verify-leaderboards.mjs',
  "check(server.includes(\"description: '本周订单簿实际卖出成交额'\"), 'trading board copy must describe actual sell volume');",
  "check(server.includes(\"description: '本周即时市场实际卖出成交额'\"), 'trading board copy must describe immediate-market sell volume');",
);
replace(
  'scripts/verify-leaderboards.mjs',
  "check(productDesign.includes('撤单的未成交剩余数量不计入'), 'product design must exclude cancelled remainder');",
  "check(productDesign.includes('即时交易没有未成交挂单或撤单剩余量'), 'product design must record that player commodity trading has no unfilled remainder');",
);
replace(
  'scripts/verify-leaderboards.mjs',
  "check(productDesign.includes('实际卖出成交额'), 'product design must record gross sell volume');",
  "check(productDesign.includes('实际卖出成交额'), 'product design must record gross sell volume');\ncheck(productDesign.includes('即时卖出数量 × 当日官方系统价'), 'product design must bind commodity trading score to the daily official price');",
);

for (const path of [
  'scripts/codex-fix-immediate-trading-leaderboard.mjs',
  '.github/workflows/codex-fix-immediate-trading-leaderboard.yml',
]) {
  if (existsSync(path)) unlinkSync(path);
}

console.log('即时市场交易榜修正完成：成交总额保留小数官方价，兼容成交 fill 继续作为周榜审计来源。');
