import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/verify-market-chart.mjs';
let source = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
const pattern = /for \(const text of \['保存吃单方（taker／incoming order）的买卖方向', '净主动量为主动买入量减主动卖出量', '禁止伪造迁移方向'\]\) \{\n  assert\.ok\(orderBookDesign\.includes\(text\), `订单簿设计文档缺少: \$\{text\}`\);\n\}/;
if (!pattern.test(source)) throw new Error('找不到市场图表旧订单簿设计断言');
source = source.replace(pattern, `for (const text of [
  '真实玩家即时交易继续写入商品真实成交历史',
  '内部人口／储备订单继续复用共享撮合内核',
  '零成交调价记录不得伪造真实玩家成交量',
]) {
  assert.ok(orderBookDesign.includes(text), \`即时市场设计文档缺少: \${text}\`);
}`);
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of [
  'scripts/codex-align-market-chart-authority.mjs',
  '.github/workflows/codex-align-market-chart-authority.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
