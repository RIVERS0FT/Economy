# Economy 多商品产业与工厂集群设计

> 状态：当前商品、工厂数量资产、统一生产周期与工厂交易设计基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-12  
> 客户端状态版本：`version: 8`  
> 世界状态版本：`version: 4`

详细工厂集群与市场输入规则以 `docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md` 为准；页面归属以 `docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为准；仓库等级以 `docs/WAREHOUSE_EXPANSION_DESIGN.md` 为准。

## 1. 不可回退决策

- 工厂资产按类型和数量保存，不存在单座工厂实例、实例 ID 或实例列表。
- 每种 `facilityTypeId` 只有一个工厂集群。
- 同类工厂共享统一状态、进度、生产计划和启停操作。
- 新建或收购的数量在运行中集群的下一周期加入，不重置当前进度。
- 同类未挂牌工厂只能统一启动或统一停止；挂牌工厂不参与生产。
- 工厂产成品直接进入共享仓库，不存在内部商品、内部容量或领取操作。
- 玩家持有工厂数量不设上限，不存在设施槽位。
- 同一玩家同时只能施工一座工厂。
- 持续生产与定量生产都作用于整个集群。
- 定量计划不得超产；数量变化导致剩余目标不兼容时暂停并要求重新确认。
- 工厂市场以类型、数量和单座价格进行交易。
- 不同商品订单不得互相撮合。
- 服务器不持久化玩家活动日志。

## 2. 商品目录

| ID | 名称 | 分类 | 初始参考价 |
|---|---|---|---:|
| `grain` | 粮食 | 原料 | 6 |
| `timber` | 木材 | 原料 | 7 |
| `ore` | 铁矿石 | 原料 | 8 |
| `crude-oil` | 原油 | 原料 | 10 |
| `flour` | 面粉 | 中间产品 | 13 |
| `lumber` | 木板 | 中间产品 | 16 |
| `steel` | 钢材 | 中间产品 | 20 |
| `plastic` | 塑料 | 中间产品 | 30 |
| `food` | 食品 | 消费品 | 18 |
| `furniture` | 家具 | 消费品 | 38 |
| `machinery` | 机械 | 工业品 | 45 |
| `electronics` | 电子产品 | 工业品 | 72 |

正式目录固定由服务器提供，当前基线为 12 种商品。商品 ID 必须唯一，已有 ID 不得重命名或复用。扩展目录时，旧存档必须自动补齐零库存、市场价格历史和基础买卖流动性，不得重置既有资产。

## 3. 工厂目录

| ID | 工厂 | 输入 | 输出 | 周期 | 单座周期成本 | 建造费 | 施工时间 | 单座系统估值 |
|---|---|---|---|---:|---:|---:|---:|---:|
| `farm` | 农场 | 无 | 2 粮食 | 30 秒 | 1 | 60 | 5 分钟 | 80 |
| `logging-camp` | 伐木场 | 无 | 2 木材 | 32 秒 | 1 | 65 | 5 分钟 | 85 |
| `mine` | 矿场 | 无 | 2 铁矿石 | 35 秒 | 1 | 70 | 5 分钟 | 90 |
| `oil-field` | 油田 | 无 | 2 原油 | 42 秒 | 2 | 95 | 7 分钟 | 120 |
| `mill` | 面粉厂 | 2 粮食 | 1 面粉 | 40 秒 | 2 | 100 | 8 分钟 | 130 |
| `sawmill` | 锯木厂 | 2 木材 | 1 木板 | 45 秒 | 2 | 115 | 8 分钟 | 150 |
| `steelworks` | 钢铁厂 | 3 铁矿石 | 1 钢材 | 50 秒 | 3 | 140 | 10 分钟 | 180 |
| `refinery` | 炼油厂 | 2 原油 | 1 塑料 | 65 秒 | 4 | 185 | 12 分钟 | 240 |
| `food-factory` | 食品厂 | 2 面粉 | 3 食品 | 45 秒 | 3 | 160 | 10 分钟 | 210 |
| `furniture-factory` | 家具厂 | 2 木板 | 2 家具 | 60 秒 | 4 | 210 | 12 分钟 | 275 |
| `machine-factory` | 机械厂 | 2 钢材 | 1 机械 | 90 秒 | 6 | 240 | 15 分钟 | 320 |
| `electronics-factory` | 电子工厂 | 2 塑料 | 1 电子产品 | 110 秒 | 8 | 320 | 18 分钟 | 420 |

当前基线为 12 种工厂类型。每种工厂输出必须引用正式商品目录；加工工厂的输入也必须引用正式商品目录。新增商品不得成为没有生产来源的孤立商品，新增加工或终端工厂不得引用不存在的原料。当前配方模型仍为“零种或一种输入、一种输出”。

目录由服务器 `PRODUCT_CATALOG` 和 `FACILITY_TYPE_CATALOG` 提供。客户端不得维护另一套正式配方、周期、成本或估值。

## 4. 工厂集群状态

服务器持久化 `facilityGroups`：

```ts
interface FacilityGroup {
  facilityTypeId: string;
  count: number;
  participatingCount: number;
  pendingJoinCount: number;
  status: 'ready' | 'running' | 'paused' | 'full'
    | 'insufficient_funds' | 'insufficient_input' | 'listed';
  stopReason?: 'manual' | 'plan_complete' | 'plan_adjustment_required'
    | 'insufficient_funds' | 'insufficient_input' | 'output_full'
    | 'listed' | 'maintenance';
  cycleStartedAt?: number;
  productionMode: 'continuous' | 'target';
  targetQuantity?: number;
  completedQuantity: number;
}
```

客户端补充 `listedCount`、`availableCount` 和 `nextCycleCount`。

`EconomyState` 和 SQLite 世界 JSON 不得保存 `facilities` 单座数组。

## 5. 建设与下一周期加入

施工任务单独保存：

```ts
interface FacilityConstruction {
  facilityTypeId: string;
  startedAt: number;
  completesAt: number;
}
```

施工完成时：

- 集群停止：直接增加 `count`，保持待启动或停止。
- 集群运行：增加 `count` 和 `pendingJoinCount`。
- 当前周期仍按旧 `participatingCount` 结算。
- 当前周期完成后，待加入数量并入下一周期。
- 不重置统一进度，不产生部分周期产出。

市场收购数量使用同一加入规则。

## 6. 统一周期结算

```text
周期产量 = 单座周期产量 × participatingCount
周期成本 = 单座周期成本 × participatingCount
周期原料 = 单座原料 × participatingCount
净仓库增长 = max(0, 周期产量 - 周期原料)
```

完整周期在一个 SQLite 事务中：

1. 检查共享仓库、资金、原料和计划；
2. 扣除整个集群成本；
3. 扣除整个集群原料；
4. 产成品直接进入共享仓库；
5. 更新计划完成量；
6. 推进统一周期；
7. 在周期边界加入 `pendingJoinCount`。

资源不足时整个集群停止，不允许只让一部分工厂继续生产。

加工集群可以利用同周期原料消耗释放仓库空间：

```text
netStoragePerCycle = max(0, groupOutput - groupInput)
```

## 7. 统一启停

启动和停止以 `facilityTypeId` 为目标：

```text
POST /api/game/facilities/:facilityTypeId/start
POST /api/game/facilities/:facilityTypeId/stop
```

启动后全部未挂牌数量统一参与。停止前结算服务器时间上已经完成的完整周期，未完成周期作废且不扣费、不扣原料、不产出。

存在挂牌数量时，该类型集群仍可按 `availableCount = count - listedCount` 启动未挂牌数量。挂牌工厂不参与生产；运行中撤销挂牌的数量进入 `pendingJoinCount`，从下一周期加入。

## 8. 统一生产计划

- 持续生产运行到手动停止或阻塞。
- 定量目标必须是当前集群周期产量的整数倍。
- 达到目标后停止，原因为 `plan_complete`。
- 修改计划前必须先停止集群。
- 新数量下一周期加入后，如剩余目标无法被新周期产量整除，集群暂停，原因为 `plan_adjustment_required`。
- 不允许超产或让部分工厂单独生产。

## 9. 批量离线结算

服务器按完整周期批量结算，不逐秒模拟。可执行周期数受以下最小值约束：

```text
已经过完整周期
资金允许周期
原料允许周期
共享仓库允许周期
计划剩余允许周期
单次安全上限
```

若存在待加入数量，先按旧参与数量结算一个跨越加入边界的周期，再按新参与数量结算后续周期。

## 10. 工厂数量交易

挂牌记录保存：

```ts
facilityTypeId: string;
quantity: number;
unitPrice: number;
```

规则：

- 新增挂牌时集群必须停止；
- 挂牌数量不能超过未挂牌数量；
- 挂牌数量不参与生产，但不阻止未挂牌数量启动；
- 运行中撤销挂牌的数量从下一周期加入；
- 单价为单座价格，范围为单座系统估值 50%～200%；
- 相同卖家、类型和单价可合并数量；
- 购买可以小于挂牌数量；
- 买卖双方资金、数量和挂牌剩余量在同一事务中更新；
- 运行中的买方集群收到新数量时，新增数量下一周期加入；
- 所有写操作继续使用 `Idempotency-Key`。

## 11. 旧状态迁移

| 旧数据 | 新数据 |
|---|---|
| 同类型多个工厂实例 | 汇总为一个 `FacilityGroup.count` |
| 全部同类工厂运行 | 迁移后从迁移时间开始新的统一周期 |
| 同类状态混合 | 迁移后统一暂停 |
| 施工中工厂 | `FacilityConstruction` |
| 单座挂牌 | 数量 1 的类型挂牌 |
| `internalGoods` | 一次性无损迁移到输出商品共享仓库 |
| `internalCapacity` | 删除 |
| 工厂实例 ID、名称编号 | 删除 |
| `facilitySlots` | 删除 |
| `trades`、`ledger`、`assetEvents` | 从服务器世界状态删除 |

迁移不得改变资金、商品、工厂总数量或挂牌总数量。保存后的世界状态不得再包含 `facilities`、`facilityId`、`internalGoods` 或 `internalCapacity`。

## 12. 页面与本地日志

生产页每种类型只显示一张集群卡，不提供展开实例。卡片只显示：周期、周期产量、周期成本、原料库存，以及统一状态、进度、计划、启停和数量挂牌。

不得显示小时产量、小时运营费、累计产量、系统参考估值、实例 ID 或实例列表。

浏览器本地日志按类型比较数量、统一状态、计划、施工、挂牌和完成量变化；不得保存或恢复单座工厂实例。

## 13. 测试与不可回退规则

必须覆盖：

1. 旧实例按类型无损汇总；
2. API 和 SQLite 不包含实例数组；
3. 同类型统一周期、计划和启停；
4. 产量、成本和原料按参与数量整体计算；
5. 新建和收购数量下一周期加入且不重置进度；
6. 定量计划不超产，数量变化不兼容时暂停；
7. 数量挂牌和部分购买正确交割；
8. 工厂总资产按类型数量计算；
9. 产成品直接进入共享仓库；
10. 幂等请求不重复改变数量；
11. 挂牌工厂不参与生产且不阻止未挂牌数量启动；
12. 撤销挂牌和出售挂牌数量不得破坏当前周期；
13. 商品和工厂 ID 唯一，所有配方输入输出都能在商品目录中解析；
14. 旧存档自动补齐新增商品库存、市场和基础流动性且不改变既有资产；
15. 客户端目录页面按服务器返回数组动态渲染，不依赖固定 6 项。

不得恢复单座工厂模型、实例 ID、实例管理、部分启停、内部仓库或领取流程。

未更新本设计、第三版专题设计、迁移、测试和防回退检查的生产规则修改不应合并。
