import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const encoded = [0, 1, 2, 3]
  .map((index) => readFileSync(`.agent/chunk-${String(index).padStart(2, '0')}.txt`, 'utf8').trim())
  .join('');
let source = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
source = source.replace("import { parseMoneyDraft } from './moneyDraft';\n\n", '');
source = source.replace(
  '  const normalized = parseMoneyDraft(String(value)) ?? 0;',
  "  const scaled = value * 100;\n  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;\n  const normalized = Number.isFinite(value) ? Math.floor(scaled + tolerance) / 100 : 0;",
);
source = source.replace(
  "return seconds > 0 ? \\`\\${minutes}m \\${seconds}s\\` : \\`\\${minutes}m\\`;",
  "return seconds > 0 ? \\`\\${minutes}m \\${seconds.toString().padStart(2, '0')}s\\` : \\`\\${minutes}m\\`;",
);
const auctionAnchor = `replace('src/pages/AuctionPage.tsx',
  "min={1}\\n             max={1_000_000_000}\\n             error={parsedStartingBid === null ? '请输入 1～1000000000 的整数。' : undefined}",
  "min={0.01}\\n             max={1_000_000_000}\\n             error={parsedStartingBid === null ? '请输入不低于 0.01 的金额；超过两位小数会向下截断。' : undefined}");`;
const auctionReplacement = `replaceRegex('src/pages/AuctionPage.tsx',
  /min=\\{1\\}\\n(\\s+)max=\\{1_000_000_000\\}\\n\\1error=\\{parsedStartingBid === null \\? '请输入 1～1000000000 的整数。' : undefined\\}/,
  "min={0.01}\\n$1max={1_000_000_000}\\n$1error={parsedStartingBid === null ? '请输入不低于 0.01 的金额；超过两位小数会向下截断。' : undefined}");`;
if (!source.includes(auctionAnchor)) throw new Error('Auction patch anchor missing from generated source');
source = source.replace(auctionAnchor, auctionReplacement);
const cleanupAnchor = '// Remove temporary workflow and patch source from the resulting commit.';
const metadataCleanup = [
  "replaceAll('README.md', '客户端状态版本：`19`', '客户端状态版本：`20`');",
  "replaceAll('README.md', '世界状态版本：`16`', '世界状态版本：`17`');",
  "replaceAll('README.md', '市场需求模型版本：`10`', '市场需求模型版本：`11`');",
  "replaceAll('README.md', '市场需求模型 10', '市场需求模型 11');",
  "replaceAll('README.md', '模型 10', '模型 11');",
  "replaceAll('src/utils/defaultOrderPrice.ts', 'Number.isFinite(price) && Number.isInteger(price) && price >= 1', 'Number.isFinite(price) && price >= 0.01 && Math.abs(price * 100 - Math.round(price * 100)) < 1e-8');",
  "replaceAll('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '市场需求模型版本：10', '市场需求模型版本：11');",
  "replaceAll('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '模型 10', '模型 11');",
  "replaceAll('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '市场需求模型版本：10', '市场需求模型版本：11');",
  "replaceAll('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '模型 10', '模型 11');",
  "replaceAll('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '当前客户端只接受版本 19', '当前客户端只接受版本 20');",
  "replaceAll('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '世界版本 16', '世界版本 17');",
  "replaceAll('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '客户端状态版本 19', '客户端状态版本 20');",
  "replaceAll('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '人口经济内部版本固定为 4', '人口经济内部版本固定为 5');",
  "replaceAll('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '市场需求模型 10', '市场需求模型 11');",
  "replaceAll('scripts/verify-banking.mjs', '世界版本 16', '世界版本 17');",
  "replaceAll('scripts/verify-banking.mjs', '客户端状态版本 19', '客户端状态版本 20');",
  "replaceAll('scripts/verify-banking.mjs', 'version: 19', 'version: 20');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', 'MARKET_DEMAND_MODEL_VERSION, 10', 'MARKET_DEMAND_MODEL_VERSION, 11');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', 'MARKET_DEMAND_MODEL_VERSION = 10', 'MARKET_DEMAND_MODEL_VERSION = 11');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', 'POPULATION_ECONOMY_VERSION = 4', 'POPULATION_ECONOMY_VERSION = 5');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', 'world.version = 16', 'world.version = 17');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', '市场需求模型版本：`10`', '市场需求模型版本：`11`');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', '市场需求模型版本：10', '市场需求模型版本：11');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', '人口经济内部版本固定为 4', '人口经济内部版本固定为 5');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', '市场需求模型 10', '市场需求模型 11');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', '模型 10 使用真实人口钱包', '模型 11 使用真实人口钱包');",
  "replaceAll('scripts/verify-market-assets.mjs', 'world.version = 16', 'world.version = 17');",
  "replaceAll('scripts/verify-market-assets.mjs', 'Number.isFinite(price) && Number.isInteger(price) && price >= 1', 'Number.isFinite(price) && price >= 0.01 && Math.abs(price * 100 - Math.round(price * 100)) < 1e-8');",
  "replaceAll('scripts/verify-document-authority.mjs', \"'世界状态版本：`16`'\", \"'世界状态版本：`17`'\");",
  "replaceAll('scripts/verify-document-authority.mjs', \"'市场需求模型版本：`10`'\", \"'市场需求模型版本：`11`'\");",
  "replaceAll('scripts/verify-document-authority.mjs', \"content.includes('世界状态版本：16')\", \"content.includes('世界状态版本：17')\");",
  "replaceAll('scripts/verify-document-authority.mjs', '世界状态版本必须为 16', '世界状态版本必须为 17');",
  "replaceAll('scripts/verify-document-authority.mjs', '/16、市场需求模型 10', '/17、市场需求模型 11');",
  "for (const relative of walk('docs', (name) => name.endsWith('.md'))) {",
  "  replaceRegex(relative, /^(> (?:客户端状态版本|世界状态版本|市场需求模型版本)：(?:20|17|11))[ \\t]+$/gm, '$1', { required: false });",
  "}",
  "",
].join('\n');
if (!source.includes(cleanupAnchor)) throw new Error('Cleanup anchor missing from generated source');
source = source.replace(cleanupAnchor, `${metadataCleanup}\n${cleanupAnchor}`);
const generated = '.agent/generated-money-patch.mjs';
writeFileSync(generated, source);
await import(pathToFileURL(generated).href);
