import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, oldText, newText) {
  const source = readFileSync(path, 'utf8');
  if (source.includes(newText)) return;
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one source fragment, found ${count}`);
  writeFileSync(path, source.replace(oldText, newText), 'utf8');
}

replaceOnce(
  'docs/README.md',
  '16. 人口数量、工厂结构与活跃承载、迁入迁出、类别转换、劳动力就业、按实际人口计算的消费需求、三类人口六位小数真实钱包、私有 `fundingSlices`、五档消费状态与预算份额、聚合落单、虚拟商品预算赤字、两位小数三档需求曲线、跨周期成交率保留、证据置信度供需压力、无业务总量上限、库存与资金守恒的双边市场储备（可通过订单簿、固定采购合同与储备清仓拍卖跨市场调节）、生产链双向滞后价格传导和迁移清理属于产品、产业、订单簿与服务器权威规则；必须同步更新对应文档、测试和 `scripts/verify-staple-crops-demand.mjs`。',
  '16. 人口数量、工厂结构与活跃承载、迁入迁出、类别转换、劳动力就业、按实际人口计算的消费需求、州级居民经济只保存官方统计基准，不复制人口钱包、全局人口消费预算按当前经营州的 PCE 权重分摊并生成本地 `provinceId` 订单、三类人口六位小数真实钱包、私有 `fundingSlices`、五档消费状态与预算份额、聚合落单、虚拟商品预算赤字、两位小数三档需求曲线、跨周期成交率保留、证据置信度供需压力、无业务总量上限、库存与资金守恒的双边市场储备（可通过订单簿、固定采购合同与储备清仓拍卖跨市场调节）、生产链双向滞后价格传导和迁移清理属于产品、产业、订单簿与服务器权威规则；必须同步更新对应文档、测试和 `scripts/verify-staple-crops-demand.mjs`。',
);

replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '> 更新时间：2026-08-26',
  '> 更新时间：2026-08-27',
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '> 市场需求模型版本：19',
  '> 市场需求模型版本：20',
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '> 模型 18 迁移在世界加载事务内取消六种 C1 投入品的开放玩家订单、释放对应冻结资产、释放并重建人口与储备订单、重置当前价格传导锚点；真实历史成交和所有存量资产数量保持不变，迁移以旧模型版本判定并保持幂等。',
  '> 模型 20 在世界加载事务内释放模型 19 及更早人口消费订单的真实冻结资金并重建州级系统需求；市场储备通过既有重建流程归还冻结资金与库存，玩家订单、真实历史成交和所有存量资产数量保持不变。州级官方经济基准是随代码发布的只读快照，不在世界加载或需求热路径访问外部 API。',
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '- `domain.js`：唯一公共领域门面，其他服务器模块只从此导入公共能力；',
  '- `state-economic-baselines.js`：校验 `shared/us-state-economic-baselines.json` 与 48 州目录一一对应，提供 Census 2025-07-01 人口、BLS QCEW 2025-Q4 平均周薪和 BEA 2023 PCE 只读基准，并只对已有玩家经营入口的州生成 PCE 消费分配权重；运行时不得访问外部统计 API；\n- `domain.js`：唯一公共领域门面，其他服务器模块只从此导入公共能力；',
);

const verifierPath = 'scripts/verify-document-authority.mjs';
let verifier = readFileSync(verifierPath, 'utf8');
const requiredBaseline = "    '州级居民经济只保存官方统计基准，不复制人口钱包',\n";
if (!verifier.includes(requiredBaseline)) {
  const anchor = "    '人口数量、工厂承载、迁入迁出、就业收入、三类人口真实钱包、生产复杂度岗位结构',\n";
  if (!verifier.includes(anchor)) throw new Error('document-authority baseline insertion point missing');
  verifier = verifier.replace(anchor, anchor + requiredBaseline);
}
verifier = verifier.replace('市场需求模型 19、固定银行收益', '市场需求模型 20、固定银行收益');
writeFileSync(verifierPath, verifier, 'utf8');

replaceOnce(
  'server/src/domain.js',
  'marketFor: (world, productId, now) => balancedMarket.marketFor(world, productId, now),',
  'marketFor: (world, productId, now, provinceId) => balancedMarket.marketFor(world, productId, now, provinceId),',
);

console.log('Absorbed state economic baseline overlap into transport branch.');
