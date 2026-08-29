import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content.replace(/\r\n?/g, '\n'), 'utf8');
}

function replaceRequired(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`${label}: source text not found`);
  return content.replace(from, to);
}

function replaceRegexRequired(content, pattern, to, label) {
  if (!pattern.test(content)) throw new Error(`${label}: source pattern not found`);
  pattern.lastIndex = 0;
  return content.replace(pattern, to);
}

{
  const path = 'docs/WAREHOUSE_EXPANSION_DESIGN.md';
  let content = read(path);
  content = replaceRequired(
    content,
    '`scripts/verify-warehouse-expansion.mjs`、`scripts/verify-online-auto-sell.mjs` 与 `scripts/verify-factory-auto-operation.mjs` 必须共同保证：',
    '`scripts/verify-warehouse-expansion.mjs` 与 `scripts/verify-online-auto-sell.mjs` 必须共同保证：',
    'warehouse verifier ownership',
  );
  write(path, content);
}

{
  const path = 'docs/README.md';
  let content = read(path);
  content = replaceRequired(
    content,
    '| `WAREHOUSE_EXPANSION_DESIGN.md` | 州级本地无限仓库、真实商品库存、容量机制退役、州页仓库分区、地区商品详情在线自动采购／自动出售、移动自动交易抽屉与仓库商品网格密度，以及跨州运输模式、费用、在途资产与持久化运输路线 |',
    '| `WAREHOUSE_EXPANSION_DESIGN.md` | 州级本地无限仓库、真实商品库存、容量机制退役、州页仓库分区、地区工厂自动经营策略、地区商品详情只读自动经营执行、统一商品订单维护、仓库商品网格密度，以及跨州运输模式、费用、在途资产与持久化运输路线 |',
    'README warehouse authority row',
  );
  content = replaceRequired(
    content,
    '32. 仓库与市场自动交易商品卡结构、网格密度唯一归属 `WAREHOUSE_EXPANSION_DESIGN.md`；默认五列，小于 560px 为四列，760px 起六列、960px 起七列，并通过 `scripts/verify-warehouse-expansion.mjs` 防回退。页面职责与通用 UI 文档只能引用该规则，不得维护另一套断点。',
    '32. 仓库商品卡结构、网格密度、地区工厂自动经营控件和地区商品只读执行卡唯一归属 `WAREHOUSE_EXPANSION_DESIGN.md`；仓库默认五列，小于 560px 为四列，760px 起六列、960px 起七列，并通过 `scripts/verify-warehouse-expansion.mjs` 与 `scripts/verify-online-auto-sell.mjs` 防回退。页面职责与通用 UI 文档只能引用该规则，不得恢复商品级自动交易编辑或维护另一套断点。',
    'README warehouse rule 32',
  );
  content = replaceRequired(
    content,
    '49. 州级仓库容量永久无限，商品买单、拍卖、采购合同与生产不得恢复仓库容量预占或空间拒绝；仓库分区只显示本州真实可用／冻结库存与无限容量状态。跨州运输路线、发运和运输记录唯一归属独立运输页，不得重新塞回仓库卡片。上述边界必须同步 `WAREHOUSE_EXPANSION_DESIGN.md`、`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`、`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` 和 `scripts/verify-warehouse-expansion.mjs`。',
    '49. 州级仓库容量永久无限，商品买单、拍卖、采购合同与生产不得恢复仓库容量预占或空间拒绝；仓库分区只显示本州真实可用／冻结库存，不把“无限容量”作为玩家可见状态。玩家可编辑自动经营策略唯一归属地区工厂详情，地区商品详情只读显示汇总后的自动采购／出售执行；商品执行继续复用统一订单簿和真实冻结资产。跨州运输路线、发运和运输记录唯一归属独立运输页，不得重新塞回仓库卡片。上述边界必须同步 `WAREHOUSE_EXPANSION_DESIGN.md`、`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`、`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`、`scripts/verify-warehouse-expansion.mjs` 和 `scripts/verify-online-auto-sell.mjs`。',
    'README warehouse rule 49',
  );
  write(path, content);
}

{
  const path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
  let content = read(path);
  content = content.replace('> 更新时间：2026-08-28', '> 更新时间：2026-08-29');
  content = replaceRequired(
    content,
    '| 市场 | `market` | `GlobalMarketPage` | 全部已解锁州的商品目录、商品跨州行情详情与地区商品交易钻取；实际盘口、下单和自动交易继续由地区 `MarketPage` 执行 |',
    '| 市场 | `market` | `GlobalMarketPage` | 全部已解锁州的商品目录、商品跨州行情详情与地区商品交易钻取；实际盘口、下单和自动经营只读执行状态继续由地区 `MarketPage` 执行，可编辑自动经营策略归地区 `BuildingsPage` 工厂详情 |',
    'page market responsibility row',
  );
  content = replaceRequired(
    content,
    '未解锁时必须为只读，隐藏或禁用下单、自动交易、撤单等市场写入口。',
    '未解锁时必须为只读，隐藏或禁用下单、撤单等市场写入口；自动经营执行状态可以继续只读显示。',
    'locked market writes',
  );
  content = replaceRequired(content, '工厂详情、研发详情与市场自动交易设置继续使用 `MobileWorkspaceDetailSheet` API', '工厂详情与研发详情继续使用 `MobileWorkspaceDetailSheet` API', 'page mobile detail ownership');
  content = replaceRequired(content, '打开工厂／研发／自动交易详情时', '打开工厂／研发详情时', 'page mobile detail open');
  content = replaceRequired(content, '任何业务页、工厂详情、研发详情或自动交易设置都不得创建嵌套 `.mobile-detail-sheet`', '任何业务页、工厂详情或研发详情都不得创建嵌套 `.mobile-detail-sheet`', 'page mobile nested detail');
  content = replaceRequired(
    content,
    '地区商品自动交易详情固定当前商品，继续复用采购／出售页签和既有仓库表单信息层级，不显示全商品选择器；原子保存动作仍放在唯一 Host 的固定底栏。',
    '地区商品详情的自动经营执行卡固定当前商品，只读显示采购／出售执行状态、预计数量和价格边界，不创建采购／出售策略页签、策略草稿、固定保存底栏或第二层详情 Sheet。',
    'page product execution mobile rule',
  );
  content = content.replaceAll('商品行情、在线自动交易策略', '商品行情、自动经营执行状态');
  content = content.replaceAll('在线自动采购／自动出售设置', '自动经营执行状态');
  content = replaceRequired(
    content,
    '建筑页不得渲染仓库库存卡或自动交易设置。',
    '建筑页不得渲染仓库库存卡或商品级自动交易设置；地区工厂详情必须在生产配置附近承载本工厂的自动经营策略。',
    'building automatic operation ownership',
  );
  content = replaceRegexRequired(
    content,
    /仓库库存唯一显示在隐藏州级上下文页的“仓库”分区；[\s\S]*?具体规则以 `WAREHOUSE_EXPANSION_DESIGN\.md`。/,
    '仓库库存唯一显示在隐藏州级上下文页的“仓库”分区；仓库正文直接排列本州真实可用／冻结商品，不显示“共享仓库”“无限容量”“仓库内容”或“实物库存”汇总，不承载自动经营策略或跨州运输。玩家可编辑自动经营策略唯一归属地区工厂详情；地区商品详情只读展示按当前州全部工厂策略、生产配置和合同保留汇总后的自动采购／出售执行状态。跨州运输路线、发运与运输记录唯一归属独立 `TransportPage`。具体规则以 `WAREHOUSE_EXPANSION_DESIGN.md` 为准。',
    'warehouse and automatic operation page ownership',
  );
  content = replaceRegexRequired(
    content,
    /教程固定为九步：建设工厂、启动工厂、完成生产、设置商品自动出售、完成一次自动出售、开始一项产业科技研发、查看合同、完成一次银行存款、查看排行榜。前五步建立“生产—在线自动出售”基础循环，/,
    '教程固定为九步：建设工厂、启动工厂、完成生产、设置工厂自动经营、完成一次自动出售、开始一项产业科技研发、查看合同、完成一次银行存款、查看排行榜。前五步建立“生产—工厂经营意图—统一商品自动出售”基础循环，',
    'tutorial step list',
  );
  content = replaceRegexRequired(
    content,
    /需要原有服务器写操作的步骤只在对应请求返回 `result\.ok = true` 后推进：建设、启动、开始研发和银行存款的失败请求均不得形成教程进度。生产步骤只比较本轮启动设施的 `lifetimeOutput` 与启动时基线；“设置商品自动出售”只在玩家从市场自动交易工作区保存合法最低价、合法最低自由库存保留量（允许 `0`）并启用当前浏览器策略后推进，同时记录本轮商品 ID；“完成一次自动出售”只接受该商品后续由在线自动出售动作返回 `result\.ok = true` 的新成交，/,
    '需要原有服务器写操作的步骤只在对应请求返回 `result.ok = true` 后推进：建设、启动、开始研发和银行存款的失败请求均不得形成教程进度。生产步骤只比较本轮启动设施的 `lifetimeOutput` 与启动时基线；“设置工厂自动经营”只在玩家于地区工厂详情成功保存工厂自动经营策略后推进，并按该工厂当前生产配置记录产成品 ID；技术步骤 ID `set-auto-sell` 与本地统计键 `autoSellSettings` 仅为教程 v3 既有轮次兼容，不代表商品级设置入口。“完成一次自动出售”只接受该产成品后续由在线自动出售动作返回 `result.ok = true` 的新成交，',
    'tutorial automatic operation completion',
  );
  content = replaceRequired(
    content,
    '| 商品在线自动采购／自动出售策略 | 市场的地区 `MarketPage` 商品详情自动交易区 |',
    '| 工厂自动经营策略 | 建筑的地区 `BuildingsPage` 工厂详情；按 `provinceId + facilityTypeId` 保存经营意图 |\n| 商品自动经营执行状态 | 市场的地区 `MarketPage` 商品详情；只读展示统一订单簿执行结果，不提供商品级策略编辑 |',
    'page ownership table',
  );
  for (const stale of ['设置商品自动出售', '最低自由库存保留量（允许 `0`）', '市场自动交易设置']) {
    if (content.includes(stale)) throw new Error(`PAGE_CONTENT stale automatic-trade rule remains: ${stale}`);
  }
  write(path, content);
}

{
  const path = 'docs/UI_DESIGN_SYSTEM.md';
  let content = read(path);
  content = content.replace('> 更新时间：2026-08-28', '> 更新时间：2026-08-29');
  content = replaceRequired(
    content,
    '| `src/styles/warehouse-expansion.css` | 州级可钻取仓库商品网格、地区商品详情自动交易控制、容器查询、紧凑商品卡和移动自动交易入口布局 |',
    '| `src/styles/warehouse-expansion.css` | 州级可钻取仓库商品网格、地区商品详情只读自动经营执行、容器查询与紧凑商品卡布局 |',
    'UI warehouse stylesheet responsibility',
  );
  content = replaceRequired(
    content,
    '| `src/styles/facility-production-formula.css` | 工厂集群生产结算的输入侧周期成本、物资槽、流向进度、范围标识和响应式布局 |',
    '| `src/styles/facility-production-formula.css` | 工厂集群生产结算的输入侧周期成本、物资槽、流向进度、范围标识和响应式布局 |\n| `src/styles/factory-auto-operation.css` | 地区工厂详情自动经营的启停、原料保障、经营模式、产成品处理与响应式布局 |',
    'UI factory auto operation stylesheet responsibility',
  );
  content = content.replaceAll('两条路径最终都复用同一个地区商品详情、订单簿、下单和自动交易实现', '两条路径最终都复用同一个地区商品详情、订单簿、下单和只读自动经营执行实现');
  content = replaceRequired(
    content,
    '共享仓库只位于州级上下文页仓库分区，自动交易只位于市场。',
    '共享仓库只位于州级上下文页仓库分区；可编辑自动经营策略只位于地区工厂详情，地区商品详情只读显示自动经营执行状态。',
    'UI automatic operation ownership',
  );
  content = replaceRequired(
    content,
    '当前工厂详情顺序固定为“移动把手（桌面无）→ 工厂信息（插画右侧三行：数量摘要 → 单厂平均利润 → 满员率）→ 生产配置 → 生产结算 → 经营诊断 → 市场入口”。',
    '当前工厂详情顺序固定为“移动把手（桌面无）→ 工厂信息（插画右侧三行：数量摘要 → 单厂平均利润 → 满员率）→ 生产配置 → 自动经营 → 生产结算 → 经营诊断 → 市场入口”。',
    'UI factory detail order',
  );
  content = replaceRequired(content, '工厂详情、研发详情与市场自动交易设置继续使用 `MobileWorkspaceDetailSheet` API', '工厂详情与研发详情继续使用 `MobileWorkspaceDetailSheet` API', 'UI mobile detail ownership');
  content = replaceRequired(content, '打开工厂／研发／自动交易详情时', '打开工厂／研发详情时', 'UI mobile detail open');
  content = replaceRequired(content, '任何业务页、工厂详情、研发详情或自动交易设置都不得创建嵌套 `.mobile-detail-sheet`', '任何业务页、工厂详情或研发详情都不得创建嵌套 `.mobile-detail-sheet`', 'UI nested sheet ownership');
  content = replaceRequired(
    content,
    '地区商品自动交易详情固定当前商品，继续复用采购／出售页签和既有仓库表单信息层级，不显示全商品选择器；原子保存动作仍放在唯一 Host 的固定底栏。',
    '地区商品详情的自动经营执行卡固定当前商品，在桌面与移动端都作为商品详情正文只读显示，不创建策略页签、全商品选择器、保存动作、固定底栏或第二个详情 Sheet。',
    'UI read-only product execution',
  );
  for (const stale of ['市场自动交易设置', '自动交易只位于市场', '自动交易详情固定当前商品']) {
    if (content.includes(stale)) throw new Error(`UI_DESIGN_SYSTEM stale automatic-trade rule remains: ${stale}`);
  }
  write(path, content);
}

{
  const path = 'docs/LIQUID_GLASS_CHROME_DESIGN.md';
  let content = read(path);
  content = content.replace('> 更新时间：2026-08-28', '> 更新时间：2026-08-29');
  content = replaceRequired(
    content,
    '除纯地图外的玩家页面与工厂／研发／自动交易等业务详情统一进入唯一根级 Mobile Workspace Sheet。',
    '除纯地图外的玩家页面与工厂／研发等业务详情统一进入唯一根级 Mobile Workspace Sheet；地区商品自动经营执行状态保留在商品详情正文，不创建独立策略详情层。',
    'chrome mobile detail ownership',
  );
  content = replaceRequired(content, '工厂、研发或自动交易详情打开时', '工厂或研发详情打开时', 'chrome detail open');
  write(path, content);
}

{
  const path = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
  let content = read(path);
  content = content.replace('> 更新时间：2026-08-28', '> 更新时间：2026-08-29');
  content = replaceRequired(
    content,
    '- 商品级在线自动采购／自动出售策略，以及仅当前玩家可见的托管买单／卖单私有关联；',
    '- 按地区＋工厂类型保存的自动经营策略、由当前工厂状态派生的商品自动采购／出售执行策略，以及仅当前玩家可见的托管买单／卖单私有关联；',
    'server authority automatic operation',
  );
  content = replaceRequired(
    content,
    '- `online-auto-trade-reservations.js`：商品自动采购／出售共享的生产预定与供货合同可用保留计算；\n- `online-auto-trade-policy.js`：同商品自动采购／出售策略的原子校验与保存，统一约束库存区间和价格区间；\n- `online-auto-buy-policy.js`、`online-auto-buy-orders.js`、`online-auto-buy.js`：自动采购存档策略、私有真实买单关联、资金释放与在线买单重平衡；\n- `online-auto-sell-policy.js`、`online-auto-sell-orders.js`、`online-auto-sell.js`：自动出售存档策略、私有真实卖单关联、库存释放与在线卖单重平衡；',
    '- `factory-auto-operation.js`：玩家可编辑的地区＋工厂类型经营意图、默认策略、当前生产配置聚合、商品执行策略派生，以及策略变化时对统一商品托管订单的安全重建；\n- `online-auto-trade-reservations.js`：商品自动采购／出售执行共享的生产预定与供货合同可用保留计算；\n- `online-auto-trade-policy.js`：商品执行兼容镜像的原子写入与既有托管订单撤销／冻结释放；它不再是玩家经营意图来源；\n- `online-auto-buy-policy.js`、`online-auto-buy-orders.js`、`online-auto-buy.js`：商品执行兼容状态、私有真实买单关联、资金释放与在线买单重平衡；服务器执行时必须重新从工厂自动经营策略派生当前买入边界；\n- `online-auto-sell-policy.js`、`online-auto-sell-orders.js`、`online-auto-sell.js`：商品执行兼容状态、私有真实卖单关联、库存释放与在线卖单重平衡；服务器执行时必须重新从工厂自动经营策略派生当前卖出边界；',
    'server module automatic operation roles',
  );
  content = replaceRequired(
    content,
    '- `warehouse.js`：无限共享仓库真实库存汇总，以及当前玩家自动采购／自动出售策略和私有托管订单关联的状态投影；',
    '- `warehouse.js`：无限共享仓库真实库存汇总、工厂自动经营策略、由工厂策略派生的商品执行状态和私有托管订单关联的客户端投影；',
    'server warehouse projection role',
  );
  write(path, content);
}

console.log('Factory automatic-operation authority docs synchronized.');
