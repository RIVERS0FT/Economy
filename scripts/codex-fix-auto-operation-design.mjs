import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'docs/WAREHOUSE_EXPANSION_DESIGN.md';
const source = readFileSync(path, 'utf8');
let text = source;

function replace(from, to) {
  if (!text.includes(from)) throw new Error(`缺少待替换自动经营设计片段: ${from.slice(0, 90)}`);
  text = text.replace(from, to);
}

function insertAfter(anchor, addition) {
  if (!text.includes(anchor)) throw new Error(`缺少自动经营设计插入锚点: ${anchor.slice(0, 90)}`);
  if (text.includes(addition.trim())) return;
  text = text.replace(anchor, `${anchor}\n\n${addition.trim()}`);
}

replace(
  '- “一键购齐并建造”中的 FOK 商品成交同样不检查仓库空间；采购与建设保持同一原子事务。',
  '- “一键购齐并建造”按建造州各缺失材料的当日 `officialPrice` 即时购齐，同样不检查仓库空间；采购与建设保持同一原子事务，不创建 FOK 或开放商品买单。',
);
replace(
  '- 玩家在工厂详情表达自动经营意图；商品仍是统一订单簿的唯一自动买卖执行单位。不得为每座工厂建立独立商品订单簿、独立库存、独立资金池或第二套成交系统。自动经营的商品级执行继续由服务器派生并进入统一订单簿，但地区商品详情不再渲染“自动经营执行”卡或逐商品执行摘要。',
  '- 玩家在工厂详情表达自动经营意图；工厂详情是自动经营策略与执行解释的唯一玩家界面。不得为每座工厂建立独立商品市场、独立库存、独立资金池或第二套成交系统。自动经营的商品级执行由服务器派生并按当日 `officialPrice` 即时成交，不创建玩家开放订单；地区商品详情不再渲染“自动经营执行”卡或逐商品执行摘要。',
);
replace(
  '- 自动经营中的生产预定、合同可用保留和额外原料保障只用于计算自动买卖目标，不是新的资产冻结；自动买单真实冻结资金，自动卖单真实冻结商品。',
  '- 自动经营中的生产预定、合同可用保留和额外原料保障只用于计算自动买卖目标，不是新的资产冻结；达到阈值后即时采购直接扣除成交资金，即时出售直接扣除成交库存，完成后不留下自动买单、自动卖单或托管冻结。',
);

insertAfter(
  '玩家可编辑的自动经营策略只按 `provinceId + facilityTypeId` 保存，字段继续为启用状态、原料保障周期、经营模式和产成品处理。商品维度的采购上限、出售下限、目标自由库存和最低自由库存均由服务器从工厂策略、当前配方与生产参与数量派生；客户端提交的兼容价格字段不构成权威价格。',
  '正式策略结构继续包含 `inputCoverageCycles: 1 | 2 | 3 | 5`。新建或缺失策略的默认玩家语义固定为“自动经营 = 开启”“原料保障 = 2 个生产周期”、经营模式 `balanced`、产成品处理 `surplus`；默认值只在需要持久化正式策略时写入，纯读取不得推进 revision。',
);
insertAfter(
  '自动经营执行不保存 managed-order ID，也不创建玩家商品开放订单。生产预定、合同可用保留和额外原料保障只是目标数量计算量，不形成新的资产冻结。即时采购只在当日 `officialPrice` 不高于派生采购上限时发生；即时出售只在当日 `officialPrice` 不低于派生出售下限时发生。',
  '同一商品被多个工厂消费时采用最高采购上限；任一自动经营生产者对某商品选择 `keep` 全部保留，该商品不得自动出售。双向策略合法性固定为出售价格下限必须严格高于采购价格上限，避免同一策略在相同官方价上同时触发两侧。',
);
replace(
  '读取默认策略不得写回存档或推进 revision。离线期间不新增后台自动交易循环；在线客户端只负责在相关权威状态变化后触发一次服务器重新校验，最终数量、阈值、资金、库存和成交价均由服务器决定。',
  '读取默认策略不得写回存档或推进 revision。离线期间不新增后台自动交易循环；在线客户端只负责在相关权威状态变化后触发一次服务器重新校验，最终数量、阈值、资金、库存和成交价均由服务器决定，不改成服务器后台常驻扫描任务。旧 `onlineAutoBuyPolicies`、`onlineAutoSellPolicies` 仅作为迁移输入读取，迁移后权威玩家策略统一收口到工厂自动经营结构，不得恢复逐商品托管挂单策略。',
);

writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`);
for (const temp of [
  'scripts/codex-fix-auto-operation-design.mjs',
  '.github/workflows/codex-fix-auto-operation-design.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
console.log('自动经营设计已收口到工厂策略 + 当日官方价即时交易，并保留既有策略/迁移防回退边界。');
