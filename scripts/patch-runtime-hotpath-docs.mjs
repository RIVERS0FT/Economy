import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, from, to) {
  const source = readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  writeFileSync(path, source.replace(from, to));
}

patch(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '- `runtime-store.js`：运行时存储扩展、合同动作、人口政策、存档世代投影隔离与管理员运行时能力；',
  '- `runtime-store-core.js`：合同动作、人口政策、存档世代投影隔离、管理员运行时能力与现有持久化扩展的主体实现；\n- `runtime-store.js`：正式运行时热路径编排层，负责已提交世界缓存、请求草稿创建、调度 barrier 与权威写入准入；',
);

patch(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '任一步失败全部回滚。\n\n## 4. 世界迁移、状态交付与客户端版本',
  '任一步失败全部回滚。\n\n运行时内存状态必须区分**已提交世界（committed world）**与**请求草稿（world draft）**。正式服务命中内存缓存的普通权威写最多创建一次完整世界草稿；SQLite 世界写入与对应合同／拍卖审计在同一事务成功后，该草稿直接成为新的已提交世界，禁止为了提交缓存再次 `structuredClone` 整个世界。动作业务失败时，附属 SQLite 写入通过 `SAVEPOINT` 回滚，未提交的请求草稿直接丢弃；普通玩家动作不得为了恢复世界再创建第二份完整世界快照。当前玩家的活动判定只允许复制该玩家自身的动作前快照。\n\n正式服务的到期世界推进仍由单一权威调度器负责。若普通玩家写入到达时全局最早截止时间已经到期，`runtime-store.js` 必须先建立一个可复用的系统调度 barrier，在同一权威写执行器中先完成一次到期世界处理，再放行随后到达的玩家写入；同一到期窗口不得由多个玩家请求重复承担全服推进。系统调度任务不继承玩家 HTTP 请求的性能采集上下文，玩家请求只记录等待 barrier 的 `schedulerBarrierWaitMs`，不得把系统 `worldProcessMs` 伪装成该玩家动作自身处理阶段。非正式调度的内存测试存储仍可在请求内按到期领域推进，以保持确定性测试。\n\n普通商品 `placeOrder` 在上述到期 barrier 完成后必须直接复用 `applySettledCommodityOrder` 与统一订单簿撮合，不得再绕经会执行 `processFacilityGroupWorld` 的工厂动作适配层。该优化不改变订单冻结、撮合、成交价、手续费、幂等、修订号、资产守恒或统一订单簿语义。完整资金精度收口、世界变化判定和单行 `state_json` 持久化仍保留现行权威规则，本次不得把尚未实施的分区持久化当作既成事实。\n\n## 4. 世界迁移、状态交付与客户端版本',
);

patch(
  'docs/README.md',
  '67. 世界冷加载迁移与热保存必须分离：完整世界迁移、旧字段补全和全玩家兼容初始化只允许在首次加载或版本升级时执行。正式调度由截止时间运行时缓存复用同一世界修订号的计划，并只按实际到期领域推进；普通动作预处理只推进已经到期的领域，动作自身继续负责本领域权威结算，合同动作的动作后结算只使用合同专项处理，不得再次推进全部银行、研发和排行榜。普通动作热路径只允许一次最终资金精度收口和一次持久化判定；幂等记录过期清理最多每 5 分钟执行一次，不得随每个玩家动作重复删除扫描。以上规则归属 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并由 `server/test/runtime-hot-path.test.js`、`server/test/authoritative-hotpaths.test.js`、`scripts/verify-runtime-efficiency.mjs` 与 `scripts/verify-authoritative-hotpaths.mjs` 防回退。',
  '67. 世界冷加载迁移与热保存必须分离：完整世界迁移、旧字段补全和全玩家兼容初始化只允许在首次加载或版本升级时执行。正式运行时必须区分已提交世界与请求草稿；命中内存缓存的普通权威写最多创建一次完整世界草稿，成功持久化后直接把该草稿作为新的已提交缓存，不得为缓存提交再次复制整个世界。正式调度由截止时间运行时缓存复用同一世界修订号的计划并只按实际到期领域推进；玩家写入到达已过期截止时间时，必须先复用同一权威写执行器中的系统调度 barrier 完成一次到期推进，再放行玩家动作，普通动作主体不得重复承担同一轮全服推进。普通商品下单在 barrier 后直接使用已结算商品订单热路径，不得绕经工厂动作适配层触发额外全服处理。普通动作热路径继续只允许一次最终资金精度收口和一次持久化判定；幂等记录过期清理最多每 5 分钟执行一次。以上规则归属 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并由 `server/test/runtime-hot-path.test.js`、`server/test/authoritative-hotpaths.test.js`、`server/test/runtime-hotpath-architecture.test.js`、`scripts/verify-runtime-efficiency.mjs` 与 `scripts/verify-authoritative-hotpaths.mjs` 防回退。',
);

patch(
  'docs/README.md',
  '71. 玩家经济动作必须在外层 `BEGIN IMMEDIATE` 权威事务内部再建立 SQLite `SAVEPOINT`，并同时建立可恢复的世界动作边界；动作业务返回失败或抛异常时必须回滚保存点和世界快照，不得残留礼品码、签到、宝石兑换、拍卖／银行副作用、冻结资产或审计缓冲。动作成功必须在释放保存点前执行资金、库存、工厂数量和银行负债等非负／安全整数不变量检查；失败动作仍可保存精简幂等确认，但不得推进世界修订号。合同动作与普通动作必须遵守同一失败回滚原则。该规则归属 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并由 `economic-mutation.js`、`runtime-action-executor.js`、`server/test/authoritative-hotpaths.test.js` 与 `scripts/verify-authoritative-hotpaths.mjs` 防回退。',
  '71. 玩家经济动作必须在外层 `BEGIN IMMEDIATE` 权威事务内部再建立 SQLite `SAVEPOINT`。普通玩家动作在请求独占的 world draft 上执行：动作业务返回失败或抛异常时回滚保存点并直接丢弃未提交草稿，不得再复制整个世界作为第二份回滚快照；只有当前玩家动作前状态允许为经济活动判定建立局部快照。动作成功必须在释放保存点前执行资金、库存、工厂数量和银行负债等非负／安全整数不变量检查；失败动作仍可保存精简幂等确认，但不得推进世界修订号。仍使用共享世界动作边界的专项路径必须保持原有完整回滚语义。合同动作与普通动作必须遵守相同的事务原子性要求。该规则归属 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并由 `economic-mutation.js`、`runtime-action-executor.js`、`server/test/authoritative-hotpaths.test.js`、`server/test/runtime-hotpath-architecture.test.js` 与 `scripts/verify-authoritative-hotpaths.mjs` 防回退。',
);

console.log('runtime hot-path authority documents patched');
