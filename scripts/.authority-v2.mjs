import { readFileSync, writeFileSync } from 'node:fs';

function rewrite(path, transform) {
  const source = readFileSync(path, 'utf8');
  const next = transform(source);
  if (next === source) throw new Error(`No changes applied to ${path}`);
  writeFileSync(path, next);
}

function replaceChecked(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Missing replacement target: ${label}`);
  return next;
}

rewrite('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', (input) => {
  let source = input;
  source = replaceChecked(source, /主表：\n\n```sql\neconomy_world\([\s\S]*?\n```/, `正式世界存储使用分段存储 V2，但仍共享一个全局世界修订号和一个 SQLite 事务边界：

\`\`\`sql
economy_world_meta(
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL,
  world_version INTEGER NOT NULL,
  storage_schema_version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)

economy_world_players(
  user_id INTEGER PRIMARY KEY,
  updated_revision INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)

economy_world_segments(
  segment_key TEXT PRIMARY KEY,
  updated_revision INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)
\`\`\`

旧 \`economy_world\` 只保留兼容迁移入口和轻量 manifest；完成 V2 迁移后不得继续把完整世界 JSON 写回该表。玩家行与世界顶层 segment 只是持久化粒度，不形成独立经济权威：资金、库存、订单、银行、拍卖和合同仍由同一全局 \`revision\`、同一 \`BEGIN IMMEDIATE\` 事务和同一回滚边界统一提交。`, 'storage schema');
  source = replaceChecked(source, /写事务固定：\n\n1\. `BEGIN IMMEDIATE`；[\s\S]*?任一步失败全部回滚。/, `写事务固定：

1. 普通玩家写入若命中已到期世界截止时间，先通过同一权威写执行器完成调度 barrier；
2. \`BEGIN IMMEDIATE\`，并校验幂等缓存；
3. 从已完成冷迁移的 committed world 计算动作 Mutation Scope，只复制本动作可能写入的玩家和世界 segment；
4. 执行动作；正式调度启用时动作主体不得再次执行通用全世界推进；
5. 校验本动作可写范围内的资产、仓库、合同托管和经济状态不变量，并只对 Dirty Scope 做资金精度收口；
6. 将草稿与 committed snapshot 按声明范围比较，只有实际变化的玩家行和 segment 写入 V2 表，同时只增加一次全局修订号；
7. 在同一事务内写入合同／拍卖审计与精简幂等确认；
8. \`COMMIT\` 后把已提交草稿直接交接为新的 committed world。

完整世界迁移、旧字段补全和全玩家兼容初始化只允许在首次加载、旧单行世界迁移或世界版本升级时执行，不属于普通写事务步骤。动作失败回滚 SAVEPOINT 并丢弃草稿；数据库、审计或分段写入失败则整个外层事务回滚。`, 'transaction sequence');
  source = replaceChecked(source, /运行时内存状态必须区分\*\*已提交世界（committed world）\*\*与\*\*请求草稿（world draft）\*\*。[\s\S]*?(?=\n\n`GET state` 的正式投影路径必须是纯只读操作：)/, `运行时内存状态必须区分**已提交世界（committed world）**与**请求草稿（world draft）**。正式服务命中内存缓存的玩家写入必须先通过 \`createRuntimeMutationScope\` 声明可写玩家与世界 segment，再由 \`cloneWorldForMutation\` 创建 Copy-on-Write 草稿：可写对象必须隔离复制，未声明对象允许与 committed world 共享引用且必须被视为只读。未知或尚未局部化的动作可以暂时退回完整草稿，但不得为了回滚、投影或持久化再创建第二份完整世界。普通商品下单只复制下单者、当前价格可交叉的玩家对手方、订单／市场及必要核心资金域；商品撤单只复制下单者、订单及必要核心资金域；拍卖动作只复制相关卖方／当前最高出价者／当前操作者、拍卖及必要核心资金域。

V2 热保存不得做完整世界 \`isDeepStrictEqual\`、完整世界 \`JSON.stringify\` 或全世界资金精度扫描。保存层只序列化 Mutation Scope 覆盖的玩家与 segment，与 committed segmented snapshot 比较并形成 Dirty Set；没有 Dirty Row 时世界修订号保持不变。写入成功后草稿直接成为新的 committed world，未变玩家和 segment 的 SQLite 行内容及 \`updated_revision\` 必须保持原值。`, 'COW runtime paragraph');
  source = replaceChecked(source, /普通商品 `placeOrder` 在上述到期 barrier 完成后必须直接复用 `applySettledCommodityOrder`[\s\S]*?本次不得把尚未实施的分区持久化当作既成事实。/, `普通商品 \`placeOrder\` 在上述到期 barrier 完成后必须直接复用 \`applySettledCommodityOrder\` 与统一订单簿撮合，不得再绕经会执行 \`processFacilityGroupWorld\` 的工厂动作适配层。普通商品下单与撤单必须使用动作专用 Copy-on-Write Scope；拍卖动作同样只复制本次交易可能修改的参与者与拍卖域。上述优化不改变订单冻结、撮合、成交价、手续费、幂等、全局修订号、资产守恒或统一订单簿语义。热保存只做 scoped money normalization 和 Dirty Row 比较／写入；完整资金精度收口只保留给冷迁移、完整世界升级和明确的全世界写入。`, 'commodity hot path paragraph');
  source = replaceChecked(source, /世界 27 是当前持久化边界。[\s\S]*?利息微单位余数和资金池微单位仍是服务器内部整数，不得暴露为可直接使用的普通货币。/, `世界 29 是当前持久化边界，当前客户端状态版本为 33，世界存储 schema 为 V2。\`world.bank\` 等世界级银行状态写入对应顶层 segment，\`player.bankAccount\`、贷款抵押明细和玩家统计随对应玩家行保存；它们仍与玩家资金、工厂、订单、拍卖和合同共享同一全局修订号、SQLite 事务和回滚边界，不允许形成可独立提交的第二套余额权威。银行最近记录只保留每名玩家最近 100 条，普通客户端序列化最近 50 条；利息微单位余数和资金池微单位仍是服务器内部整数，不得暴露为可直接使用的普通货币。`, 'world 29 boundary');
  source = replaceChecked(source, /`EconomyStore` 必须在单进程内缓存已迁移、已清理的已提交世界对象、对应修订号和最近序列化结果；[\s\S]*?(?=\n\n工厂、拍卖、合同、银行和排行榜的时间推进统一由运行时世界处理路径完成，)/, `\`EconomyStore\` 必须在单进程内缓存已迁移、已清理的 committed world、对应全局修订号和 segmented snapshot。当前 V2 世界冷启动直接从 \`economy_world_meta\`、\`economy_world_players\` 与 \`economy_world_segments\` 重建；当 storage schema 和世界版本都已经是当前值时，重复重启不得再次执行完整迁移、重写分段行或增加修订号。旧 \`economy_world.state_json\` 只允许被读取一次完成 V2 迁移，迁移成功后改写为轻量 manifest。

正式服务必须启用单一全局到期调度器：\`world-deadline-planner.js\` 从运行中工厂周期、市场需求和价格传导周期、人口政策到期、开放拍卖、合同到期／宽限期／公开过期、银行每日结息、贷款到期／宽限结束、每日签到跨日、排行榜结算与订单历史裁剪中选出最早绝对时间，只设置一个 \`setTimeout\`；没有到期事件时不得进入 SQLite 世界事务。调度器最多每秒推进一次到期世界；玩家写入到达已过期截止时间时，\`runtime-store.js\` 必须先复用同一权威写执行器中的调度 barrier 完成一次推进，再执行玩家动作。调度器对当前世界调用工厂、拍卖、排行榜等处理器时必须传递 \`migrate: false\`；完整迁移仅属于冷加载。

同修订号状态请求必须在进入 SQLite 事务前直接返回轻量确认。不同修订号但无需登录周结算的已有玩家状态读取，同样直接从 committed world 纯只读投影；基础客户端快照、合同、拍卖、银行、研发和排行榜必须复用同一 committed world。投影辅助函数不得通过“规范化”修改源世界，例如订单公开序列化必须先复制订单再补兼容字段。分区和子切片哈希只由业务内容驱动，客户端投影缓存不得以复制完整世界来容忍副作用。`, 'runtime cache paragraph');
  source = replaceChecked(source, /保存前只进行一次规范化；实际变化使用缓存世界结构比较，变化时只序列化一次并复用该字符串写库和更新缓存。事务回滚必须同时恢复数据库和内存缓存。/, `保存前只对 Mutation Scope 做一次资金精度收口；实际变化由分段 snapshot 的 Dirty Set 比较确定，只序列化可能变化的玩家行和 segment，并只写入内容真实变化的行。事务回滚必须同时恢复数据库和内存缓存。`, 'dirty set save sentence');
  return source;
});

rewrite('docs/README.md', (input) => {
  let source = input;
  source = replaceChecked(source, /^67\..*$/m, `67. 世界冷加载迁移与热保存必须分离：完整世界迁移、旧字段补全和全玩家兼容初始化只允许在首次加载、旧单行世界迁移或版本升级时执行。正式持久化使用 \`economy_world_meta + economy_world_players + economy_world_segments\` 分段存储 V2，所有行仍共享一个世界修订号和一个 SQLite 事务；当前 V2 世界重复冷启动不得迁移、重写或推进修订号，旧 \`economy_world.state_json\` 只允许迁移一次并转为 manifest。正式运行时必须区分 committed world 与请求草稿；普通玩家权威写通过 Mutation Scope 创建 Copy-on-Write 草稿，只隔离本动作可能修改的玩家和世界 segment，未声明共享对象必须保持只读，未知动作才允许回退完整草稿。普通商品下单复制操作者、当前可交叉的玩家对手方、订单／市场与必要核心资金域；商品撤单和拍卖动作使用对应局部 Scope。热保存只允许 scoped money normalization、Dirty Row 比较与脏玩家／segment 写入，不得恢复完整世界 \`isDeepStrictEqual\`、完整 \`JSON.stringify\` 或全世界资金扫描。正式 \`GET state\` 对已有玩家的缓存未命中路径必须直接从 committed world 执行纯只读投影，不得创建请求草稿、执行迁移／领域结算／全玩家初始化、写库或通过额外完整世界克隆容忍投影副作用；公开订单等投影规范化必须先复制再修改。管理员只读汇总同样保持队列外。正式调度继续只按实际到期领域推进并对当前世界使用 \`migrate: false\`；玩家写入遇到已到期截止时间时先复用调度 barrier。以上规则归属 \`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md\`，并由 \`server/test/world-storage-v2.test.js\`、\`server/test/runtime-hot-path.test.js\`、\`server/test/authoritative-hotpaths.test.js\`、\`server/test/runtime-hotpath-architecture.test.js\`、\`scripts/verify-runtime-efficiency.mjs\` 与 \`scripts/verify-authoritative-hotpaths.mjs\` 防回退。`, 'README rule 67');
  source = replaceChecked(source, /^71\. 所有正式玩家经济动作.*$/m, `71. 所有正式玩家经济动作（包括合同动作）必须在外层 \`BEGIN IMMEDIATE\` 权威事务内部再建立 SQLite \`SAVEPOINT\`，并统一在请求的 Copy-on-Write world draft 上执行：本动作声明为可写的对象必须独占，未声明对象可以与 committed world 共享但必须保持只读；动作业务返回失败或抛异常时回滚保存点并直接丢弃未提交草稿，不得再复制整个世界作为第二份回滚快照。经济活动判定只允许保存当前玩家的动作前快照；合同动作可额外保存合同集合快照用于变更判定与审计，但不得保存第二份完整世界。动作成功必须在释放保存点前执行资金、库存、工厂数量和银行负债等非负／安全整数不变量检查；合同动作允许在成功后执行合同领域专项后处理并在同一事务完成审计。失败动作仍可保存精简幂等确认，但不得写回世界或推进世界修订号。该规则归属 \`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md\`，并由 \`economic-mutation.js\`、\`runtime-action-executor.js\`、\`server/test/state-polling.test.js\`、\`server/test/authoritative-hotpaths.test.js\`、\`server/test/runtime-hotpath-architecture.test.js\` 与 \`scripts/verify-authoritative-hotpaths.mjs\` 防回退。`, 'README rule 71');
  return source;
});

rewrite('README.md', (source) => replaceChecked(source, '| 数据存储 | SQLite |', '| 数据存储 | SQLite（全局修订 + 分段世界存储 V2） |', 'root README storage'));

rewrite('server/src/runtime-store.js', (source) => replaceChecked(source, /\n\/\/ The core module remains the single implementation for projection, contracts and persistence\.[\s\S]*$/, '\n', 'obsolete runtime markers'));

rewrite('scripts/verify-runtime-efficiency.mjs', (input) => {
  let source = input;
  source = replaceChecked(source, /requireText\('server\/src\/runtime-store-core\.js', \[\n  "measureRequestPhase\('worldEqualityMs'",\n  "measureRequestPhase\('serializeWorldMs'",\n  "measureRequestPhase\('worldUpdateMs'",\n\]\);/, `requireText('server/src/world-storage-v2.js', [
  'WORLD_STORAGE_SCHEMA_VERSION = 2',
  'AUTHORITATIVE_WORLD_VERSION = 29',
  'createRuntimeMutationScope',
  'cloneWorldForMutation',
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  'economy_world_meta',
  'economy_world_players',
  'economy_world_segments',
  "label: 'commodity:placeOrder'",
]);
requireText('server/src/runtime-store-core.js', [
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  'this.cacheWorld(nextRevision, null, world, false, plan.snapshot)',
]);`, 'runtime efficiency segmented persistence checks');
  source = replaceChecked(source, /requireText\('server\/src\/runtime-store\.js', \[[\s\S]*?\n\]\);\nconst runtimeStore = read\('server\/src\/runtime-store\.js'\);\nassert\.ok\([\s\S]*?'合同审计必须在世界写入后、运行时缓存推进前完成',\n\);/, `requireText('server/src/runtime-store.js', [
  'cloneWorldForMutation',
  "measureRequestPhase('worldDraftCowMs'",
  'ensureScheduledProcessingBarrier',
  "measureRequestPhase('schedulerBarrierWaitMs'",
  'return executeRuntimeAction(this, user, requestMeta, now)',
]);
const runtimeStore = read('server/src/runtime-store.js');
assert.equal(runtimeStore.includes('isDeepStrictEqual(world, cached.world)'), false, 'V2 热保存不得恢复完整世界深比较');
assert.equal(runtimeStore.includes('this.updateWorld.run(nextRevision, stateJson, now)'), false, 'V2 热保存不得恢复单行完整世界写入');
const runtimeCore = read('server/src/runtime-store-core.js');
assert.ok(
  runtimeCore.indexOf('applySegmentedWorldWrite(this, plan, world, now)')
    < runtimeCore.indexOf('this.flushContractAuditEvents(world, revision, nextRevision)')
    && runtimeCore.indexOf('this.flushContractAuditEvents(world, revision, nextRevision)')
      < runtimeCore.indexOf('this.cacheWorld(nextRevision, null, world, false, plan.snapshot)'),
  '合同审计必须在分段世界写入后、运行时缓存推进前完成',
);`, 'runtime efficiency runtime-store checks');
  source = replaceChecked(source, /requireText\('server\/test\/state-polling\.test\.js', \[/, `requireText('server/test/world-storage-v2.test.js', [
  'current V2 cold restarts do not advance revision or rewrite segmented rows',
  'legacy monolithic world migrates to V2 only once',
  'dirty player write leaves unrelated player and market rows byte-identical',
  'commodity order COW scope clones actor and crossing counterparties only',
]);
requireText('server/test/runtime-hotpath-architecture.test.js', [
  'segmented persistence reconstructs the same committed world without projection mutation',
]);
assert.equal(read('server/src/facility-groups.js').includes('clone(normalizeOrder(order))'), false, '公开订单投影不得先修改 committed order 再克隆');
requireText('server/test/state-polling.test.js', [`, 'runtime efficiency V2 tests');
  return source;
});

rewrite('scripts/verify-authoritative-hotpaths.mjs', (input) => {
  let source = input;
  source = replaceChecked(source, `  'server/src/runtime-store.js',\n  'server/src/runtime-store-core.js',`, `  'server/src/runtime-store.js',\n  'server/src/runtime-store-core.js',\n  'server/src/world-storage-v2.js',`, 'authoritative required world storage file');
  source = source.replace("  'worldDraftParseMs',\n", "  'worldDraftCowMs',\n");
  source = replaceChecked(source, /for \(const text of \[\n  'return executeRuntimeAction\(this, user, requestMeta, now\)',\n  'worldDraftParseMs',\n  'JSON\.parse\(this\.worldCache\.stateJson\)',\n  'settledSynchronously',\n  'captureRequestContext: false',\n\]\)/, `for (const text of [
  'return executeRuntimeAction(this, user, requestMeta, now)',
  'cloneWorldForMutation',
  'worldDraftCowMs',
  'settledSynchronously',
  'captureRequestContext: false',
])`, 'authoritative runtime wrapper COW checks');
  source = replaceChecked(source, /for \(const text of \[\n  'committedWorldForCache\(world\)',[\s\S]*?\n\]\) assert\.equal\(runtimeStore\.includes\(text\), false, `正式状态读取不得恢复投影克隆: \$\{text\}`\);/, `for (const text of [
  'committedWorldForCache(world)',
  'stateProjectionCacheIsolationDepth',
  'worldCacheIsolationCloneMs',
  'contractProjectionForState',
  'JSON.parse(this.worldCache.stateJson)',
  'isDeepStrictEqual(world, cached.world)',
]) assert.equal(runtimeStore.includes(text), false, \`正式状态读取和 V2 热保存不得恢复旧完整世界路径: \${text}\`);`, 'authoritative forbidden old paths');
  source = replaceChecked(source, `  'assertEconomicStateInvariants(world)',\n  'structuredClone(world.players?.[String(user.id)]',`, `  'assertEconomicStateInvariantsScoped(world, mutationScope)',\n  'structuredClone(world.players?.[String(user.id)]',`, 'scoped invariant guard');
  source = replaceChecked(source, /const mutation = read\('server\/src\/economic-mutation\.js'\);/, `const worldStorage = read('server/src/world-storage-v2.js');
for (const text of [
  'WORLD_STORAGE_SCHEMA_VERSION = 2',
  'createRuntimeMutationScope',
  'cloneWorldForMutation',
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  "label: 'commodity:placeOrder'",
]) assert.ok(worldStorage.includes(text), \`分段世界存储缺少: \${text}\`);
for (const forbidden of ['isDeepStrictEqual(world, cached.world)', 'JSON.parse(this.worldCache.stateJson)']) {
  assert.equal(runtimeStore.includes(forbidden), false, \`V2 运行时不得恢复旧完整世界热路径: \${forbidden}\`);
}

const mutation = read('server/src/economic-mutation.js');`, 'authoritative world storage checks');
  source = replaceChecked(source, `  '已提交世界',\n  '请求草稿',`, `  '已提交世界',\n  '请求草稿',\n  'Copy-on-Write',\n  '分段存储 V2',\n  'Dirty Row',`, 'authoritative design guard terms');
  source = replaceChecked(source, /console\.log\('权威热路径验证通过：[\s\S]*?'\);/, `console.log('权威热路径验证通过：按领域截止时间推进、分段存储 V2、Copy-on-Write 动作草稿、Dirty Row 持久化、纯只读状态投影、统一订单簿与六分区客户端权威状态均受防回退约束。');`, 'authoritative verifier result');
  return source;
});

console.log('Updated V2 authority docs and verification guards.');
