import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);
let changeCount = 0;

function replaceText(path, from, to) {
  if (!existsSync(path)) return false;
  const source = read(path);
  if (!source.includes(from)) return false;
  write(path, source.replace(from, to));
  changeCount += 1;
  return true;
}

function replaceRegex(path, pattern, replacement) {
  if (!existsSync(path)) return false;
  const source = read(path);
  if (!pattern.test(source)) return false;
  write(path, source.replace(pattern, replacement));
  changeCount += 1;
  return true;
}

const pageMarketSection = [
  '## 4. 市场',
  '',
  '一级路由 `market` 使用 `GlobalMarketPage`，页面主标题固定为“市场”。市场固定采用“商品目录 → 商品全局详情 → 地区商品详情”三级信息层级；商品全局详情只是同一 `market` 页面内部钻取，不新增正式路由或第二套交易页面。',
  '',
  '默认商品目录按正式商品顺序展示商品、24h 成交量、今日价格和 24h 价格变化；筛选默认折叠且不提供商品名称搜索框。市场标题区固定显示“市场”，商品目录正文不重复显示“商品”分区标题。商品列表字段名使用独立表头，固定为“商品｜24h成交量｜今日价格｜24h价格变化｜箭头”；不得恢复卖单量、买单量、最优买卖价、挂单差额或“有我的订单”筛选。今日价格读取当前地区服务器 `officialPrice`；一级跨州目录只对当前可经营地区的官方价格和真实成交摘要做只读聚合。',
  '',
  '商品地区详情必须包含今日官方价格、买入／卖出方向、数量、25%／50%／最大快捷数量、交易总额和即时提交、近 24h 真实成交趋势、今日成交量、24h 成交量、下一北京时间 00:00 调价时间，以及按当前商品过滤的浏览器本地最近成交。玩家只能输入整数数量，不得输入或修改成交价格；服务器在写事务中重新读取当日 `officialPrice`。卖出方向继续展示按整笔即时成交估算的“预计到账”，真实结算继续收取 1% 市场服务费。',
  '',
  '玩家商品页面不得渲染五档盘口、买卖盘深度、已有订单、撤单、价格加减按钮、挂单／成交切换或订单数量上限提示。服务器内部人口消费与市场储备订单不属于玩家盘口，普通玩家市场详情不得从这些内部订单派生 `bestBid`、`bestAsk`、买卖盘数量或可点击价格档位。浏览器本地最近成交只用于当前设备回顾，不是服务器订单历史。',
  '',
  '未开放写权限的地区市场仍允许只读查看商品目录、今日官方价格和真实成交行情；只读态隐藏即时交易提交能力，但不得伪造空盘口或恢复撤单入口。自动经营策略与执行解释唯一归地区工厂详情；地区商品详情不维护第二套自动经营配置。',
  '',
  '商品全局详情按地区列出今日价格、24h 成交量和 24h 价格变化，并允许进入该地区商品详情。全局列表和地区列表都只展示行情事实，不提供盘口深度或订单来源。市场行情图几何继续以 `MARKET_CHART_LAYOUT_DESIGN.md` 为准。',
  '',
].join('\n');
replaceRegex(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  /## 4\. 市场[\s\S]*?(?=\n## 5\.)/,
  pageMarketSection,
);
replaceText(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '实际盘口与手动下单继续由地区 `MarketPage` 执行',
  '实际当日价即时买卖继续由地区 `MarketPage` 执行',
);
replaceText(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '市场无论解锁状态都允许查看商品目录、行情和订单簿，未解锁时必须为只读，隐藏或禁用下单、撤单等市场写入口',
  '市场无论解锁状态都允许查看商品目录、今日价格和真实成交行情，未解锁时必须为只读并隐藏即时交易提交能力',
);
replaceText(
  'scripts/verify-page-content.mjs',
  "requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '地区市场允许只读查看行情与订单簿');",
  "requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '地区市场允许只读查看今日官方价格与真实成交行情');",
);
replaceText(
  'scripts/verify-page-content.mjs',
  "  '市场无论解锁状态都允许查看商品目录、行情和订单簿',",
  "  '市场无论解锁状态都允许查看商品目录、今日价格和真实成交行情',",
);

const warehouseSection2 = [
  '## 2. 权威库存与自动经营设置',
  '',
  '实物库存定义固定为：',
  '',
  '```text',
  '地区实物库存 = Σ(该地区各商品可用数量 + 冻结数量)',
  '```',
  '',
  '玩家可编辑的自动经营策略只按 `provinceId + facilityTypeId` 保存，字段继续为启用状态、原料保障周期、经营模式和产成品处理。商品维度的采购上限、出售下限、目标自由库存和最低自由库存均由服务器从工厂策略、当前配方与生产参与数量派生；客户端提交的兼容价格字段不构成权威价格。',
  '',
  '自动经营执行不保存 managed-order ID，也不创建玩家商品开放订单。生产预定、合同可用保留和额外原料保障只是目标数量计算量，不形成新的资产冻结。即时采购只在当日 `officialPrice` 不高于派生采购上限时发生；即时出售只在当日 `officialPrice` 不低于派生出售下限时发生。',
  '',
  '读取默认策略不得写回存档或推进 revision。离线期间不新增后台自动交易循环；在线客户端只负责在相关权威状态变化后触发一次服务器重新校验，最终数量、阈值、资金、库存和成交价均由服务器决定。',
  '',
  '以下旧容量字段不得恢复：',
  '',
  '```text',
  'inventoryCapacity',
  'warehouseLevel',
  'warehouseUpgradeCost',
  'warehouseNextCapacity',
  'warehouseNextCapacityIncrease',
  'warehouseOrderReservedQuantity',
  'warehouseContractReservedQuantity',
  'warehouseAuctionReservedQuantity',
  'warehouseReservedQuantity',
  'warehouseUsedCapacity',
  'warehouseAvailableCapacity',
  '```',
  '',
].join('\n');
replaceRegex(
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  /## 2\. 权威库存与自动经营设置[\s\S]*?(?=\n## 3\.)/,
  warehouseSection2,
);
const warehouseMarket = [
  '### 3.1 市场',
  '',
  '普通手动商品买卖唯一归属市场页，并按当前州该商品当日 `officialPrice` 即时成交。买入只受当日价下可用资金与数量安全边界约束；卖出只受当地可用库存约束。玩家商品交易不创建开放订单、不冻结等待成交资金或商品，也不读取服务器内部人口／储备订单深度。',
  '',
  '自动经营配置与玩家可见经营意图唯一归属工厂详情。自动采购／出售达到价格阈值后直接调用同一服务器即时交易结算，不建立第二套市场、商品订单或资金池。地区商品详情只显示今日价格、成交行情、库存和手动即时交易。',
  '',
].join('\n');
replaceRegex(
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  /### 3\.1 市场[\s\S]*?(?=\n### 3\.2)/,
  warehouseMarket,
);
const warehouseProduction = [
  '### 3.4 生产',
  '',
  '生产周期只检查可参与生产的工厂、运营资金以及工厂所在地区可取得的真实原料来源，产出直接进入同一地区仓库。正式扣料前可比较同地区有效采购合同固定价与当日官方系统价；合同严格更便宜时可优先使用合同额度，否则先使用本地仓库。本地仓库不足时才按同地区当日 `officialPrice` 即时采购缺口；仍无法满足资金或其他真实约束时按缺料进入现有生产异常。任何一步都不得跨地区取货。',
  '',
].join('\n');
replaceRegex(
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  /### 3\.4 生产[\s\S]*?(?=\n## 4\.)/,
  warehouseProduction,
);
const warehouseTail = [
  '## 5. 州级仓库与工厂自动经营界面',
  '',
  '隐藏州级上下文页的“仓库”分区固定采用扁平正文，只展示当地实际库存；跨州运输唯一归属独立运输页。仓库商品卡只展示名称、插画、可用数量和冻结数量，并作为当前州商品详情入口。',
  '',
  '工厂详情在生产配置附近显示“自动经营”。玩家只配置启用状态、原料保障周期、经营模式和产成品处理；不得要求玩家逐商品维护挂单数量、挂单价格或托管订单。地区商品详情不再渲染自动经营执行卡。',
  '',
  '## 6. 工厂自动经营聚合规则',
  '',
  '### 6.1 原料保障',
  '',
  '原料保障可选 `1 / 2 / 3 / 5` 个完整生产周期。生产预定保护下一完整周期，额外保障只计算第一周期之外的输入量；同地区所有启用自动经营且具有生产可用数量的工厂按商品聚合。',
  '',
  '### 6.2 经营模式与价格边界',
  '',
  '| 模式 | 原料采购上限 | 产成品出售下限 |',
  '|---|---:|---:|',
  '| `profit` 利润优先 | 商品基础价 × 0.95 | 商品基础价 × 1.10 |',
  '| `balanced` 均衡 | 商品基础价 × 1.05 | 商品基础价 × 1.00 |',
  '| `supply` 保供优先 | 商品基础价 × 1.15 | 商品基础价 × 0.95 |',
  '',
  '同一商品被多个工厂消费时采用最高采购上限；被多个工厂生产时采用最高出售下限。任一自动经营生产者选择 `keep` 时该商品不得自动出售。双向策略仍必须满足采购上限严格低于出售下限。',
  '',
  '### 6.3 共享预定与即时目标数量',
  '',
  '```text',
  '自动采购需求量 = max(0, 生产预定 + 合同可用保留 + 额外原料保障 - available)',
  '即时自动采购数量 = min(自动采购需求量, 当日官方价下资金可负担数量)',
  '即时自动出售数量 = max(0, available - 生产预定 - 合同可用保留 - 最低自由库存)',
  '```',
  '',
  '上述预定和保障只用于计算，不限制玩家其他合法资产操作；每次服务器即时交易成功后再由下一份权威状态重新聚合。',
  '',
  '## 7. 在线即时经营维护',
  '',
  '在线客户端只在商品目录、玩家资产、生产、市场官方价或合同相关权威状态变化后判断是否需要提交一次维护请求。纯经济事件、银行、签到、研发计时或排行榜变化不得触发扫描。服务器收到请求后重新读取工厂策略、库存、资金、合同保留和当日 `officialPrice`，满足阈值才即时采购或出售。',
  '',
  '自动经营不得创建 managed-order ID、开放买单、开放卖单、撤旧重挂、时间优先级维护或反向交叉订单检查。离线期间没有新的后台补挂、调价或交易循环；既有库存和生产仍按各自权威规则推进。',
  '',
].join('\n');
replaceRegex(
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  /## 5\. 州级仓库与工厂自动经营界面[\s\S]*$/,
  warehouseTail,
);
replaceText(
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  '生产与工厂集群以 `INDUSTRY_AND_PRODUCTION_DESIGN.md` 为准；页面归属以 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为准。州级仓库商品卡、工厂自动经营产生的商品采购／出售执行、客户端在线订单维护，以及跨州运输模式、费用、在途资产和持久化路线规则以本文为准。',
  '生产与工厂集群以 `INDUSTRY_AND_PRODUCTION_DESIGN.md` 为准；商品即时交易与每日官方价以 `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` 为准；页面归属以 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为准。州级仓库商品卡、工厂自动经营的即时采购／出售触发，以及跨州运输模式、费用、在途资产和持久化路线规则以本文为准。',
);

const industryMarketRules = [
  '- “一键购齐并建造”只补足当前库存缺少的正式 `buildInputs`：服务器在同一建造事务中读取建造地区各缺失材料的当日 `officialPrice`，重新校验逐材料最高接受价、采购总额上限、真实资金和库存；全部满足后按官方价即时购齐缺口并继续建设。任一材料价格超过保护值、资金不足或随后建设失败时全部回滚，不创建 FOK、开放买单或系统材料商店。',
  '- 周期投入仍严格限定工厂集群所在地区，不得跨地区寻找原料或落库。有效采购合同固定价严格低于当日 `officialPrice` 时可以优先使用合同额度；否则先使用本地仓库。本地库存不足时才按同地区当日官方价即时采购缺口；仍不足则按真实缺料进入现有生产异常。该流程不得创建工厂私有库存、第二套市场或跨州隐式调货。',
].join('\n');
replaceRegex(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  /- “一键购齐并建造”[\s\S]*?(?=\n- 每个地区商品的当日真实工厂产量)/,
  `${industryMarketRules}\n`,
);
replaceText(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '商品最近一次统一订单簿真实成交价',
  '商品当日官方系统价',
);
replaceText(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '最近真实成交价',
  '当日官方系统价',
);

replaceText(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '→ 合同覆盖的需求按权威条款准备、托管、履约和结算，未覆盖的缺口与剩余产出继续进入同州统一订单簿',
  '→ 合同覆盖的需求按权威条款准备、托管、履约和结算，未覆盖的缺口与剩余产出按同州当日官方系统价即时交易',
);
replaceText(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '缺料时的“一键购齐并建造”仍属于即时建设，只把真实统一订单簿中成交的正式商品补入玩家库存后在同一事务消耗，不发行商品、不提供系统固定价材料，也不改变工厂成本。',
  '缺料时的“一键购齐并建造”仍属于即时建设；服务器在同一事务按建造州各缺失材料的当日官方系统价即时购入并消耗，继续执行价格保护、资金校验和全有或全无回滚，不留下商品挂单。',
);
replaceRegex(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  /商品库存、商品行情、工厂集群、工厂行情和订单簿按州级地区隔离：[^\n]*/,
  '商品库存、商品行情、工厂集群和服务器内部市场状态按州级地区隔离：玩家商品即时交易只改变成交州的本地资金与库存；人口／储备内部订单只能在同州模拟市场内撮合；工厂交易或拍卖后仍留在原地区。',
);
replaceText(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '迁移必须保留数量、冻结、资金、订单优先级和历史，不复制资产、不取消玩家订单。',
  '迁移必须保留数量、资金和真实历史；旧玩家商品开放订单一次性释放剩余冻结资金或库存并关闭，不复制资产，服务器内部人口／储备订单按各自模型继续兼容。',
);
replaceText(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '统一订单簿玩家卖出手续费：按累计成交额精确收取 1%',
  '商品即时卖出市场服务费：按实际成交额精确收取 1%',
);
replaceText(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '商品订单只允许玩家订单、消费需求订单和市场储备订单。',
  '玩家商品交易不创建订单；服务器内部商品订单只允许消费需求订单和市场储备订单。',
);
replaceText(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '商品估值 = Σ((可用数量 + 冻结数量) × 最近一次订单簿真实成交价)',
  '商品估值 = Σ((可用数量 + 冻结数量) × 所在州当日官方系统价)',
);
replaceText(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '财富榜使用服务器最近订单簿真实成交价计算资产毛值并扣除贷款负债后实时排序，不发放宝石奖励。',
  '财富榜的商品部分使用所在州当日官方系统价，工厂继续使用正式工厂估值口径；汇总资产毛值并扣除贷款负债后实时排序，不发放宝石奖励。',
);
const tradingBoard = [
  '### 7.4 交易榜',
  '',
  '交易榜只统计玩家作为卖方通过商品即时市场完成的实际卖出成交额，买入不重复计分：',
  '',
  '```text',
  '实际卖出成交额 += 即时卖出数量 × 当日官方系统价',
  '```',
  '',
  '成绩采用 1% 市场服务费扣除前的实际成交总额。买入成交额、合同交付、拍卖成交、服务器内部人口／储备订单、合成行情和参考价格均不计入交易榜。即时交易没有未成交挂单或撤单剩余量。',
  '',
  '服务器必须为每次成功即时卖出生成稳定成交 ID 并按 ID 去重；同一成交不得因轮询、重启或幂等重放重复计入。实际成交笔数可以用于审计或展示，但不得参与排名；成绩单位为普通货币。',
  '',
  '权威周期状态继续保存 `tradingRuleVersion`。规则迁移只改变排行榜统计口径，不得改变玩家资产、即时成交结果或手续费。',
  '',
].join('\n');
replaceRegex(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  /### 7\.4 交易榜[\s\S]*?(?=\n### 7\.5)/,
  tradingBoard,
);

replaceText(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '按地区＋工厂类型保存的自动经营策略、由当前工厂状态派生的商品自动采购／出售执行策略，以及仅当前玩家可见的托管买单／卖单私有关联',
  '按地区＋工厂类型保存的自动经营策略，以及由当前工厂状态派生并按当日官方价即时执行的商品自动采购／出售策略',
);
replaceText(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '商品与工厂统一订单、成交和估值价格',
  '商品每日官方系统价、玩家商品即时成交记录、服务器内部人口／储备订单，以及工厂正式估值状态',
);
replaceRegex(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  /商品订单写动作在真实订单簿撮合完成后执行官方系统价实时清算；[^\n]*/,
  '玩家商品写动作不进入开放订单簿：服务器在同一事务内读取州×商品当日 `officialPrice` 并即时结算资金、地区库存、卖出手续费、成交记录与当日买卖量。世界级截止时间机制通过北京时间每日 00:00 唤醒完整世界处理并按前一自然日玩家↔系统买卖量失衡更新官方价；重复处理同一 `priceDateKey` 不得重复调价。`world.systemMarketAudit` 继续作为顶层 segment 随事务持久化且只用于服务器审计。服务器内部人口／储备订单撮合与玩家即时交易严格分离，普通玩家状态不得下发内部订单深度。',
);

for (const path of [
  'scripts/codex-daily-market-finalize.mjs',
  '.github/workflows/codex-daily-market-finalize.yml',
]) {
  if (existsSync(path)) unlinkSync(path);
}

console.log(`即时市场最终收口完成：应用 ${changeCount} 处设计／验证修改，并删除临时收口工作流。`);
