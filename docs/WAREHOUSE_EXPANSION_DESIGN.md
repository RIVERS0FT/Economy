# Economy 仓库扩容设计

> 状态：当前共享仓库容量、占用与升级规则基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-11  
> 客户端状态版本：`version: 7`

页面归属以 `docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为准。本文件只定义仓库服务器规则、状态字段和生产页管理界面。

## 1. 核心规则

- 所有商品共用一个玩家仓库容量。
- 仓库等级、容量、占用和剩余空间属于服务器权威资产状态。
- 玩家使用可用资金支付扩容费用。
- 扩容费用由系统回收，计入 `stats.systemSinks`。
- 扩容不改变现有商品数量、冻结商品、工厂内部产成品或订单。
- 浏览器不能自行修改或重新计算正式仓库等级、容量、费用和占用。
- 仓库扩容产生的用户可见记录只保存在浏览器本地。
- 共享仓库完整管理入口只位于生产页面。

## 2. 等级与容量

```text
初始等级：1
初始容量：500
每级增加：250
最高等级：12
最高容量：3250
```

容量公式：

```text
capacity(level) = 500 + (level - 1) × 250
```

等级与容量必须通过 `server/src/warehouse.js` 的统一函数计算。页面不得维护另一套正式数值。

## 3. 扩容费用

从当前等级升级到下一等级的费用：

```text
cost(level) = 150 × level²
```

| 当前等级 | 升级后等级 | 扩容后容量 | 费用 |
|---:|---:|---:|---:|
| 1 | 2 | 750 | 150 |
| 2 | 3 | 1000 | 600 |
| 3 | 4 | 1250 | 1350 |
| 4 | 5 | 1500 | 2400 |
| 5 | 6 | 1750 | 3750 |
| 11 | 12 | 3250 | 18150 |

最高等级的 `warehouseUpgradeCost` 为 `null`，不得继续扩容。

## 4. 权威仓库占用

仓库占用由服务器计算并返回，客户端只负责展示。

```text
实物库存 = Σ(各商品可用数量 + 各商品冻结数量)
买单预占 = Σ(当前玩家未完成买单剩余数量)
已用容量 = 实物库存 + 买单预占
剩余容量 = max(0, 当前容量 - 已用容量)
```

未完成买单包括 `open` 买单和 `partial` 买单的剩余数量。

以下内容不计入买单预占：

- 已成交订单；
- 已撤销订单；
- 卖单；
- 其他玩家订单；
- 工厂内部产成品。

API 必须返回：

```ts
warehouseStoredQuantity: number;
warehouseReservedQuantity: number;
warehouseUsedCapacity: number;
warehouseAvailableCapacity: number;
```

页面不得通过遍历订单和库存重新生成正式仓库占用摘要。

## 5. 服务器事务

扩容操作固定为：

```text
POST /api/game/warehouse/upgrade
```

服务器在同一个 SQLite `BEGIN IMMEDIATE` 事务中：

1. 验证当前用户；
2. 初始化或迁移仓库等级；
3. 计算当前仓库占用；
4. 检查是否已达到最高等级；
5. 计算当前等级费用；
6. 检查可用资金；
7. 扣除资金；
8. 提升等级；
9. 按公式设置新容量；
10. 增加系统回收统计；
11. 返回最新权威等级、容量、占用和剩余空间。

扩容费用计入系统回收。写请求必须使用 `Idempotency-Key`，重复请求不得重复扣款或重复升级。

## 6. 状态字段

`EconomyState` 必须返回：

```ts
warehouseLevel: number;
warehouseMaxLevel: number;
warehouseUpgradeCost: number | null;
warehouseNextCapacity: number;
inventoryCapacity: number;
warehouseStoredQuantity: number;
warehouseReservedQuantity: number;
warehouseUsedCapacity: number;
warehouseAvailableCapacity: number;
```

- `inventoryCapacity` 是当前正式容量。
- `warehouseNextCapacity` 是下一等级容量；满级时等于当前容量。
- `warehouseStoredQuantity` 是当前商品实物和冻结商品总量。
- `warehouseReservedQuantity` 是未完成买单预占空间。
- `warehouseUsedCapacity` 是实物与预占之和。
- `warehouseAvailableCapacity` 是可继续领取或新建买单的剩余空间。
- 客户端状态版本继续为 `version: 7`。

## 7. 旧玩家迁移

旧玩家没有 `warehouseLevel` 时，根据现有 `inventoryCapacity` 推导等级：

```text
inferredLevel = ceil((existingCapacity - 500) / 250) + 1
```

迁移规则：

- 等级限制在 1～12；
- 新容量取旧容量和推导等级标准容量中的较大值；
- 绝不缩减旧玩家容量；
- 不扣除迁移费用；
- 迁移可重复执行；
- 重置经济状态后恢复 1 级、500 容量。

旧玩家若因历史数据导致占用超过容量：

- 不删除商品；
- 不取消订单；
- 剩余容量返回 0；
- 在释放占用或完成扩容前，不能继续领取商品或创建新增买单。

## 8. 仓库约束

以下操作必须使用服务器权威剩余容量判断：

- 创建买单；
- 从工厂领取产成品；
- 未来所有会增加玩家商品库存的操作。

工厂内部产成品不占玩家共享仓库，只有领取进入玩家库存后才占用。

扩容只增加上限，不自动移动、生产或购买任何商品，也不改变已有买单的预占数量。

## 9. 页面与 UI 归属

### 9.1 生产页面

共享仓库完整管理卡必须位于 `ProductionPage`，并位于建设新工厂和已有工厂列表之前。

完整卡必须展示：

- 当前等级与最高等级；
- 已用容量与总容量；
- 使用率进度；
- 实物库存；
- 买单预占；
- 剩余容量；
- 当前容量；
- 扩容后容量；
- 本次费用；
- 扩容按钮；
- 资金不足、容量超限和满级状态。

该位置用于在玩家建厂、生产和领取产成品前明确容量约束。

`WarehouseUpgradeCard` 只能由 `ProductionPage` 渲染。

### 9.2 其他页面

- 全局状态栏可以显示仓库使用和买单预占的只读摘要。
- 市场页可以显示订单容量提示，但不得提供扩容操作。
- 资金页只可在本地资产事件中显示已经发生的扩容结果。
- 设置页不得显示仓库使用、等级、费用、容量或扩容入口。
- 概览页和排行页不得显示完整仓库管理模块。

`AssetsPage`、`SettingsPage`、`OverviewPage`、`MarketPage` 和 `LeaderboardPage` 不得渲染 `WarehouseUpgradeCard`。

移动端按钮和输入目标不得小于 44px。

## 10. 本地日志

扩容成功后，客户端根据前后权威状态生成本地资产变化：

- 可用资金减少；
- 仓库等级变化；
- 容量变化；
- 描述包含服务器返回的扩容结果；
- 记录属于当前浏览器；
- 不上传服务器；
- 不参与容量、资产或排名计算。

本地 `AssetEvent` 使用：

```ts
warehouseChange?: {
  beforeLevel: number;
  afterLevel: number;
  beforeCapacity: number;
  afterCapacity: number;
  capacityDelta: number;
};
```

旧浏览器本地快照没有 `warehouseLevel` 时，首次同步只补齐快照，不创建虚假扩容事件。

资金页负责展示该本地历史结果，但不提供再次扩容操作。

服务器数据库不得保存仓库扩容历史日志。

## 11. 测试要求

必须覆盖：

1. 新玩家默认为 1 级和 500 容量；
2. 1 级扩容扣除 150 并增加到 750；
3. 费用随等级平方递增；
4. 资金不足时等级、容量和资金不变；
5. 最高等级不能继续扩容；
6. 旧自定义容量迁移后不减少；
7. 扩容费用计入系统回收；
8. 相同幂等键不重复扩容；
9. API 返回全部仓库等级和占用字段；
10. 实物库存包含可用商品和冻结商品；
11. 买单预占只包含当前玩家未完成买单剩余数量；
12. 扩容后实物和预占不变，剩余容量增加；
13. `WarehouseUpgradeCard` 只由生产页渲染；
14. 设置页不包含任何仓库摘要或仓库操作；
15. 本地日志记录等级和容量变化。

## 12. 不可回退规则

不得：

- 让客户端决定正式仓库等级、容量、费用或占用；
- 在页面中重新计算正式买单预占；
- 绕过资金检查或服务器事务；
- 允许超过 12 级；
- 降低旧玩家已有容量；
- 让扩容自动生成商品或工厂；
- 把扩容费用支付给其他玩家；
- 删除幂等保护；
- 把扩容历史写入服务器日志；
- 把仓库摘要或操作恢复到设置页；
- 在页面中复制另一套容量或费用公式；
- 忽略未完成买单对仓库容量的预占。

未更新本设计、页面职责设计、测试和架构检查的仓库规则修改不应合并。
