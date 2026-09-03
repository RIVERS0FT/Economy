import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/verify-authoritative-hotpaths.mjs';
let source = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
const oldBlock = `const orderBookDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');\nfor (const text of ['同价时间优先规则', '客户端订单索引只是查询加速器']) {\n  assert.ok(orderBookDesign.includes(text), \`订单簿设计缺少热路径边界: \${text}\`);\n}`;
const newBlock = `const orderBookDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');\nfor (const text of [\n  '内部人口／储备订单继续复用共享撮合内核',\n  '价格档位 FIFO 状态机',\n  '玩家即时商品交易不得经过该共享撮合内核',\n  '具体索引构建、分组方式和裁剪阈值属于运行实现，由代码与专项测试锁定',\n]) {\n  assert.ok(orderBookDesign.includes(text), \`即时市场设计缺少内部热路径边界: \${text}\`);\n}`;
if (!source.includes(oldBlock)) throw new Error('找不到旧订单簿设计热路径断言');
source = source.replace(oldBlock, newBlock);
source = source.replace('统一订单簿与六分区客户端权威状态均受防回退约束', '内部订单运行时索引与六分区客户端权威状态均受防回退约束');
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of [
  'scripts/codex-align-authoritative-hotpaths-market.mjs',
  '.github/workflows/codex-align-authoritative-hotpaths-market.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
