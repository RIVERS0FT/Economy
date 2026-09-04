import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/codex-fix-daily-market-consistency.mjs';
let source = readFileSync(path, 'utf8');

const staleMachinery = `replaceOnce(\n  'tests/browser/runtime-harness.tsx',\n  '        lastPrice: 76,\\n        lastTradePrice: 76.25,',\n  '        lastPrice: 76,\\n        officialPrice: 76.25,\\n        lastTradePrice: 76.25,',\n  'machinery official-price fixture',\n);`;
const currentMachinery = `replaceOnce(\n  'tests/browser/runtime-harness.tsx',\n  \`      markets.machinery = {\\n        ...markets.machinery,\\n        lastTradePrice: 76.25,\\n      };\`,\n  \`      markets.machinery = {\\n        ...markets.machinery,\\n        officialPrice: 76.25,\\n        lastTradePrice: 76.25,\\n      };\`,\n  'machinery official-price fixture',\n);`;
if (!source.includes(staleMachinery)) throw new Error('stale machinery consistency replacement not found');
source = source.replace(staleMachinery, currentMachinery);

const alreadyAppliedRouteReplacement = `replaceOnce(\n  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',\n  '同一输出商品的生产路线份额同时读取单位生产成本和各输入公开卖单覆盖率；理论便宜但无法获得原料的路线不得主导派生需求。',\n  '同一输出商品的生产路线份额同时读取单位生产成本和各输入内部可执行供给覆盖率；覆盖率只来自同州最近 30 分钟真实玩家向官方系统完成的卖出数量，理论便宜但没有真实供给证据的路线不得主导派生需求。',\n  'industry route supply coverage',\n);\n`;
if (!source.includes(alreadyAppliedRouteReplacement)) throw new Error('route consistency replacement block not found');
source = source.replace(alreadyAppliedRouteReplacement, '');

writeFileSync(path, source);
if (existsSync('scripts/codex-fix-consistency-fixture.mjs')) unlinkSync('scripts/codex-fix-consistency-fixture.mjs');
