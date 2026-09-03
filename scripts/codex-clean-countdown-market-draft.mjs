import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md';
let source = readFileSync(path, 'utf8');
const oldText = '- 市场下单的价格与数量草稿必须留在 `MarketOrderEntry` 局部状态；根 `GameViewModel` 的 `orderPrice`／`orderQuantity` 只负责首次进入市场、重新进入市场、主动切换资产或主动切换方向时提供初始化种子。正常键入、步进按钮、快捷数量和订单簿点击填价不得更新根模型或触发 `GameApp`、状态栏及市场页其他静态区域的 React 提交。';
const newText = '- 商品即时交易只保留方向与数量草稿：数量必须留在 `MarketImmediateTradeEntry` 局部状态，成交价格只读取当前州×商品当日服务器 `officialPrice`，不得存在玩家价格草稿或订单簿点击填价。正常键入数量、步进按钮和快捷数量不得更新根模型或触发 `GameApp`、状态栏及市场页其他静态区域的 React 提交；资产或方向切换只允许重置局部数量草稿。';
if (!source.includes(oldText)) throw new Error('找不到倒计时设计中的旧市场草稿规则');
source = source.replace(oldText, newText);
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of ['scripts/codex-clean-countdown-market-draft.mjs', '.github/workflows/codex-clean-countdown-market-draft.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
