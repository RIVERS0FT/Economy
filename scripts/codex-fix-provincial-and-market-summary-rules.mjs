import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);
}

function replaceOnce(path, oldText, newText) {
  let source = read(path);
  if (!source.includes(oldText)) throw new Error(`${path}: missing replacement target`);
  source = source.replace(oldText, newText);
  write(path, source);
}

replaceOnce(
  'server/test/provinces.test.js',
  "  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);\n}\n\ntest('construction and production consume and output only the selected province inventory'",
  "  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);\n});\n\ntest('construction and production consume and output only the selected province inventory'",
);

replaceOnce(
  'scripts/verify-provincial-economy.mjs',
  "  'cannot match across states', 'world 30 geography replacement keeps legacy scoped assets on their existing region IDs',",
  "  'same commodity immediate trades use independent state daily prices and inventories', 'world 30 geography replacement keeps legacy scoped assets on their existing region IDs',",
);

const designPath = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
let design = read(designPath);
const performanceParagraph = '状态交付性能预算固定为：首次未压缩 JSON 响应必须不超过 2 MiB，状态读取 p95 不超过 800 ms，市场详情 p95 不超过 300 ms，事件循环 p99 不超过 200 ms。预算以真实构建与正式服务指标验证，不用牺牲权威完整性或匿名边界的方式达标。';
const compactRule = '普通商品市场状态摘要只允许携带玩家页面实际消费的当日 `officialPrice`、下次调价时间、当日买卖量、必要的轻量需求摘要与 24 小时成交摘要；不得复制服务器内部完整 `demand`、系统价格迁移诊断、旧 `cycleBuyQuantity`／`cycleSellQuantity` 别名、`priceHistory` 或零值公开盘口。商品盘口对玩家固定为空，只有独立市场详情接口负责返回有界成交历史与显式空盘口。';
if (!design.includes(compactRule)) {
  if (!design.includes(performanceParagraph)) throw new Error('server design performance paragraph not found');
  design = design.replace(performanceParagraph, `${performanceParagraph}\n\n${compactRule}`);
  write(designPath, design);
}

const verifierPath = 'scripts/verify-state-delivery-capacity.mjs';
let verifier = read(verifierPath);
const marketAnchor = "requireText('server/src/market-state-delivery.js', [\n  'createMarketSummaryStatesByProvince',";
const marketReplacement = "requireText('server/src/market-state-delivery.js', [\n  'createMarketSummaryStatesByProvince',\n  \"includeOrderBook: assetKind !== 'commodity'\",\n  'todayBuyQuantity',\n  'todaySellQuantity',\n  'demand: { lastQuantity: demandLastQuantity, satisfaction: demandSatisfaction },";
if (!verifier.includes(marketReplacement)) {
  if (!verifier.includes(marketAnchor)) throw new Error('market summary verifier anchor not found');
  verifier = verifier.replace(marketAnchor, marketReplacement);
}
const designAnchor = "  '事件循环 p99 不超过 200 ms',\n]);";
const designReplacement = "  '事件循环 p99 不超过 200 ms',\n  '普通商品市场状态摘要只允许携带玩家页面实际消费的当日 `officialPrice`',\n  '不得复制服务器内部完整 `demand`',\n  '只有独立市场详情接口负责返回有界成交历史与显式空盘口',\n]);";
if (!verifier.includes(designReplacement)) {
  if (!verifier.includes(designAnchor)) throw new Error('server design capacity verifier anchor not found');
  verifier = verifier.replace(designAnchor, designReplacement);
}
const sizeAnchor = "  'TWO_MIB',\n]);";
const sizeReplacement = "  'TWO_MIB',\n  \"serialized.includes('cycleBuyQuantity')\",\n  \"serialized.includes('baselineQuantity')\",\n]);";
if (!verifier.includes(sizeReplacement)) {
  if (!verifier.includes(sizeAnchor)) throw new Error('state size verifier anchor not found');
  verifier = verifier.replace(sizeAnchor, sizeReplacement);
}
write(verifierPath, verifier);

for (const path of [
  'scripts/codex-fix-provincial-and-market-summary-rules.mjs',
  '.github/workflows/codex-fix-provincial-and-market-summary-rules.yml',
]) {
  if (existsSync(path)) unlinkSync(path);
}
