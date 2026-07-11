# Economy 工厂集群与市场第三版设计

> 状态：工厂资产、生产控制、工厂交易和商品下单的当前权威设计  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-11  
> 客户端状态版本：`version: 8`  
> 世界状态版本：`version: 4`

## 1. 核心决策

- 不存在单座工厂实例、工厂实例 ID、实例列表或展开实例管理。
- 玩家工厂资产按 `facilityTypeId + count` 保存。
- 同类型工厂只有一个状态、一条进度、一个生产计划和一组启停操作。
- 新建或收购的同类型工厂在集群运行时进入 `pendingJoinCount`，完成当前周期后从下一周期参与生产。
- 新数量加入不得重置当前周期进度，也不得获得部分周期产出。
- 同类型工厂统一启动、统一停止；不支持部分启停。
- 工厂产成品完成后直接进入共享仓库，不存在工厂内部仓库或领取操作。
- 工厂挂牌和购买按类型、数量和单座价格进行。
- 商品下单区固定为限价在前、数量在后，快捷数量位于数量输入下方。
- 商品快捷数量固定为 `1/4 仓`、`1/2 仓`、`全仓`。
- 订单簿为单列，卖盘和买盘分别只显示最优 5 笔订单。

## 2. 工厂集群状态

服务器保存：

```ts
interface FacilityGroup {
  facilityTypeId: string;
  count: number;
  participatingCount: number;
  pendingJoinCount: number;
  status:
    | 'ready'
    | 'running'
    | 'paused'
    | 'full'
    | 'insufficient_funds'
    | 'insufficient_input'
    | 'listed';
  stopReason?:
    | 'manual'
    | 'plan_complete'
    | 'plan_adjustment_required'
    | 'insufficient_funds'
    | 'insufficient_input'
    | 'output_full'
    | 'listed'
    | 'maintenance';
  cycleStartedAt?: number;
  productionMode: 'continuous' | 'target';
  targetQuantity?: number;
  completedQuantity: number;
}
```

客户端额外返回：

```ts
listedCount: number;
availableCount: number;
nextCycleCount: number;
```

定义：

- `count`：玩家拥有的该类型工厂总数，包含挂牌数量。
- `participatingCount`：当前周期实际参与生产的数量。
- `pendingJoinCount`：已经归属玩家、但等待下一周期加入的数量。
- `listedCount`：已冻结在工厂市场的数量。
- `availableCount`：未挂牌数量。
- `nextCycleCount`：下一周期预计参与数量。

`EconomyState` 不得包含 `facilities` 或任何单座工厂数组。

## 3. 建设任务

玩家同时只能施工一座工厂：

```ts
interface FacilityConstruction {
  facilityTypeId: string;
  startedAt: number;
  completesAt: number;
}
```

施工完成：

- 目标集群未运行：数量立即增加，保持待启动或停止状态。
- 目标集群正在运行：`count += 1` 且 `pendingJoinCount += 1`。
- 不重置 `cycleStartedAt`。
- 当前周期仍按旧 `participatingCount` 结算。
- 完成当前周期后，待加入数量合并到 `participatingCount`。

## 4. 统一生产周期

集群周期参数来自服务器工厂目录。

```text
周期产量 = 单座周期产量 × participatingCount
周期成本 = 单座周期成本 × participatingCount
周期原料 = 单座周期原料 × participatingCount
周期净仓库增长 = max(0, 周期产量 - 周期原料)
```

完整周期在一个服务器事务中：

1. 检查资金、原料、共享仓库空间和定量计划；
2. 扣除整个集群的周期成本；
3. 扣除整个集群的周期原料；
4. 产成品直接增加到共享仓库；
5. 增加计划完成量；
6. 推进统一周期时间；
7. 若存在 `pendingJoinCount`，在该周期结束后加入下一周期。

不得对集群中的一部分工厂单独生产。资源不足时整个集群停止。

## 5. 新数量下一周期加入

示例：农场集群当前 8 座参与生产，周期中新增 2 座。

```text
当前参与：8
待加入：2
下一周期：10
```

当前周期按 8 座结算。周期完成后：

```text
participatingCount = 10
pendingJoinCount = 0
```

无论新增来源是施工完成还是市场收购，都必须使用同一规则。

## 6. 统一启停

启动操作以 `facilityTypeId` 为目标：

```text
POST /api/game/facilities/:facilityTypeId/start
```

启动时所有未挂牌数量统一参与：

```text
participatingCount = availableCount
pendingJoinCount = 0
cycleStartedAt = 服务器时间
```

停止操作：

```text
POST /api/game/facilities/:facilityTypeId/stop
```

停止前先结算已经完成的完整周期；未完成周期作废，不扣费、不扣原料、不产出。停止后参与数量和待加入数量归零。

存在任何挂牌数量时，该类型集群不能启动，避免产生隐性单座状态差异。

## 7. 统一生产计划

计划作用于整个类型集群。

持续生产不设目标。

定量计划目标必须是当前可生产数量对应的集群周期产量整数倍：

```text
targetQuantity % (单座周期产量 × availableCount) = 0
```

运行中不能修改计划。

若新增数量在下一周期加入后，剩余目标无法被新周期产量整除：

- 当前周期正常完成；
- 集群暂停；
- 停止原因为 `plan_adjustment_required`；
- 玩家必须重新保存定量计划或切换持续生产；
- 不允许超产或让部分工厂单独生产。

## 8. 工厂页面内容

每种工厂类型最多显示一张集群卡，不提供展开区。

卡片固定显示：

- 工厂类型和持有数量；
- 统一状态和停止原因；
- 当前参与、下一周期、待加入、已挂牌数量；
- 统一周期进度；
- 周期；
- 周期产量；
- 周期成本；
- 原料库存；
- 统一生产计划；
- 启动全部或停止全部；
- 数量挂牌与撤销挂牌。

卡片不得显示：

- 工厂实例名称或 ID；
- 实例列表或展开实例；
- 单座启停；
- 小时产量；
- 小时运营费；
- 累计产量；
- 系统参考估值；
- 内部商品、内部容量或领取按钮。

宽屏工厂集群卡使用双列；紧凑桌面、平板和移动端使用单列。

## 9. 工厂数量市场

挂牌记录：

```ts
interface FacilityListing {
  id: string;
  facilityTypeId: string;
  ownerType: 'player' | 'market';
  ownerId?: number;
  ownerName: string;
  quantity: number;
  unitPrice: number;
  createdAt: number;
}
```

挂牌请求包含：

```ts
{
  facilityTypeId: string;
  quantity: number;
  unitPrice: number;
}
```

规则：

- 集群必须停止；
- 数量不能超过未挂牌数量；
- 单价必须在单座系统估值 50%～200%；
- 相同卖家、类型和单价可以合并数量；
- 挂牌和数量冻结必须在一个 SQLite 事务内完成；
- 使用 `Idempotency-Key`，重试不能重复增加挂牌数量。

购买请求：

```ts
{
  listingId: string;
  quantity: number;
}
```

购买允许小于挂牌数量。服务器原子完成：

- 买方扣除 `quantity × unitPrice`；
- 卖方增加相同金额；
- 卖方工厂数量减少；
- 买方工厂数量增加；
- 挂牌剩余数量减少；
- 买方同类集群运行时，购买数量进入 `pendingJoinCount`。

## 10. 商品下单快捷数量

下单字段顺序固定为：

```text
方向
限价
数量
快捷数量
订单总额
提交订单
```

快捷按钮顺序固定为：

```text
1/4 仓｜1/2 仓｜全仓
```

买入最大数量：

```text
maxBuy = min(
  warehouseAvailableCapacity,
  floor(credits / price)
)
```

卖出最大数量：

```text
maxSell = selectedInventory.available
```

快捷数量：

```text
1/4 仓 = max(1, floor(max × 0.25))
1/2 仓 = max(1, floor(max × 0.50))
全仓   = max
```

当最大数量为 0 时三个按钮禁用。提交数量不能超过服务器允许的最大值；正式校验仍由服务器完成。

## 11. 单列订单簿

订单簿不进行价格档位聚合，每一行对应一笔真实有效订单。

单列顺序：

```text
卖盘标题
最优 5 笔卖单（最低卖价靠近成交线）
最近成交与价差
最优 5 笔买单（最高买价靠近成交线）
买盘标题
```

每行只显示：

```text
方向｜价格｜剩余数量
```

不得显示玩家身份。

卖盘选择价格最低、时间最早的前 5 笔；买盘选择价格最高、时间最早的前 5 笔。

## 12. 数据迁移

升级时：

1. 按旧服务器时间结算已经完成的生产；
2. 旧内部产成品无损迁移到共享仓库；
3. 按 `facilityTypeId` 汇总旧工厂数量；
4. 全部旧同类工厂都在运行时，迁移后从迁移时间开始新的统一周期；
5. 旧同类状态混合时，迁移后统一暂停；
6. 旧施工中工厂迁移为 `facilityConstruction`；
7. 旧单座挂牌迁移为数量 1 的挂牌；
8. 删除 `player.facilities`、工厂实例 ID 和挂牌快照；
9. 迁移不得改变资金、商品、工厂总数量或挂牌总数量。

持久化后的世界 JSON 不得包含 `facilities`、`facilityId`、`internalGoods` 或 `internalCapacity`。

## 13. 本地日志

浏览器本地日志按工厂类型比较：

- 集群数量变化；
- 统一状态变化；
- 统一计划变化；
- 施工开始与完成；
- 数量挂牌、撤销、购买和出售；
- 集群完成量与共享仓库商品变化。

本地日志不得恢复或修改服务器工厂数量，也不得保存单座工厂实例。

## 14. 测试与防回退

必须验证：

1. API 和 SQLite 不包含单座工厂数组；
2. 旧工厂按类型无损汇总；
3. 同类型只有一条进度；
4. 周期成本、原料和产量按参与数量整体结算；
5. 新建和购买数量下一周期加入；
6. 加入不重置当前进度；
7. 同类型统一启停；
8. 定量计划不超产；
9. 数量改变导致目标不兼容时暂停；
10. 数量挂牌和部分购买准确交割；
11. 幂等请求不重复建设、挂牌或购买；
12. 下单限价位于数量之前；
13. 快捷按钮位于数量下方且顺序固定；
14. 买入快捷量同时受资金和仓库限制；
15. 卖出快捷量只使用当前商品可用库存；
16. 订单簿单列且买卖盘各最多 5 笔；
17. 页面不出现工厂实例、小时指标、累计产量或系统估值。

未同步更新本文件、相关页面职责文档、测试和防回退检查的修改不应合并。
