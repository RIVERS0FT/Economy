import { readFileSync, writeFileSync } from 'node:fs';

const path = 'docs/WAREHOUSE_EXPANSION_DESIGN.md';
let content = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');

const intentAnchor = '持久化键固定为 `provinceId:facilityTypeId`。缺少显式策略的既有或新工厂只读采用默认策略：';
const intentRule = '玩家可编辑的经营意图只按 `provinceId + facilityTypeId` 保存；商品维度策略只承担统一市场执行兼容，不是第二份经营意图。';
if (!content.includes(intentRule)) {
  if (!content.includes(intentAnchor)) throw new Error('warehouse intent anchor missing');
  content = content.replace(intentAnchor, `${intentRule}\n\n${intentAnchor}`);
}

const executionAnchor = '地区商品详情只读展示由工厂策略汇总后的自动采购／出售状态、生产预定、合同预定、预计数量和最终价格边界，不提供逐商品启停、目标库存或价格编辑表单。';
const executionRule = '商品详情中的自动经营执行区只读；玩家不得在这里覆盖工厂经营意图。';
if (!content.includes(executionRule)) {
  if (!content.includes(executionAnchor)) throw new Error('warehouse execution anchor missing');
  content = content.replace(executionAnchor, `${executionAnchor}\n\n${executionRule}`);
}

writeFileSync(path, content, 'utf8');
console.log('Prepared stable factory automatic-operation authority wording.');
