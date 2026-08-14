import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after, label) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  writeFileSync(path, source.replace(before, after));
}

function replaceBetween(path, start, end, replacement, label) {
  const source = readFileSync(path, 'utf8');
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Missing ${label} in ${path}`);
  writeFileSync(path, source.slice(0, startIndex) + replacement + source.slice(endIndex));
}

const design = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
replaceOnce(
  design,
  `主表：\n\n\
\`\`\`sql\neconomy_world(\n  id INTEGER PRIMARY KEY CHECK (id = 1),\n  revision INTEGER NOT NULL,\n  state_json TEXT NOT NULL,\n  updated_at INTEGER NOT NULL\n)\n\`\`\``,
  `正式世界存储使用分段存储 V2，但仍共享一个全局世界修订号和一个 SQLite 事务边界：\n\n\`\`\`sql\neconomy_world_meta(\n  id INTEGER PRIMARY KEY CHECK (id = 1),\n  revision INTEGER NOT NULL,\n  world_version INTEGER NOT NULL,\n  storage_schema_version INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL\n)\n\neconomy_world_players(\n  user_id INTEGER PRIMARY KEY,\n  updated_revision INTEGER NOT NULL,\n  state_json TEXT NOT NULL,\n  updated_at INTEGER NOT NULL\n)\n\neconomy_world_segments(\n  segment_key TEXT PRIMARY KEY,\n  updated_revision INTEGER NOT NULL,\n  state_json TEXT NOT NULL,\n  updated_at INTEGER NOT NULL\n)\n\`\`\`\n\n旧 \`economy_world\` 只保留兼容迁移入口和轻量 manifest；完成 V2 迁移后不得继续把完整世界 JSON 写回该表。玩家行与世界顶层 segment 只是持久化粒度，不形成独立经济权威：资金、库存、订单、银行、拍卖和合同仍由同一全局 \`revision\`、同一 \`BEGIN IMMEDIATE\` 事务和同一回滚边界统一提交。`,
  'segmented storage schema authority',
);

replaceOnce(
  design,
  `写事务固定：\n\n1. \`BEGIN IMMEDIATE\`；\n2. 读取当前世界、修订号和幂等缓存；\n3. 迁移并规范化；\n4. 执行动作与世界推进；\n5. 校验资产、仓库、合同托管和状态不变量；\n6. 更新世界并增加修订号；\n7. 写入精简幂等确认；\n8. \`COMMIT\`。\n\n任一步失败全部回滚。`,
  `写事务固定：\n\n1. 普通玩家写入若命中已到期世界截止时间，先通过同一权威写执行器完成调度 barrier；\n2. \`BEGIN IMMEDIATE\`，并校验幂等缓存；\n3. 从已完成冷迁移的 committed world 计算动作 Mutation Scope，只复制本动作可能写入的玩家和世界 segment；\n4. 执行动作；正式调度启用时动作主体不得再次执行通用全世界推进；\n5. 校验本动作可写范围内的资产、仓库、合同托管和经济状态不变量，并只对 Dirty Scope 做资金精度收口；\n6. 将草稿与 committed snapshot 按声明范围比较，只有实际变化的玩家行和 segment 写入 V2 表，同时只增加一次全局修订号；\n7. 在同一事务内写入合同／拍卖审计与精简幂等确认；\n8. \`COMMIT\` 后把已提交草稿直接交接为新的 committed world。\n\n完整世界迁移、旧字段补全和全玩家兼容初始化只允许在首次加载、旧单行世界迁移或世界版本升级时执行，不属于普通写事务步骤。动作失败回滚 SAVEPOINT 并丢弃草稿；数据库、审计或分段写入失败则整个外层事务回滚。`,
  'runtime write transaction rules',
);

replaceBetween(
  design,
  '运行时内存状态必须区分**已提交世界（committed world）**与**请求草稿（world draft）**。',
  '\n\n`GET state` 的正式投影路径必须是纯只读操作：',
  `运行时内存状态必须区分**已提交世界（committed world）**与**请求草稿（world draft）**。正式服务命中内存缓存的玩家写入必须先通过 \`createRuntimeMutationScope\` 声明可写玩家与世界 segment，再由 \`cloneWorldForMutation\` 创建 Copy-on-Write 草稿：可写对象必须隔离复制，未声明对象允许与 committed world 共享引用且必须被视为只读。未知或尚未局部化的动作可以暂时退回完整草稿，但不得为了回滚、投影或持久化再创建第二份完整世界。普通商品下单只复制下单者、当前价格可交叉的玩家对手方、订单／市场及必要核心资金域；商品撤单只复制下单者、订单及必要核心资金域；拍卖动作只复制相关卖方／当前最高出价者／当前操作者、拍卖及必要核心资金域。\n\nV2 热保存不得做完整世界 \`isDeepStrictEqual\`、完整世界 \`JSON.stringify\` 或全世界资金精度扫描。保存层只序列化 Mutation Scope 覆盖的玩家与 segment，与 committed segmented snapshot 比较并形成 Dirty Set；没有 Dirty Row 时世界修订号保持不变。写入成功后草稿直接成为新的 committed world，未变玩家和 segment 的 SQLite 行内容及 \`updated_revision\` 必须保持原值。`,
  'committed world and COW draft rules',
);

replaceOnce(
  design,
  `普通商品 \`placeOrder\` 在上述到期 barrier 完成后必须直接复用 \`applySettledCommodityOrder\` 与统一订单簿撮合，不得再绕经会执行 \`processFacilityGroupWorld\` 的工厂动作适配层。该优化不改变订单冻结、撮合、成交价、手续费、幂等、修订号、资产守恒或统一订单簿语义。完整资金精度收口、世界变化判定和单行 \`state_json\` 持久化仍保留现行权威规则，本次不得把尚未实施的分区持久化当作既成事实。`,
  `普通商品 \`placeOrder\` 在上述到期 barrier 完成后必须直接复用 \`applySettledCommodityOrder\` 与统一订单簿撮合，不得再绕经会执行 \`processFacilityGroupWorld\` 的工厂动作适配层。普通商品下单与撤单必须使用动作专用 Copy-on-Write Scope；拍卖动作同样只复制本次交易可能修改的参与者与拍卖域。上述优化不改变订单冻结、撮合、成交价、手续费、幂等、全局修订号、资产守恒或统一订单簿语义。热保存只做 scoped money normalization 和 Dirty Row 比较／写入；完整资金精度收口只保留给冷迁移、完整世界升级和明确的全世界写入。`,
  'commodity and segmented hot persistence rule',
);

replaceOnce(
  design,
  `世界 27 是当前持久化边界。世界 23 在既有世界 22 上增加聚合人口、工厂承载、迁入迁出、就业诊断和动态人口预算；当前客户端状态版本为 33。世界 16 的银行和净资产结构继续保留；\`world.bank\`、\`player.bankAccount\`、贷款抵押明细和银行统计都保存在 \`economy_world.state_json\`，与玩家资金、工厂和订单共享同一事务、修订号和回滚边界，不另建可与世界失配的余额表。银行最近记录只保留每名玩家最近 100 条，普通客户端序列化最近 50 条；利息微单位余数和资金池微单位仍是服务器内部整数，不得暴露为可直接使用的普通货币。`,
  `世界 29 是当前持久化边界，当前客户端状态版本为 33，世界存储 schema 为 V2。\`world.bank\` 等世界级银行状态写入对应顶层 segment，\`player.bankAccount\`、贷款抵押明细和玩家统计随对应玩家行保存；它们仍与玩家资金、工厂、订单、拍卖和合同共享同一全局修订号、SQLite 事务和回滚边界，不允许形成可独立提交的第二套余额权威。银行最近记录只保留每名玩家最近 100 条，普通客户端序列化最近 50 条；利息微单位余数和资金池微单位仍是服务器内部整数，不得暴露为可直接使用的普通货币。`,
  'world 29 segmented persistence boundary',
);

replaceBetween(
  design,
  '`EconomyStore` 必须在单进程内缓存已迁移、已清理的已提交世界对象、对应修订号和最近序列化结果；',
  '\n\n工厂、拍卖、合同、银行和排行榜的时间推进统一由运行时世界处理路径完成，',
  `\`EconomyStore\` 必须在单进程内缓存已迁移、已清理的 committed world、对应全局修订号和 segmented snapshot。当前 V2 世界冷启动直接从 \`economy_world_meta\`、\`economy_world_players\` 与 \`economy_world_segments\` 重建；当 storage schema 和世界版本都已经是当前值时，重复重启不得再次执行完整迁移、重写分段行或增加修订号。旧 \`economy_world.state_json\` 只允许被读取一次完成 V2 迁移，迁移成功后改写为轻量 manifest。\n\n正式服务必须启用单一全局到期调度器：\`world-deadline-planner.js\` 从运行中工厂周期、市场需求和价格传导周期、人口政策到期、开放拍卖、合同到期／宽限期／公开过期、银行每日结息、贷款到期／宽限结束、每日签到跨日、排行榜结算与订单历史裁剪中选出最早绝对时间，只设置一个 \`setTimeout\`；没有到期事件时不得进入 SQLite 世界事务。调度器最多每秒推进一次到期世界；玩家写入到达已过期截止时间时，\`runtime-store.js\` 必须先复用同一权威写执行器中的调度 barrier 完成一次推进，再执行玩家动作。调度器对当前世界调用工厂、拍卖、排行榜等处理器时必须传递 \`migrate: false\`；完整迁移仅属于冷加载。\n\n同修订号状态请求必须在进入 SQLite 事务前直接返回轻量确认。不同修订号但无需登录周结算的已有玩家状态读取，同样直接从 committed world 纯只读投影；基础客户端快照、合同、拍卖、银行、研发和排行榜必须复用同一 committed world。投影辅助函数不得通过“规范化”修改源世界，例如订单公开序列化必须先复制订单再补兼容字段。分区和子切片哈希只由业务内容驱动，客户端投影缓存不得以复制完整世界来容忍副作用。`,
  'runtime cache scheduler and pure projection rules',
);

replaceOnce(
  design,
  `保存前只进行一次规范化；实际变化使用缓存世界结构比较，变化时只序列化一次并复用该字符串写库和更新缓存。事务回滚必须同时恢复数据库和内存缓存。`,
  `保存前只对 Mutation Scope 做一次资金精度收口；实际变化由分段 snapshot 的 Dirty Set 比较确定，只序列化可能变化的玩家行和 segment，并只写入内容真实变化的行。事务回滚必须同时恢复数据库和内存缓存。`,
  'dirty set save rule',
);

const docsReadme = 'docs/README.md';
replaceOnce(
  docsReadme,
  `67. 世界冷加载迁移与热保存必须分离：完整世界迁移、旧字段补全和全玩家兼容初始化只允许在首次加载或版本升级时执行。正式运行时必须区分已提交世界与请求草稿；普通玩家权威写只允许一份请求草稿，已有规范 \`stateJson\` 时必须优先通过 \`JSON.parse\` 构造隔离草稿，只有缓存仍需持久化时才回退完整 \`structuredClone\`，成功持久化后草稿直接交接为新的已提交世界。正式 \`GET state\` 对已有玩家的缓存未命中路径必须直接从已提交世界执行纯只读投影，不得创建请求草稿、执行迁移／领域结算／全玩家初始化、写库或通过额外完整世界克隆容忍投影副作用；合同、拍卖、银行、研发和排行榜客户端状态同样必须只读生成。管理员 \`GET /api/game/admin/summary\` 与 \`GET /api/game/admin/population-economy\` 也必须直接读取已提交世界，已有缓存时不得进入权威写队列、SQLite 事务、强制世界推进或保存路径。正式调度继续复用同一修订号计划并只按实际到期领域推进，玩家写入到达已过期截止时间时先复用同一权威写执行器中的调度 barrier，动作主体不得重复承担同一轮全服推进。普通商品下单继续直接使用统一订单簿快速路径；普通动作热路径只允许一次最终资金精度收口和一次持久化判定，幂等记录过期清理最多每 5 分钟执行一次。以上规则归属 \`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md\`，并由 \`server/test/runtime-hot-path.test.js\`、\`server/test/authoritative-hotpaths.test.js\`、\`server/test/runtime-hotpath-architecture.test.js\`、\`scripts/verify-runtime-efficiency.mjs\` 与 \`scripts/verify-authoritative-hotpaths.mjs\` 防回退。`,
  `67. 世界冷加载迁移与热保存必须分离：完整世界迁移、旧字段补全和全玩家兼容初始化只允许在首次加载、旧单行世界迁移或版本升级时执行。正式持久化使用 \`economy_world_meta + economy_world_players + economy_world_segments\` 分段存储 V2，所有行仍共享一个世界修订号和一个 SQLite 事务；当前 V2 世界重复冷启动不得迁移、重写或推进修订号，旧 \`economy_world.state_json\` 只允许迁移一次并转为 manifest。正式运行时必须区分 committed world 与请求草稿；普通玩家权威写通过 Mutation Scope 创建 Copy-on-Write 草稿，只隔离本动作可能修改的玩家和世界 segment，未声明共享对象必须保持只读，未知动作才允许回退完整草稿。普通商品下单复制操作者、当前可交叉的玩家对手方、订单／市场与必要核心资金域；商品撤单和拍卖动作使用对应局部 Scope。热保存只允许 scoped money normalization、Dirty Row 比较与脏玩家／segment 写入，不得恢复完整世界 \`isDeepStrictEqual\`、完整 \`JSON.stringify\` 或全世界资金扫描。正式 \`GET state\` 对已有玩家的缓存未命中路径必须直接从 committed world 执行纯只读投影，不得创建请求草稿、执行迁移／领域结算／全玩家初始化、写库或通过额外完整世界克隆容忍投影副作用；公开订单等投影规范化必须先复制再修改。管理员只读汇总同样保持队列外。正式调度继续只按实际到期领域推进并对当前世界使用 \`migrate: false\`；玩家写入遇到已到期截止时间时先复用调度 barrier。以上规则归属 \`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md\`，并由 \`server/test/world-storage-v2.test.js\`、\`server/test/runtime-hot-path.test.js\`、\`server/test/authoritative-hotpaths.test.js\`、\`server/test/runtime-hotpath-architecture.test.js\`、\`scripts/verify-runtime-efficiency.mjs\` 与 \`scripts/verify-authoritative-hotpaths.mjs\` 防回退。`,
  'docs index rule 67',
);
replaceOnce(
  docsReadme,
  `71. 所有正式玩家经济动作（包括合同动作）必须在外层 \`BEGIN IMMEDIATE\` 权威事务内部再建立 SQLite \`SAVEPOINT\`，并统一在请求独占的 world draft 上执行：动作业务返回失败或抛异常时回滚保存点并直接丢弃未提交草稿，不得再复制整个世界作为第二份回滚快照。`,
  `71. 所有正式玩家经济动作（包括合同动作）必须在外层 \`BEGIN IMMEDIATE\` 权威事务内部再建立 SQLite \`SAVEPOINT\`，并统一在请求的 Copy-on-Write world draft 上执行：本动作声明为可写的对象必须独占，未声明对象可以与 committed world 共享但必须保持只读；动作业务返回失败或抛异常时回滚保存点并直接丢弃未提交草稿，不得再复制整个世界作为第二份回滚快照。`,
  'docs index rule 71 COW clarification',
);

replaceOnce('README.md', '| 数据存储 | SQLite |', '| 数据存储 | SQLite（全局修订 + 分段世界存储 V2） |', 'root README storage summary');

replaceBetween(
  'server/src/runtime-store.js',
  '\n// The core module remains the single implementation for projection, contracts and persistence.',
  '',
  '',
  'obsolete source guard marker block',
);

console.log('Updated segmented storage authority docs and removed obsolete runtime source markers.');
