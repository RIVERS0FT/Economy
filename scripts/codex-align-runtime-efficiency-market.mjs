import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const marketDesignPath = 'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md';
let marketDesign = readFileSync(marketDesignPath, 'utf8').replace(/\r\n?/g, '\n');
const internalOrderParagraph = '内部人口／储备订单不是玩家商品交易入口，不决定玩家即时成交价，也不得要求玩家提交与其价格交叉的挂单。普通玩家页面不得展示内部订单所有者、需求角色、资金切片、订单 ID、可点击盘口或可用于填价的深度。内部订单字段只服务服务器模拟和审计；其具体预算、替代、互补和储备规则仍以 `PRODUCT_AND_GAMEPLAY_DESIGN.md` 的人口经济部分为权威。';
const replacementParagraph = `${internalOrderParagraph}\n\n服务器关闭订单历史裁剪只允许删除超过保留上限的已关闭历史记录；人口／储备仍处于 \`open\`／\`partial\` 的内部订单不得因历史保存上限被删除，避免真实冻结资金、预算和后续消费结算失去对应订单。具体索引构建、分组方式和裁剪阈值属于运行实现，由代码与专项测试锁定，不在本文复制实现算法。`;
if (!marketDesign.includes(internalOrderParagraph)) throw new Error('找不到内部订单边界段落');
if (!marketDesign.includes('关闭订单历史裁剪只允许删除')) {
  marketDesign = marketDesign.replace(internalOrderParagraph, replacementParagraph);
}
writeFileSync(marketDesignPath, marketDesign.endsWith('\n') ? marketDesign : `${marketDesign}\n`);

const verifierPath = 'scripts/verify-runtime-efficiency.mjs';
let verifier = readFileSync(verifierPath, 'utf8').replace(/\r\n?/g, '\n');
const oldMarketBlock = `requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', [\n  '统一混合盘口',\n  '先单次遍历未完成订单完成分组',\n  '不得因历史保存上限删除任何未完成订单',\n]);`;
const newMarketBlock = `requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', [\n  '内部人口／储备订单继续复用共享撮合内核',\n  '不得为了公开行情再次对完整 \\`world.orders\\` 做逐请求过滤排序',\n  '关闭订单历史裁剪只允许删除超过保留上限的已关闭历史记录',\n  '处于 \\`open\\`／\\`partial\\` 的内部订单不得因历史保存上限被删除',\n]);`;
if (!verifier.includes(oldMarketBlock)) throw new Error('找不到旧运行时效率市场设计断言');
verifier = verifier.replace(oldMarketBlock, newMarketBlock);
const oldWarehouseBlock = `requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', [\n  '仓库容量永久无限',\n  '商品买单、商品拍卖和采购合同不预占仓库空间',\n]);`;
const newWarehouseBlock = `requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', [\n  '仓库容量永久无限',\n  '商品即时买入、商品拍卖和采购合同不预占仓库空间',\n]);`;
if (!verifier.includes(oldWarehouseBlock)) throw new Error('找不到旧运行时效率仓库设计断言');
verifier = verifier.replace(oldWarehouseBlock, newWarehouseBlock);
verifier = verifier.replace('单一混合订单簿与合同线性索引', '内部订单运行时索引与合同线性索引');
writeFileSync(verifierPath, verifier.endsWith('\n') ? verifier : `${verifier}\n`);

for (const temp of [
  'scripts/codex-align-runtime-efficiency-market.mjs',
  '.github/workflows/codex-align-runtime-efficiency-market.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
