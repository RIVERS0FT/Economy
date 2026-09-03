import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const verifierPath = 'scripts/verify-production-settlement-layout.mjs';
let verifier = readFileSync(verifierPath, 'utf8');
const oldVerifier = "  '数量和价格继续按统一市场资产切换的订单草稿初始化规则处理',\n  '不得自动提交订单',";
const newVerifier = "  '进入商品详情后即时交易数量重置为 `1`',\n  '成交价格只读取服务器当日 `officialPrice`',\n  '不得由生产配方或来源页面预填自定义价格',\n  '不得自动提交交易',";
if (!verifier.includes(oldVerifier)) throw new Error('找不到生产结算旧市场草稿断言');
verifier = verifier.replace(oldVerifier, newVerifier);
writeFileSync(verifierPath, verifier.endsWith('\n') ? verifier : `${verifier}\n`);

const uiPath = 'docs/UI_DESIGN_SYSTEM.md';
let ui = readFileSync(uiPath, 'utf8');
const oldUi = '不得根据生产配方语义自动推断采购／出售方向，数量和价格继续按统一市场资产切换的订单草稿初始化规则处理，不得自动提交订单，也不得改写建筑页建设工厂类型、数量、配方、作业制度或任何服务器权威生产状态。';
const newUi = '不得根据生产配方语义自动推断采购／出售方向；进入商品详情后的即时交易数量初始化为 `1`，成交价格只读取服务器当日 `officialPrice`，生产页不得预填自定义价格或自动提交交易，也不得改写建筑页建设工厂类型、数量、配方、作业制度或任何服务器权威生产状态。具体交易语义仍以页面与商品市场权威 DESIGN 为准。';
if (ui.includes(oldUi)) {
  ui = ui.replace(oldUi, newUi);
  writeFileSync(uiPath, ui.endsWith('\n') ? ui : `${ui}\n`);
}

for (const temp of ['scripts/codex-fix-production-navigation-market-wording.mjs', '.github/workflows/codex-fix-production-navigation-market-wording.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
