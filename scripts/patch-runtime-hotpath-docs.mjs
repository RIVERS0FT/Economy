import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, source) {
  writeFileSync(path, source);
}

function replaceLineStarting(path, prefix, replacement) {
  const lines = read(path).split('\n');
  const index = lines.findIndex((line) => line.startsWith(prefix));
  if (index < 0) throw new Error(`${path}: missing line ${prefix}`);
  lines.splice(index, 1, ...replacement.split('\n'));
  write(path, lines.join('\n'));
}

function replaceParagraphStarting(path, prefix, replacement) {
  const source = read(path);
  const start = source.indexOf(prefix);
  if (start < 0) throw new Error(`${path}: missing paragraph ${prefix}`);
  const end = source.indexOf('\n\n', start);
  if (end < 0) throw new Error(`${path}: paragraph has no terminator ${prefix}`);
  write(path, `${source.slice(0, start)}${replacement}${source.slice(end)}`);
}

function replaceSectionGap(path, before, after, replacement) {
  const source = read(path);
  const start = source.indexOf(before);
  const end = source.indexOf(after, start + before.length);
  if (start < 0 || end < 0) throw new Error(`${path}: missing section gap`);
  write(path, `${source.slice(0, start + before.length)}${replacement}${source.slice(end)}`);
}

for (const path of ['docs/README.md', 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md']) {
  replaceLineStarting(path, '> 更新时间：', '> 更新时间：2026-08-14');
}

replaceLineStarting(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '- `runtime-store.js`：',
  '- `runtime-store-core.js`：合同动作、人口政策、存档世代投影隔离、管理员运行时能力与现有持久化扩展的主体实现；\n- `runtime-store.js`：正式运行时热路径编排层，负责已提交世界缓存、请求草稿创建、调度 barrier 与权威写入准入；',
);

replaceSectionGap(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '任一步失败全部回滚。\n\n',
  '## 4. 世界迁移、状态交付与客户端版本',
  '运行时内存状态必须区分**已提交世界（committed world）**与**请求草稿（world draft）**。正式服务命中内存缓存的普通玩家权威写最多创建一次完整世界草稿；SQLite 世界写入与对应合同／拍卖审计在同一事务成功后，该草稿直接交接为新的已提交世界，禁止为了普通动作的缓存提交再次 `structuredClone` 整个世界。只有 `GET state` 自身必须先持久化（例如首次建档或登录结算）且随后兼容状态投影仍可能修改工作对象时，允许在提交缓存时建立一次 `worldCacheIsolationCloneMs` 隔离副本，防止保存后的投影污染已提交缓存；该隔离不得进入普通玩家动作路径。动作业务失败时，附属 SQLite 写入通过 `SAVEPOINT` 回滚，未提交的请求草稿直接丢弃；玩家动作不得为了恢复世界再创建第二份完整世界快照。经济活动判定只允许复制当前玩家自身的动作前快照；合同动作可额外复制合同集合用于变更判定和审计，不得复制第二份完整世界。\n\n正式服务的到期世界推进仍由单一权威调度器负责。若普通玩家写入到达时全局最早截止时间已经到期，`runtime-store.js` 必须先建立一个可复用的系统调度 barrier，在同一权威写执行器中先完成一次到期世界处理，再放行随后到达的玩家写入；同一到期窗口不得由多个玩家请求重复承担全服推进。系统调度任务不继承玩家 HTTP 请求的性能采集上下文，玩家请求只记录等待 barrier 的 `schedulerBarrierWaitMs`，不得把系统 `worldProcessMs` 伪装成该玩家动作自身处理阶段。非正式调度的内存测试存储仍可在请求内按到期领域推进，以保持确定性测试。\n\n普通商品 `placeOrder` 在上述到期 barrier 完成后必须直接复用 `applySettledCommodityOrder` 与统一订单簿撮合，不得再绕经会执行 `processFacilityGroupWorld` 的工厂动作适配层。该优化不改变订单冻结、撮合、成交价、手续费、幂等、修订号、资产守恒或统一订单簿语义。完整资金精度收口、世界变化判定和单行 `state_json` 持久化仍保留现行权威规则，本次不得把尚未实施的分区持久化当作既成事实。\n\n',
);

replaceLineStarting(
  'docs/README.md',
  '48. ',
  '48. 正式世界调度只能使用 `world-deadline-planner.js` 计算的单一最早到期 `setTimeout`，不得恢复固定一秒 `setInterval` 或在空闲窗口反复克隆、迁移、深比较和写入世界；`world-deadline-runtime.js` 必须按世界对象与修订号缓存同一截止时间计划，`null` 截止时间不得被解释为 0。正式调度唤醒必须从计划中计算实际 `dueDomains` 并按实际到期领域推进，银行、研发、合同等未到期领域不得仅因其他领域到期而被重复处理；管理员或首次建档等显式完整处理路径可以保持完整推进。工厂即时建设不得注册施工完成或施工就业截止时间；正式服务的玩家写入若到达已过期截止时间，必须先等待同一权威写执行器中的调度 barrier，动作主体不得再次执行同一轮全服推进；关闭正式调度的内存测试才允许在请求内按实际到期领域推进。该规则通过 `server/test/world-deadline-planner.test.js`、`server/test/authoritative-hotpaths.test.js`、`server/test/runtime-hotpath-architecture.test.js`、`scripts/verify-runtime-efficiency.mjs` 与 `scripts/verify-authoritative-hotpaths.mjs` 防回退。',
);
replaceLineStarting(
  'docs/README.md',
  '67. ',
  '67. 世界冷加载迁移与热保存必须分离：完整世界迁移、旧字段补全和全玩家兼容初始化只允许在首次加载或版本升级时执行。正式运行时必须区分已提交世界与请求草稿；命中内存缓存的普通玩家权威写最多创建一次完整世界草稿，成功持久化后直接把该草稿交接为新的已提交缓存，不得为了缓存提交再次复制整个世界。只有 `GET state` 自身必须先持久化（例如首次建档或登录结算）且随后兼容状态投影仍可能修改工作对象时，允许在提交缓存时额外建立一次隔离副本；该例外不得进入普通玩家动作热路径。正式调度由截止时间运行时缓存复用同一世界修订号的计划并只按实际到期领域推进；玩家写入到达已过期截止时间时，必须先复用同一权威写执行器中的系统调度 barrier 完成一次到期推进，再放行玩家动作，普通动作主体不得重复承担同一轮全服推进。普通商品下单在 barrier 后直接使用已结算商品订单热路径，不得绕经工厂动作适配层触发额外全服处理。普通动作热路径继续只允许一次最终资金精度收口和一次持久化判定；幂等记录过期清理最多每 5 分钟执行一次。以上规则归属 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并由 `server/test/runtime-hot-path.test.js`、`server/test/authoritative-hotpaths.test.js`、`server/test/runtime-hotpath-architecture.test.js`、`scripts/verify-runtime-efficiency.mjs` 与 `scripts/verify-authoritative-hotpaths.mjs` 防回退。',
);
replaceLineStarting(
  'docs/README.md',
  '71. ',
  '71. 所有正式玩家经济动作（包括合同动作）必须在外层 `BEGIN IMMEDIATE` 权威事务内部再建立 SQLite `SAVEPOINT`，并统一在请求独占的 world draft 上执行：动作业务返回失败或抛异常时回滚保存点并直接丢弃未提交草稿，不得再复制整个世界作为第二份回滚快照。经济活动判定只允许保存当前玩家的动作前快照；合同动作可额外保存合同集合快照用于变更判定与审计，但不得保存第二份完整世界。动作成功必须在释放保存点前执行资金、库存、工厂数量和银行负债等非负／安全整数不变量检查；合同动作允许在成功后执行合同领域专项后处理并在同一事务完成审计。失败动作仍可保存精简幂等确认，但不得写回世界或推进世界修订号。该规则归属 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并由 `economic-mutation.js`、`runtime-action-executor.js`、`server/test/state-polling.test.js`、`server/test/authoritative-hotpaths.test.js`、`server/test/runtime-hotpath-architecture.test.js` 与 `scripts/verify-authoritative-hotpaths.mjs` 防回退。',
);

replaceParagraphStarting(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '`EconomyStore` 必须在单进程内缓存',
  '`EconomyStore` 必须在单进程内缓存已迁移、已清理的已提交世界对象、对应修订号和最近序列化结果；普通玩家写操作只从该缓存创建一次 `structuredClone` 请求草稿，禁止请求直接修改缓存权威对象。正式服务必须启用单一全局到期调度器：`world-deadline-planner.js` 从运行中工厂周期、市场需求和价格传导周期、人口政策到期、开放拍卖、合同到期／宽限期／公开过期、银行每日结息、贷款到期／宽限结束、每日签到跨日、排行榜结算与订单历史裁剪中选出最早绝对时间，只设置一个 `setTimeout`；没有到期事件时不得进入 SQLite 世界事务。调度器最多每秒推进一次到期世界；玩家写入到达已过期截止时间时，`runtime-store.js` 必须先复用同一权威写执行器中的调度 barrier 完成一次推进，再执行玩家动作，动作主体不得重复处理同一轮全服截止时间。调度事务失败必须保持原修订权威并至少延后 1 秒再调度。同修订号请求必须在进入 SQLite 事务前直接返回轻量确认，不得重新读取数据库、`JSON.parse`、遍历全部玩家、`structuredClone` 或 `JSON.stringify` 整份世界。内存测试可以关闭调度器，也必须使用假时钟验证 60 秒空闲窗口产生零次世界事务和到期处理延后不超过 1 秒。基础客户端快照生成后，合同分区必须复用同一修订号的内存缓存，只克隆合同计算可能修改的玩家、合同与人口经济投影；除首次建档、登录结算等 `GET state` 自身持久化后的缓存隔离副本外，同一次状态读取不得再开启第二次完整世界事务、完整世界克隆或对完整客户端状态执行第二次 JSON 往返规范化。',
);
replaceParagraphStarting(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '工厂、拍卖、合同、银行和排行榜的时间推进统一由运行时世界处理路径完成',
  '工厂、拍卖、合同、银行和排行榜的时间推进统一由运行时世界处理路径完成，禁止通过原型钩子在 `getStateSnapshot`、`apply` 或商店读取前后重复执行。正式服务的普通玩家动作在进入自身事务前由调度 barrier 保证已到期领域完成一次权威推进，动作事务本身不得再执行通用动作前／动作后全世界处理；只有合同动作等确实需要立即完成本领域状态转换的路径可以执行本领域专项后处理。关闭正式调度的内存测试可以在请求内按实际到期领域推进，以保持确定性。普通轮询不得承担时间推进，正式服务的全局调度器保证到期处理延后不超过 1 秒。排行榜视图在生成当前玩家客户端状态时注入，不得为了不同查看者把同一榜单快照重复写入世界。保存前只进行一次规范化；实际变化使用缓存世界结构比较，变化时只序列化一次并复用该字符串写库和更新缓存。事务回滚必须同时恢复数据库和内存缓存。',
);

console.log('runtime hot-path authority documents patched');
