# Economy 服务器架构与部署设计

> 状态：当前服务器、API、持久化和部署基线
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-07-24
> 客户端状态版本：17
> 世界状态版本：15
> 市场需求模型版本：10

## 1. 权威边界

服务器唯一权威状态包括：

- 玩家资金、冻结资金、宝石和邀请码；
- 三类人口真实钱包、冻结资金、就业收入、收入状态与消费状态；
- 商品可用与冻结库存；
- 仓库等级、实际容量和买单／合同采购预占；
- 工厂集群、当前与待生效配方、统一周期和在建任务；
- 商品与工厂统一订单、成交和估值价格；
- 市场储备真实资金、库存和双边订单；
- 玩家卖出手续费累计、市场服务就业收入、人口生产工资系数和施工托管；
- 商品／工厂资产拍卖、卖方资产托管、最高出价冻结与仓库预占；
- 长期生产合作合同、商品与货款托管、保证金、宽限期与周期交付；
- 礼品码、宝石流水和商店兑换；
- 邀请关系、Economy 注册记录、同 IP 封禁事件和审计；
- 排行榜、市场需求和系统统计。

浏览器只持有展示缓存、本地活动日志、本地匿名成交记录、偏好和按教程版本／玩家 ID 隔离的客户端本轮教程状态。浏览器不得决定资产、邀请奖励、封禁、拍卖、合同交付、成交、扩容、配方、生产结果或排行榜。

## 2. 领域模块

- `domain-core.js`：商品目录、工厂目录、世界和玩家基础结构、商品订单与市场核心；
- `domain.js`：唯一公共领域门面，其他服务器模块只从此导入公共能力；
- `facility-groups.js`：工厂集群、统一周期、配方切换和工厂订单适配；
- `order-matching.js`：商品与工厂共用的价格优先、同价时间优先、maker price、部分成交、订单状态推进、逐笔 fill 与手续费结算编排；
- `order-book-integrity.js`：玩家自交叉阻断与系统盘口完整性；
- `warehouse.js`：共享仓库容量、预占和扩容；
- `asset-auctions.js`：商品／工厂单项与捆绑资产拍卖、世界 15 删除迁移、托管、竞价与原子结算；
- `contracts.js`：长期商品供货合同、托管、周期结算、宽限期与违约；
- `invitations.js`：邀请码、邀请关系、宝石流水和同 IP 邀请阻断；
- `gem-shop.js`：服务器固定汇率和宝石兑换摘要；
- `market-sell-fee.js`：单张玩家卖单和单份合同累计成交额 1% 手续费的唯一纯函数；
- `population-economy.js`：三类人口真实钱包、生产复杂度岗位、固定建造业岗位、施工托管、市场服务就业、收入 EMA、五档消费状态和整数资金分配；
- `balanced-market.js`：模型 9 的人口消费、派生流动性、稳定需求补充、市场储备双边订单和价格压力；
- `registration.js`：邮箱验证码注册、统一账号、首次 Economy 建档和邀请归因；
- `account-registration.js`：主页已登录账号首次进入 Economy 时的共用建档入口；
- `ip-bans.js`：注册 IP 指纹、同 IP 全组封禁与管理员解禁；
- `storage.js`：SQLite、事务、修订号、幂等响应、礼品码、商店流水与管理员查询；
- `runtime-store.js`：运行时存储扩展、合同动作、人口政策与管理员运行时能力；
- `state-partitions.js`：目录、玩家、市场、拍卖、合同和排行榜六个状态分区、分区哈希与精简动作确认；
- `server/shared/economy-state-version.js`：当前客户端状态版本与最低兼容版本的唯一来源；
- `game-routes.js`：普通游戏动作路由；
- `app.js`：HTTP、会话、限流、客户端状态和管理员 API；
- `leaderboards.js`：排行榜唯一实现。
- `player-admin-statistics.js`：管理员玩家运营统计、精确日活动覆盖、首次里程碑、财富分布和只读运营诊断。

`domain-core.js` 不得成为跨模块公共入口；目录、世界迁移和订单函数统一从 `domain.js` 导出。商品初始参考价、生产参数和复杂度只维护在服务器目录中，客户端和市场模块不得复制第二套正式数值。

## 3. SQLite 持久化

主表：

```sql
economy_world(
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)
```

正式数据库：

```text
/var/lib/riversoft-economy/economy.sqlite
```

写事务固定：

1. `BEGIN IMMEDIATE`；
2. 读取当前世界、修订号和幂等缓存；
3. 迁移并规范化；
4. 执行动作与世界推进；
5. 校验资产、仓库、合同托管和状态不变量；
6. 更新世界并增加修订号；
7. 写入精简幂等确认；
8. `COMMIT`。

任一步失败全部回滚。

## 4. 世界迁移、状态交付与客户端版本

加载顺序：

```text
JSON.parse
→ 基础世界迁移
→ 资产拍卖世界 15 迁移
→ 工厂集群迁移
→ 长期合同迁移
→ 宝石与邀请迁移
→ 市场需求模型 10 迁移

> 模型 10 状态迁移规则：`marketDemand.groups[*]` 持久化 `directQuoteAnchors` 与 `directOversupplyCycles`；报价锚点按绝对下限 1 和基础价 300% 上限规范化。由旧模型升级时必须释放并撤销既有系统订单，保留玩家订单、玩家资产、人口钱包与市场储备真实资产，并以迁移时价格传导参考价重置锚点、以 0 重置连续过剩周期。直接成交延迟证据不得混入派生流动性成交。
→ 兼容字段清理
→ 写回世界版本 15
→ 按客户端版本 17 序列化
→ 浏览器六分区合并
```

客户端状态版本固定使用 `server/shared/economy-state-version.js` 的 `CURRENT_CLIENT_STATE_VERSION`；浏览器兼容窗口使用同文件的 `MIN_COMPATIBLE_CLIENT_STATE_VERSION`。服务器响应、`src/types.ts`、浏览器合并器、README、权威设计和验证脚本不得维护独立常量。世界 15 永久删除艺术资产字段和客户端分区，因此客户端状态版本 17 是破坏性边界，当前客户端只接受版本 17；版本低于下限或高于当前值时必须明确返回“客户端状态版本不兼容”，不得伪装成初始分区缺失。

世界 15 的资产拍卖迁移由 `asset-auctions.js` 在工厂集群规范化之前执行，并与世界写回处于同一 SQLite 事务。迁移同时读取旧 `collectibleAuctions` 和新 `assetAuctions`，按稳定 ID 去重；纯商品／工厂拍卖保留截止时间、出价、冻结资金、仓库预占和托管状态。任何含已删除艺术资产项目的开放资产包必须整包取消，完整退回最高出价并释放同包商品／工厂，随后删除 `collectibles`、`collectibleOwnershipHistory` 与 `collectibleAuctions`。重复加载不得重复退款、重复解冻或复制拍卖。

部署世界 15 前，`.github/workflows/deploy.yml` 必须在上传新服务前使用 Python `sqlite3.Connection.backup()` 为 `/var/lib/riversoft-economy/economy.sqlite` 创建 `economy-pre-world-v15-<UTC 时间>.sqlite` 在线快照，并对快照执行 `PRAGMA quick_check`；校验失败立即中止部署。迁移快照保留最近 10 份。回滚世界 15 必须同时恢复匹配的代码与数据库快照，禁止只回滚代码。

游戏状态使用全局世界修订号排序，并拆成 `catalog`、`player`、`market`、`auction`、`contract`、`leaderboard` 六个固定分区。客户端请求可以使用 `?revision=N&catalog=...&player=...`，也可以用管理员或诊断场景的 `X-Economy-State-Revisions` 头提交分区内容哈希；响应格式固定为：

```json
{
  "revision": 123,
  "unchanged": false,
  "serverNow": 1800000000000,
  "partitionRevisions": {
    "catalog": "...",
    "player": "...",
    "market": "...",
    "auction": "...",
    "contract": "...",
    "leaderboard": "..."
  },
  "patches": {
    "player": { "...": "完整玩家分区快照" },
    "contract": { "...": "完整合同分区快照" }
  }
}
```

`serverNow` 是状态交付 envelope 的顶层响应元数据，不属于 `EconomyState`、世界 JSON 或任何状态分区；每次 `GET state` 都必须生成当前值，即使返回 `{ revision, unchanged: true, serverNow }`。浏览器只使用该值向前校准共享单调服务器时钟，不能在客户端每次接收轮询时重新解释为当前服务器时间，也不能让迟到响应使倒计时回退。

首次加载必须返回六个完整分区。后续每个返回的 `patches[name]` 都是该分区的完整快照，浏览器必须整块替换同名缓存分区，再按固定顺序重组 `EconomyState`；字段缺失即代表该字段已经被服务器删除，空对象也必须清空旧分区内容。不得恢复对旧完整状态的字段级浅合并。

普通玩家权威动作响应固定为 `{ result: { ok, message }, revision }`，不得携带订单 ID、兑换数量、结算金额或其他动作内部字段，也不得携带完整状态、分区补丁、分区修订、`unchanged` 或 `serverNow`。动作事务和 `economy_idempotency.response_json` 只生成并保存这份精简确认。浏览器在动作确认后使用动作发起前已经接受的全局 `revision` 与当前分区哈希立即补拉 `GET state`；不得在补拉前直接写入客户端状态修订号。补拉失败不得把已经提交成功的动作改写为失败。

`EconomyStore` 必须在单进程内缓存已迁移、已清理的世界对象、对应修订号和最近序列化结果；向业务逻辑提供 `structuredClone` 工作副本，禁止请求直接修改缓存权威对象。正式服务必须启用单一全局世界调度器，最多每秒推进一次生产、拍卖、合同和排行榜；同修订号请求必须在进入 SQLite 事务前直接返回轻量确认，不得重新读取数据库、`JSON.parse`、遍历全部玩家、`structuredClone` 或 `JSON.stringify` 整份世界。内存测试可以关闭调度器，并用相同的一秒处理窗口验证到期逻辑。

工厂、拍卖、合同和排行榜的时间推进统一由运行时世界处理路径完成，禁止通过原型钩子在 `getStateSnapshot`、`apply` 或商店读取前后重复执行。权威动作进入事务后强制处理一次动作前世界，并在动作后再处理一次以捕获成交、合同履约与排行榜变化；普通轮询不得承担时间推进，正式服务的全局调度器保证到期处理延后不超过 1 秒。排行榜视图在生成当前玩家客户端状态时注入，不得为了不同查看者把同一榜单快照重复写入世界。保存前只进行一次规范化；实际变化使用缓存世界结构比较，变化时只序列化一次并复用该字符串写库和更新缓存。事务回滚必须同时恢复数据库和内存缓存。

空闲状态读取不得仅因服务器时间推进而修改 `lastProcessedAt`、`lastEconomicActivityAt`、增加修订号或写回相同的 `state_json`。只有成功经济写操作可以刷新玩家活跃时间，失败操作、轮询和后台生产不得刷新。管理员世界概况与玩家运营统计只返回只读诊断；活跃玩家数、库存价值、财富分位数和留存不得用于扩张人口需求预算。旧兼容字段 `lastPlayerScaleBudget` 与 `lastInventoryBoost` 必须保持停用和零值。只有处理生产、拍卖或合同时结构结果实际变化才允许保存并增加修订号。

多输入配方以 `inputs[]` 为唯一正式结构。服务器必须先合并相同商品输入并检查全部库存、资金和仓库条件，再在同一事务中扣除所有输入；任一输入不足时不得发生部分扣料。世界版本 8 升级到 9 时，正在运行的电子工厂周期从迁移时刻重新开始，以避免旧塑料单输入周期按新双输入规则结算。

### 4.1 管理员玩家运营统计

`player-admin-statistics.js` 是玩家运营分析的唯一服务器模块，负责建立 `economy_player_activity_daily`、`economy_player_milestones` 与覆盖元数据表，在现有世界写事务中记录成功经济写操作、生产／成交／合同结算增量和首次里程碑，并从已迁移世界与 SQLite 聚合只读统计。分析数据不进入世界 JSON、客户端状态、状态分区或世界修订内容，读取统计不得仅因生成报表而推进世界修订。

成功经济写操作只有在业务动作成功并刷新 `lastEconomicActivityAt` 时写入日活动；失败请求、幂等重放、轮询和管理员读取不得重复计数。后台生产、成交和合同自动结算只能写入对应参与量，不得计为玩家经济活跃。分析写入与世界保存、动作幂等响应共享同一 SQLite 事务，任一步失败必须整体回滚。

管理员接口固定为 `GET /api/game/admin/player-statistics?range=7d|30d|90d`，只返回聚合快照、时间序列、留存、漏斗、经营参与、财富分布和关注群体。响应携带 `coverageStartsAt`、北京时间范围和历史完整性；覆盖前不得通过 `lastEconomicActivityAt` 反推伪造日活动或留存。接口必须再次校验管理员权限，不返回邮箱、IP 指纹、邀请码、管理员备注、逐玩家资产或订单对手。

活跃玩家数、库存价值与分析分位数仅用于运营诊断，不参与消费需求预算、稳定需求、价格传导、市场储备或排行榜。旧兼容字段 `lastPlayerScaleBudget` 与 `lastInventoryBoost` 必须保持停用和零值，不得恢复玩家规模预算或库存追加预算。

## 5. 请求安全、账号认证与 Economy 注册

- 只接受正式站点的同源或可信 same-site 请求。
- 使用主页账号 Cookie，不接受客户端自报用户 ID 或角色。
- `GET /api/game/state` 最多复用 10 秒认证结果，普通写操作最多复用 2 秒，`/api/game/admin/` 每次重新验证且不读取缓存。
- 401 只缓存 1 秒；超时、无效响应、502 和 503 不缓存，也不得使用过期结果执行资产写操作。
- 缓存键只保存完整 Cookie header 的 SHA-256 摘要，使用最多 5,000 条的 LRU。
- 同一摘要的并发未命中共享一个上游验证 Promise，并在 `finally` 中移除。
- 所有资产、邀请与管理员写操作要求 8～128 字符的 `Idempotency-Key`。
- 服务器重新校验价格、数量、资金、库存、仓库、工厂、订单归属、拍卖资产归属与冻结、合同参与者与托管、邀请码、封禁和管理员角色。
- 禁止玩家自成交；任何两个系统商品订单也必须禁止互相成交。储备买单必须验证并冻结真实储备资金，储备卖单必须验证并冻结真实储备库存。卖家不得竞拍自己的商品或工厂，玩家不得填写自己的邀请码，也不得承接自己发布的合同。
- 每名玩家最多 10 笔未完成商品／工厂订单、10 份公开合同和 20 份进行中合同。
- Nginx 游戏 API 请求体上限为 256 KB；普通 JSON 仍由应用限制为 16 KB。
- 单进程操作限流缓存每分钟清理已过期桶，并限制最多 10,000 个用户／类别桶；不得让历史用户键永久累积。

### 5.1 Economy 注册、邀请归因与同 IP 封禁

“Economy 注册完成”的准确时点是：某个统一账号第一次创建 Economy 玩家档案。任何已登录主页账号首次进入 Economy 时仍允许自动创建玩家档案，并在同一事务记录 Economy 注册 IP 指纹、邮箱、完成时间和来源；不得要求该账号再次走验证码注册。邮箱验证码注册完成接口是另一条首次建档入口，两条入口必须共用同一首次建档、邀请归因、IP 检测和记录逻辑。

主页已经完成账号信任与邮箱验证，但邮箱验证码注册和来源为 `homepage_session` 的首次建档仍统一执行注册 IP 规则。Nginx 必须覆盖并传入可信 `X-Real-IP`；应用优先使用该值，避免客户端伪造 `X-Forwarded-For` 绕过规则。只保存由服务器秘密 HMAC 生成的注册 IP 指纹，不保存或展示明文 IP。同一注册 IP 指纹出现两个或更多不同统一账号时，必须先创建或更新封禁事件，再将该指纹下全部 Economy 账号标记为封禁；封禁优先于邀请奖励。普通登录时网络变化不触发封禁，判定只读取首次建档保存的注册 IP 指纹。

封禁账号访问普通 `/api/game/` 接口返回 `423 Locked`、`ECONOMY_ACCOUNT_BANNED` 和事件编号。管理员接口仍必须在重新验证管理员角色后可访问，以便被同 IP 规则命中的管理员完成复核和解禁。管理员可以解禁单个账号或整个事件，也可以重新封禁；操作必须保留事件和审计历史。手动解禁后，服务重启不得无条件重新封禁；只有该 IP 指纹出现新的注册账号时才重新封禁整个账号组。

每名玩家拥有一个服务器生成的永久 8 位邀请码。分享链接使用 `https://game.riversoft.top/economy/?invite=邀请码`。分享链接只在首次创建 Economy 玩家档案时自动归因；有效且未被封禁的邀请关系在注册事务中立即向邀请人发放 10 宝石，被邀请人不获得宝石。已有 Economy 档案的账号访问分享链接不得补绑或重复奖励。

未通过分享链接绑定的玩家可在首次建档后 24 小时内通过设置页手动填写一次邀请码。分享链接和手动邀请码共用 `invitee_user_id` 唯一约束，一个账号只能绑定一个邀请人。相同注册 IP 的邀请关系可以记录为 `blocked_same_ip`，但不得发放宝石，也不得改绑其他邀请人。重置经济状态不得清除宝石、邀请码、邀请关系、宝石流水、封禁或解禁历史。

### 5.2 邮箱验证码

- `economy_email_verifications` 保存请求幂等键、邮箱、验证码 HMAC、IP 指纹、有效期、错误次数、投递状态、使用状态和完成账号；不得保存验证码明文。
- `economy_registrations` 以统一账号 ID 为主键，保存首次玩家档案创建时的邮箱、注册 IP 指纹、完成时间和来源。
- `economy_invite_codes`、`economy_invitation_relations`、`economy_gem_ledger`、`economy_gem_shop_exchanges`、`economy_ip_ban_incidents`、`economy_ip_ban_members`、`economy_account_bans` 与 `economy_ban_audit` 是邀请、宝石兑换和封禁的权威业务表。
- 生成验证码记录和调用 Resend 前，Economy 必须通过主页账号服务仅限同机回环的 `POST /api/internal/account-email-exists` 查询邮箱是否已经注册。已注册邮箱返回 `409` 和“该邮箱已注册，请直接登录”，不得创建 `economy_email_verifications` 记录，也不得发送邮件；查询失败时返回统一账号服务不可用，不得绕过查重继续投递。
- 验证码固定为 6 位数字，有效期 10 分钟；同一邮箱或同一 IP 指纹 60 秒内禁止再次发送。
- 验证码错误 5 次后状态变为不可用；过期、已使用或作废验证码不能重复使用。
- 验证码终态记录保留 30 天；注册请求触发的清理任务最多每小时执行一次，先将已过期的 `pending`／`sent` 标记为 `expired`，再删除超过保留期的 `failed`、`expired`、`invalid` 和 `used` 记录。未过期活动验证码和永久注册记录不得删除。
- 发送 IP 和提交 IP 的指纹必须一致，否则拒绝完成注册。
- 发送与完成接口都要求 `Idempotency-Key`；同一完成请求重试只能返回同一个统一账号、玩家档案、邀请关系和宝石结果，不得重复创建或发放。
- `server/src/email.js` 只使用 Resend HTTP API，超时固定 8 秒，并向 Resend 发送稳定幂等键。
- 生产日志不得打印验证码、`RESEND_API_KEY`、注册秘密、注册 IP 明文或邮件请求正文。
- 统一账号创建顺序为先调用主页 `/api/register`；邮箱已存在时再调用 `/api/login`。成功响应的会话 Cookie 转发给 Economy 浏览器会话。
- 生产验证码投递必须同时配置 `RESEND_API_KEY` 与 `EMAIL_FROM`。`EMAIL_FROM` 是唯一正式发件人变量名，不使用旧名称。缺少任一项时接口返回 `424` 和“邮箱验证码服务未配置，请联系管理员”，不得把配置缺失伪装成整个游戏服务器故障；Resend 超时、拒绝或无效响应继续返回通用 `503`，不得向客户端泄露供应商响应正文。

## 6. 注册与游戏 API

注册公网前缀 `/economy-api/registration/`，内部前缀 `/api/registration/`。

| 方法 | 公网路径 | 内部路径 | 用途 |
|---|---|---|---|
| POST | `/economy-api/registration/email-code` | `/api/registration/email-code` | 发送邮箱验证码 |
| POST | `/economy-api/registration/complete` | `/api/registration/complete` | 校验验证码、统一账号、邀请链接、同 IP 规则并首次建档 |

游戏公网前缀 `/economy-api/game/`，内部前缀 `/api/game/`。

| 方法 | 内部路径 | 用途 |
|---|---|---|
| POST | `/api/game/session` | 已登录账号首次建档、分享链接归因与封禁状态初始化 |
| GET | `/api/game/state` | 获取六分区初始状态、增量补丁或带 `serverNow` 的修订号轻量确认 |
| GET | `/api/game/invitations` | 获取宝石余额、邀请码、分享链接和邀请统计 |
| POST | `/api/game/invitations/claim` | 注册后 24 小时内手动填写邀请码 |
| GET | `/api/game/gem-shop` | 获取服务器汇率、兑换边界、累计与最近记录 |
| POST | `/api/game/gem-shop/exchange` | 原子扣除宝石并增加普通货币 |
| GET | `/api/game/community-link` | 获取侧边栏社区跳转链接 |
| POST | `/api/game/work` | 工作 |
| POST | `/api/game/facilities` | 建设工厂 |
| POST | `/api/game/facilities/:facilityTypeId/start` | 开启工厂集群 |
| POST | `/api/game/facilities/:facilityTypeId/pause` | 停止工厂集群 |
| POST | `/api/game/facilities/:facilityTypeId/recipe` | 设置当前或下一周期配方 |
| POST | `/api/game/orders` | 创建商品或工厂订单 |
| POST | `/api/game/orders/:orderId/cancel` | 撤销订单 |
| POST | `/api/game/warehouse/upgrade` | 扩容仓库 |
| POST | `/api/game/gifts/redeem` | 兑换礼品 |
| POST | `/api/game/auctions` | 以 `items[]` 创建单项或捆绑资产包拍卖 |
| POST | `/api/game/auctions/:auctionId/bids` | 对整个资产包竞价 |
| POST | `/api/game/auctions/:auctionId/cancel` | 取消无出价资产包拍卖 |
| POST | `/api/game/contracts` | 发布长期采购或供应合同 |
| POST | `/api/game/contracts/:contractId/accept` | 承接合同并冻结首批货款与双方保证金 |
| POST | `/api/game/contracts/:contractId/cancel` | 取消本人尚未承接的公开合同 |
| POST | `/api/game/contracts/:contractId/prepare` | 供应方手动准备本批商品 |
| POST | `/api/game/contracts/:contractId/fund` | 采购方手动补充本批货款 |
| POST | `/api/game/contracts/:contractId/auto-reserve` | 设置供应方自动准备 |
| POST | `/api/game/contracts/:contractId/auto-fund` | 设置采购方自动补款 |
| POST | `/api/game/contracts/:contractId/request-termination` | 申请当前批次完成后结束 |
| POST | `/api/game/contracts/:contractId/terminate-now` | 立即违约终止并赔付保证金 |
| ANY | `/api/game/collectible-auctions*` | 已永久移除；固定返回 `410 Gone`，不得读取或写入业务状态 |
| ANY | `/api/game/admin/collectibles*` | 已永久移除；固定返回 `410 Gone`，不得读取或写入业务状态 |
| PATCH | `/api/game/profile` | 修改昵称 |
| POST | `/api/game/reset` | 已永久移除；兼容旧客户端固定返回 `410 Gone`，不得执行任何状态写入 |
| GET | `/api/game/admin/community-link` | 管理员读取社区跳转链接 |
| PUT | `/api/game/admin/community-link` | 管理员幂等更新社区跳转链接 |
| GET | `/api/game/admin/bans` | 管理员查看同 IP 封禁事件 |
| GET | `/api/game/admin/bans/:incidentId` | 管理员查看事件成员 |
| POST | `/api/game/admin/bans/users/:userId/unban` | 管理员解禁单个账号 |
| POST | `/api/game/admin/bans/:incidentId/unban-all` | 管理员解禁事件全部账号 |
| POST | `/api/game/admin/bans/users/:userId/reban` | 管理员重新封禁账号 |

旧工厂固定挂牌路由只作迁移兼容。旧 `/api/game/facilities/:facilityTypeId/plan` 返回 `410 Gone`，不得恢复生产模式或目标产量。

人口饮食需求以 `world.demandGroups.staples` 为唯一预算周期状态，每周期最多承诺 330，在食品、小麦、水稻、肉、蛋和奶间按卖盘深度、效用、偏好和预算上限分配。六种商品不得生成独立人口订单，满足率按效用计算。棉花、毛、铜矿石、铜材和纺织品只保留基础流动性，不生成独立人口消费；家具和服装共享 `household-goods` 固定预算。

### 6.1 商店事务

商店固定使用 1 宝石兑换 10 普通货币，单次接受 1～100 的整数宝石。`POST /api/game/gem-shop/exchange` 必须先通过封禁检查和普通写操作限流，并要求 `Idempotency-Key`。在一个 `BEGIN IMMEDIATE` 事务中完成宝石余额校验、扣除宝石、增加可用资金、普通货币账本写入、`economy_gem_shop_exchanges` 插入、世界修订号更新和精简幂等确认保存；任一步失败全部回滚。

`GET /api/game/gem-shop` 只返回服务器固定汇率、当前余额、累计值和最近 20 笔兑换。客户端预览不得成为结算依据。相同幂等键重试返回第一次精简确认，不重复扣除或发行；不同路径复用幂等键继续返回冲突。

### 6.2 社区入口配置

QQ群入口与经济世界快照分离，保存在 `economy_settings`，修改链接不得推进世界修订号。默认地址为 `https://qm.qq.com/q/eN8hya0Yn0`；普通已登录玩家可以读取，只有管理员可以写入。写接口要求 `Idempotency-Key`，并只接受长度不超过 2048、无账号信息的 HTTPS URL，避免脚本协议、明文 HTTP 和带凭据地址进入侧边栏。

### 6.3 长期生产合作合同事务

`server/src/contracts.js` 是长期合同的唯一权威实现。合同只允许服务器正式商品和普通货币，不接受其他资产类型、工厂所有权、工厂出租、指定工厂实例、自由文本或对方配方控制。发布方向可以是长期采购或长期供应；条款只包含商品、每批数量、单位价格、交付周期、总批次和首次交付延迟。

承接时采购方冻结首批完整货款和单批货款 20% 的履约保证金，供应方冻结同额保证金。供应方商品和采购方货款按当前批次托管；自动准备只能冻结当前可用库存，自动补款只能冻结当前可用资金，不能透支未来产量或未来收入。

正式世界处理先结算到期生产周期，再执行合同自动准备、到期结算和宽限期终止。每批结算在一个事务中同时检查供应方冻结商品、采购方冻结货款和采购方仓库空间，然后原子转移整批商品、扣除整批货款、支付扣费后收入并推进批次。任一条件不足不得部分交付，并进入宽限期；宽限结束后由责任方保证金赔付对方。

合同交付不得写入统一订单簿、最近真实成交价、市场价格历史、商品或工厂估值以及交易排行榜。卖方合同货款按单份合同累计成交额精确收取 1% 市场服务费，并沿既有市场服务就业规则进入人口钱包。合同状态、交付时间、宽限期与违约只能由服务器权威时间判定。

## 7. 容量与客户端交付

正式客户端默认每 5 秒轮询一次修订号，可选 3／5／10 秒，不得恢复每 1 秒完整状态轮询。客户端根游戏模型不得维护每秒 `now` 状态；倒计时与进度只在概览、生产、拍卖和合同等实际需要时间变化的局部页面维护，市场订单簿、资产页、导航和静态卡片不得被全局秒级时钟重渲染。每次 `GET state` 的顶层 `serverNow` 用于向前校准共享单调服务器时钟，局部倒计时只叠加该响应在当前浏览器接收后的单调经过时长；迟到或较旧响应不得让时钟回退。`lastProcessedAt` 只作为世界最后保存时间和旧响应兼容回退值，不得在每次轮询时重新建立本地时钟，也不得直接以客户端墙上时间替代服务器时间。管理员入口、游戏入口和九个游戏页面必须使用动态 `import()` 按需拆包。只有 `GET state` 的分区交付响应可以更新 `EconomyState` 和客户端已接受修订号；动作确认不直接更新界面状态，其 `revision` 只用于校验随后补拉的状态不得落后。低修订号或缺少修订号的迟到状态响应不得覆盖新状态。

发起任一权威动作时必须使用 `AbortController` 取消正在进行的状态轮询，并在动作确认与紧随其后的状态补拉完成前暂停新轮询。工作动作必须在请求发出时同步进入本地“处理中”状态、立即禁用按钮并阻止重复提交；资产仍以补拉后的服务器分区状态为准。动作确认成功而状态补拉失败时，必须保留成功结果并恢复后续轮询，不得提示用户操作未提交或自动重复写操作。

优先级：

1. 登录、注册、封禁检查、邀请奖励、资产、冻结、生产、订单、成交、拍卖和合同结算；
2. 系统需求与公共市场；
3. 排行榜、长周期图表和公开统计。

资源不足时宁可拒绝写操作，也不能产生负库存、重复发放、重复扣款、重复邀请奖励、重复合同交付或超额成交。资产包拍卖必须先预检全部 `items[]` 再冻结，并在结算前再次验证全部归属、冻结资金、商品仓库和工厂数量；任一项目失败时回滚整包。合同必须先预检双方、首批货款、双方保证金、商品与仓库容量，再进入进行中状态；任一批次失败不得部分转移。总资产只从资金、库存和工厂归属等权威余额派生，拍卖和合同托管记录不得重复计价。

## 8. Node、systemd 与部署权限

- GitHub Actions 固定使用 Node 24.4.0 构建和测试；根依赖必须使用精确版本并提交 `package-lock.json`，CI 和 Deploy 均启用 `setup-node` 的 npm 下载缓存但仍固定使用 `npm ci`，不得恢复 `latest`、范围依赖或无锁安装。
- Pull Request 只由 `.github/workflows/ci.yml` 执行完整 `npm run build` 与 Chromium 浏览器测试，不保留第二个重复的 PR Web Build 工作流；同一 PR 的旧 CI 在新提交到达后必须自动取消。
- `main` 分支由 `.github/workflows/deploy.yml` 对实际待部署提交重新执行 `npm ci`、`npm run build`、固定 Chromium 安装和 `npm run test:browser`；构建与浏览器回归都成功后才允许上传、安装并执行线上验证。
- 浏览器运行时测试使用固定 Playwright 版本与 Chromium，至少覆盖 localStorage 拒绝访问仍能渲染、正式设置控件存在以及无效设置控件不存在；测试 artifact 只在失败时上传并保留 3 天，完整标准输出继续保存在 Actions job log。
- 部署中的每个 shell 命令步骤必须把标准输出和标准错误保存到独立临时日志；任一步失败时只把该失败步骤的完整命令输出复制到 `economy-deploy-failure-<run>-<attempt>` Artifact，成功步骤日志不得上传。Artifact 保留 3 天并使用文本高压缩；完整失败输出不得依赖可能被截断的 job log，也不得再为单次构建失败创建临时诊断工作流。
- 部署工作流只在运行器缺少 `rsync` 时执行 APT 安装，不得每次无条件更新软件包索引。
- 部署包携带匹配架构的官方 Node 运行时。
- 服务端 Node 最低版本 `22.16.0`，必须支持 `node:sqlite`；构建工具链固定在 Node 24.4.0。
- systemd 首选可执行文件：`/var/www/game/economy-api/runtime/bin/node`。
- systemd 服务单元固定为 `riversoft-economy-api.service`。
- 服务不得以 root 运行。
- 安装脚本在 `/var/lib/riversoft-economy/registration-secret` 首次生成持久注册 HMAC 秘密，权限固定为服务用户 `0600`，部署不得覆盖。该秘密同时用于验证码、邀请码确定性生成和注册 IP 指纹。
- systemd 先加载共享 `/etc/riversoft-email.env`，再加载 `/etc/riversoft-economy-api.env`。共享文件先加载，Economy 专用文件后加载；专用文件中的同名变量可以覆盖共享值。
- 两个环境文件均为可选，但运行进程最终必须同时具有非空 `RESEND_API_KEY` 与 `EMAIL_FROM` 才能标记验证码可用；文件不得提交到仓库或打印到日志。
- 邮件密钥只保存在服务器。GitHub Actions 不保存、不上传也不改写 `RESEND_API_KEY` 或 `EMAIL_FROM`。
- `.github/workflows/configure-registration-email.yml` 在主部署成功后运行。主部署已负责重写 systemd 单元并重启服务；邮件配置工作流不得再次读取 root-only 环境文件或重启服务。
- 配置工作流必须以服务用户读取运行进程的 `/proc/<pid>/environ`，只验证 `RESEND_API_KEY` 与 `EMAIL_FROM` 是否非空，不得输出变量值，并写回 `deploy/economy-email` 提交状态。

```text
WorkingDirectory=/var/www/game/economy-api
PORT=3002
ECONOMY_DB_PATH=/var/lib/riversoft-economy/economy.sqlite
ECONOMY_REGISTRATION_SECRET_FILE=/var/lib/riversoft-economy/registration-secret
ACCOUNT_SERVICE_URL=http://127.0.0.1:3001
ACCOUNT_SERVICE_HOST=riversoft.top
ACCOUNT_AUTH_STATE_CACHE_TTL_MS=10000
ACCOUNT_AUTH_WRITE_CACHE_TTL_MS=2000
ACCOUNT_AUTH_NEGATIVE_CACHE_TTL_MS=1000
ACCOUNT_AUTH_CACHE_MAX_ENTRIES=5000
PUBLIC_ORIGIN=https://game.riversoft.top
```

GitHub Actions 使用 `SERVER_USER=deploy`，Economy systemd 服务也使用该账号。`deploy` 只能通过白名单完成发布、systemd 和 Nginx 操作；不得扩大为 root 服务或把数据库移入发布目录。

## 9. Nginx 与验收

账号路由和游戏 API 路由分别位于：

```text
/etc/nginx/snippets/game-riversoft-economy-account.conf
/etc/nginx/snippets/game-riversoft-economy-game-api.conf
```

注册路由由 `scripts/configure-economy-registration-nginx.py` 幂等加入正式 HTTPS `server`：

```text
/economy-api/registration/ → 127.0.0.1:3002/api/registration/
```

部署脚本必须识别已有 snippet 和手工路由，只补缺失部分。

- 不得在账号 snippet 已存在时再次生成同名账号 `location`。
- 不得在游戏 API snippet 或手动游戏路由已存在时再次生成 `/economy-api/game/`。
- 不得在手动注册路由已存在时再次生成 `/economy-api/registration/`。
- 连续执行两次，第二次不得产生配置变化。
- 游戏 API `client_max_body_size` 固定为 `256k`；注册 API 固定为 `16k`。

大于 1 KB 的 `application/json` 响应启用 gzip：`gzip_vary on`、`gzip_proxied any`、`gzip_types application/json`、压缩级别 5。部署脚本必须修补既有游戏 API snippet 或手工 `location`，不得只对新安装生效。

修改 Nginx 前保留回滚配置；修改后执行 `nginx -t`，成功才 reload，失败立即恢复。

`npm run build` 必须执行设计与架构验证、Nginx 测试、服务器语法和测试、TypeScript 与 Vite 构建。CI 和主部署都必须安装固定 Chromium 并执行 `npm run test:browser`；应用根节点必须由错误边界包裹，意外渲染异常只能显示可恢复页面，不得留下空白屏。主部署后验证 API 健康、静态网页、账号代理、注册代理、未登录 401、systemd 用户／端口／数据库、注册秘密和无重复路由；邀请专项验收必须覆盖分享链接即时奖励、手动邀请码唯一绑定、同 IP 全组封禁、423 响应和管理员解禁。邮件配置工作流另行验证运行进程实际环境和服务健康，并以 `deploy/economy-email` 独立状态防止主部署误报验证码可用。

## 9.1 验证策略

固定文案、禁止导入和样式入口可以使用源码字符串检查；交易估值、状态缓存快路径、资产比例、虚拟列表可视区间和本地日志持久化等行为不得仅靠 `includes()` 证明。核心规则必须至少由以下一种方式验证：服务器／浏览器行为测试、可直接执行的纯函数测试或 TypeScript 语法 token／AST 结构检查。注释、死代码或同名字符串不得让核心行为测试通过；变量改名和格式化也不得无意义破坏验证。

页面拆包验证必须通过 TypeScript 语法 token／AST 确认 `App.tsx` 与 `PageRouter.tsx` 使用动态 `import()` 且不存在对应页面静态导入。全局秒级时钟、虚拟列表二分区间和 `requestAnimationFrame` 合并滚动同样由语法结构或可执行纯函数验证；设计脚本只保留必要的固定文案和防回退禁词。

## 9.2 固定压力测试账号池

- `tests/stress/accounts.json` 是压力测试普通玩家身份的唯一仓库记录，固定保存 24 个槽位 `stress-player-01`～`stress-player-24` 及对应 `economy-stress-01@riversoft.top`～`economy-stress-24@riversoft.top` 邮箱。
- 这些账号只需在主页账号服务中预置一次；后续压力测试必须按槽位复用，不得默认调用注册接口、生成随机邮箱或在每轮测试后删除账号。需要超过 24 个并发身份时，必须先扩展清单、验证唯一性并完成一次性预置。
- 仓库不得保存密码、Cookie、Token、Session 或管理员身份。运行时密码只从 `ECONOMY_STRESS_TEST_PASSWORD` 环境变量读取；测试日志、错误输出和 CI artifact 均不得打印该值。
- `tests/stress/loadAccounts.mjs` 是 Node 压力测试脚本读取账号池的统一入口，支持按稳定顺序、`offset` 和 `limit` 选择槽位。账号池只提供登录身份，不改变经济资产、封禁、邀请或排行榜规则。
- 固定账号必须保持普通玩家角色，不得借压力测试账号绕过主页账号认证、同 IP 规则、写操作幂等或 Economy 服务器资产校验。

## 10. 防回退

不得恢复：

- 浏览器本地存储作为正式资产；
- 服务器持久化展示日志；
- 单座工厂模型、固定价格工厂市场或定量生产；
- 连续工作递增冷却；
- API 公网监听、root 运行或部署覆盖数据库；
- 空闲读取或管理员摘要无变化时写库、同修订号轮询进入 SQLite 事务、每次轮询解析／序列化完整世界、修订变化时无条件上传完整状态、把变化分区浅合并进旧完整状态、在客户端或服务器重新硬编码独立客户端状态版本、把版本不兼容误报为初始分区缺失、服务器省略字段后客户端仍保留旧值、动作响应附带完整状态／分区补丁／分区修订／`unchanged`／`serverNow`／内部结算字段、动作幂等缓存保存完整客户端状态、补拉前把动作确认修订号写成已接受修订号、排行榜原型钩子重复处理、每秒完整状态轮询或迟到响应覆盖新状态；
- 省略 `GET state` 轻量确认中的 `serverNow`、把 `serverNow` 写入世界 JSON 或六分区、让时间校准推进世界修订号，或在每次轮询时用旧 `lastProcessedAt` 重新开始倒计时；
- 权威动作与旧轮询并行更新界面，或动作确认后不立即补拉分区状态；
- 把动作确认后的状态补拉失败改写成动作失败、自动重试写操作或重复扣款；
- 把合同交付写入订单簿行情、估值或交易排行榜，允许合同涉及其他资产类型、工厂转移、工厂出租、自由文本或配方控制，或由客户端判定交付、宽限期和违约；
- 玩家经济状态重置、清空进度或重新开始接口；
- 原始 Cookie 缓存、管理员认证缓存或超过 5,000 条 LRU；
- 永久保留失效验证码、让操作限流 Map 无边界增长、恢复浮动依赖或删除依赖锁；
- 删除 CI 或主部署中的 Chromium 浏览器运行时测试、localStorage 拒绝访问覆盖或顶层错误边界；
- 压力测试重新随机注册账号、把测试账号密码或会话写入仓库、让账号池包含管理员身份，或绕过 `tests/stress/accounts.json` 与 `loadAccounts.mjs` 的固定槽位；
- 恢复与 CI 或 Deploy 重复执行完整构建的独立 `web-build.yml`、关闭同一 PR 旧运行自动取消，或在成功时长期上传浏览器测试 artifact；
- 删除游戏 JSON gzip；
- 让任何模块绕过 `domain.js` 直接导入 `domain-core.js`；
- 让 `balanced-market.js` 或 `market-liquidity.js` 维护第二套商品数值；
- 绕过统一商品撮合层处理玩家订单、允许系统订单彼此成交、创建无真实资金／库存支持的储备订单，或在模型 4 初始化后重复补发储备资产；
- 在商品、工厂或人口需求撮合引擎内分别维护不同费率、对每条 fill 重复收最低手续费、重复成交再次扣费、追收历史成交、公开卖单累计字段或让拍卖调用 `applyMarketSellFee`；
- 恢复旧商品参考价、旧农场参数、食品独立需求、60 预算旧主食需求或按件数计算满足率；
- 在登录 401 后自动调用主页注册接口；
- 保存验证码、注册 IP 明文或邀请人隐私信息，跳过 10 分钟有效期／60 秒重发／错误 5 次作废、允许验证码复用或允许发送与提交 IP 不一致；
- 让邮箱验证码入口和主页已登录自动建档维护两套首次建档、邀请归因或 IP 检测逻辑；
- 恢复主页账号共享注册 IP 的例外，或只封禁新账号而保留同 IP 旧账号可用；
- 在同 IP 封禁检查之前发放邀请宝石；
- 允许一个被邀请账号绑定多个邀请人、重置后重新领取、客户端决定奖励或把宝石计入总资产；
- 管理解禁删除事件与审计历史、服务重启立即推翻人工解禁，或解禁后自动补发被拦截的邀请奖励；
- 删除 `/economy-api/registration/` Nginx 路由或打印验证码、Resend API Key 与注册秘密；
- 把邮件密钥复制到 GitHub Actions，或让部署工作流覆盖服务器已有邮件配置；
- 删除 `/etc/riversoft-email.env` 的共享加载，颠倒共享文件与 Economy 专用文件的覆盖顺序，或让邮件配置工作流读取并打印环境文件内容；
- 在缺少 `RESEND_API_KEY` 或 `EMAIL_FROM` 时仍把部署标记为验证码可用，或把明确的邮件配置缺失重新改写成整个游戏服务器不可用；
- 把正式发件人变量从 `EMAIL_FROM` 改回其他名称。
- 恢复 `server/src/collectibles.js`、`src/collectibles/`、`CollectionsPage`、`collections` 路由、管理员艺术资产分区或活动态 `collectible` 拍卖类型；
- 让旧 `/api/game/collectible-auctions*` 或 `/api/game/admin/collectibles*` 路径返回成功、隐藏数据或兼容业务；这些墓碑路径必须固定返回 `410 Gone`；
- 在没有世界 15 数据库快照与 `PRAGMA quick_check` 成功结果时上传新服务，或将含旧艺术资产项目的开放资产包删项后继续竞价。

未更新设计文档的架构回退不应合并。未更新防回退检查的架构变更同样不应合并。

## 普通玩家订单序列化边界

世界 JSON 内部保留完整撮合信息；普通玩家 API 必须通过单一公开订单序列化函数输出匿名视图。该函数删除所有订单的真实所有者、人口需求字段和 `marketSellFeeVersion / marketSellFeeGross / marketSellFeeCharged`，只为本人订单返回匿名 fills，并删除其他订单 fills。本人 fill 可以返回 `fee` 与 `netTotal`，但不得借此返回对手、maker/taker 订单 ID 或需求来源。管理员审计若需要真实对手信息必须使用独立管理员接口，不得复用普通玩家 DTO。

当前客户端状态版本为 17，本地活动存储保持 v5，世界状态版本为 15，市场需求模型版本为 9；手续费迁移、储备迁移与资产拍卖删除迁移都不得重置纯商品／工厂资产、玩家订单或既有订单簿成交，储备种子只允许初始化一次。

## 市场需求模型 10 迁移与运行顺序

- 权威状态使用 `marketDemand.modelVersion = 9`。模型升级时取消旧系统商品订单，释放市场储备冻结资金和冻结库存，不重复补发储备资产。
- 每组五分钟处理顺序固定为：结算上一周期全部消费成交与积压 → 更新服务得分和预算 → 更新类别与商品分配 → 生成派生需求 → 发布三档消费买盘 → 应用单商品与需求组价值上限 → 更新双向商品压力 → 撤销并重挂市场储备订单。
- 预算成交活跃度只读取 `marketRole = player` 的玩家间真实成交；消费需求、储备成交和合同交付不得形成系统自我放大。
- 没有近七天经济活跃玩家时消费预算为 0；服务器仍需释放旧储备冻结并保持资产守恒。
- 模型 9 迁移在当前世界版本 15、客户端状态版本 17 下继续保持玩家资产、玩家订单、成交历史与生产边滞后信号不变。

## 人口经济与货币事务

`server/src/population-economy.js` 是三类人口钱包、整数就业分配、施工进度释放、收入 EMA、五档消费状态、真实人口订单冻结和管理员摘要的唯一实现。人口经济内部版本固定为 4，运行时状态只允许 `lavish | prosperous | normal | strained | subsistence`；旧 `cautious` 只允许在版本迁移时映射为 `strained`。市场需求模型 10 必须遵守：

- 工作每次有效点击和商店兑换继续直接发行普通货币，不使用准备金，也不根据通胀自动调整；
- 生产周期成本、建造费、仓库扩容费、玩家卖出手续费和合同服务费只转移已有货币到人口；
- 建造业固定 60%／30%／10%，不得读取工厂复杂度改变比例；生产岗位按 C1～C7 分配；
- 人口消费不得发行普通货币，必须从真实 `credits` 转入 `frozenCredits` 后结算；
- 五档状态只重新分配食品／家庭与类别份额，不得改变周期总预算公式、稳定需求发行、直接／派生资金池比例或订单冻结约束；
- 状态判定必须使用收入健康度、基础收入覆盖和自动稳定补充前的钱包覆盖；近期峰值按当前收入 EMA 与 92% 衰减旧峰值取大，不得使用单周期原始收入尖峰；
- 奢靡和繁荣分别需要连续 3／2 个合格周期，失去上档资格连续 2 个周期后逐级下降；收入健康度低于 65%／35% 或连续两个周期无收入时必须立即进入拮据／生存；
- 不存在人口侧税费、回收、余额衰减、储蓄过期或货币总量控制；
- `populationModelId` 和 `fundingPool` 必须由单一公开订单序列化函数删除；
- 世界版本 15、客户端状态版本 17、市场需求模型 10 的迁移只执行一次人口启动发行，旧施工费不得追溯补发；
- `issued` 只用于工作、兑换、礼品、管理员和迁移发行；就业与人口消费使用 `income`／`transferred` 统计。

管理员 `/api/game/admin/summary` 在同一世界事务返回只读人口经济摘要，并返回消费状态、状态原因、持续周期、收入健康度、基础收入覆盖和状态判定钱包覆盖；玩家市场状态不得包含管理员人口指标。
