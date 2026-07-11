# Economy 仓库扩容设计

> 状态：当前共享仓库容量、占用、工厂集群生产约束与升级规则基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-11  
> 客户端状态版本：`version: 8`

页面归属以 `docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为准，工厂集群生产以 `docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md` 和 `docs/INDUSTRY_AND_PRODUCTION_DESIGN.md` 为准。

## 1. 核心规则

- 所有商品共用一个玩家仓库容量。
- 仓库等级、容量、占用和剩余空间属于服务器权威状态。
- 共享仓库完整管理入口只位于生产页面。
- 所有工厂集群产成品完成后直接进入共享仓库。
- 工厂不拥有内部商品或内部容量。
- 集群完整周期会造成净库存增加时，必须先检查仓库空间。
- 扩容费用由系统回收并计入 `stats.systemSinks`。
- 用户可见扩容和生产记录只保存在浏览器本地。

## 2. 等级、容量与费用

```text
初始等级：1
初始容量：500
每级增加：250
最高等级：12
最高容量：3250
capacity(level) = 500 + (level - 1) × 250
cost(level) = 150 × level²
```

最高等级的 `warehouseUpgradeCost` 为 `null`。扩容必须在 SQLite `BEGIN IMMEDIATE` 事务中完成并使用 `Idempotency-Key`。

## 3. 权威仓库占用

```text
实物库存 = Σ(各商品可用数量 + 各商品冻结数量)
买单预占 = Σ(当前玩家 open/partial 买单剩余数量)
已用容量 = 实物库存 + 买单预占
剩余容量 = max(0, 当前容量 - 已用容量)
```

不计入买单预占：已成交、已撤销、卖单和其他玩家订单。

API 必须返回：

```ts
warehouseStoredQuantity: number;
warehouseReservedQuantity: number;
warehouseUsedCapacity: number;
warehouseAvailableCapacity: number;
```

客户端不得重新计算正式仓库占用。

## 4. 工厂集群直接入仓

一个集群完整周期的仓库净增长：

```text
集群周期产量 = 单座产量 × participatingCount
集群周期原料 = 单座原料 × participatingCount
netStoragePerCycle = max(0, 集群周期产量 - 集群周期原料)
```

- 无原料集群必须为完整集群产出预留空间。
- 加工集群可以利用同周期原料消耗释放的空间。
- 产成品直接增加到输出商品的 `available` 库存。
- 工厂集群没有 `internalGoods` 或 `internalCapacity`。
- 不存在从工厂领取产成品的操作。
- 同类型所有参与数量在一个周期中整体结算，不得部分生产。
- 买单预占会减少工厂集群可用生产空间。

共享仓库无法容纳下一完整周期净增长时：

```text
group.status = full
group.stopReason = output_full
```

仓库扩容后不会自动重启集群，玩家必须统一启动。

## 5. 新数量下一周期加入

施工完成或市场收购发生在集群运行中时，新数量进入 `pendingJoinCount`。

当前周期仍按旧 `participatingCount` 检查仓库和结算。周期完成后待加入数量并入下一周期。不得重置当前周期或为新增数量生成部分周期产出。

下一周期使用新参与数量重新计算周期净仓库增长。

## 6. 状态字段

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

`warehouseAvailableCapacity` 是新建买单和工厂集群净新增产出的共同空间。

## 7. 旧数据迁移

- 旧 `facility.internalGoods` 一次性无损转移到对应输出商品共享仓库。
- 删除 `facility.internalGoods` 和 `facility.internalCapacity`。
- 旧工厂按 `facilityTypeId` 汇总为类型集群。
- 删除单座工厂数组、实例 ID 和挂牌快照。
- 旧内部商品迁移可导致暂时超限，但不得丢失资产。
- 超限时剩余容量返回 0；释放库存或扩容前不能继续增加净库存。
- 迁移必须幂等，保存后的 SQLite 世界 JSON 不得再包含内部存储或实例字段。

## 8. 页面与 UI 归属

共享仓库完整管理卡必须位于 `ProductionPage`，并位于建设新工厂和工厂集群卡之前。

必须展示等级、使用率、实物库存、买单预占、剩余容量、扩容后容量、费用、扩容按钮和异常状态。

工厂集群卡必须说明产成品自动入仓，不得显示内部容量、内部商品或领取按钮。

`WarehouseUpgradeCard` 只能由 `ProductionPage` 渲染。

其他页面：

- 状态栏可以显示只读仓库使用摘要；
- 市场页可以解释买单预占，但不得扩容；
- 资金页显示商品库存和本地生产／扩容历史，不得扩容；
- 设置页不得显示仓库摘要或操作；
- `AssetsPage`、`SettingsPage`、`OverviewPage`、`MarketPage` 和 `LeaderboardPage` 不得渲染 `WarehouseUpgradeCard`。

## 9. 本地日志

扩容事件记录资金扣款、等级变化和容量变化。

生产事件通过工厂集群完成量、资金、原料和输出商品共享仓库差异生成。新事件不得使用实例 ID 或工厂内部商品变化。

## 10. 测试与不可回退规则

必须覆盖：

1. 仓库等级和费用；
2. 实物库存与买单预占；
3. 集群直接入仓；
4. 加工集群利用原料释放空间；
5. 仓库不足时整个集群停止且不扣费；
6. 新数量下一周期加入；
7. 旧内部商品无损迁移；
8. API 与 SQLite 不包含内部存储和工厂实例；
9. 不存在领取接口和按钮；
10. `WarehouseUpgradeCard` 只由生产页渲染。

不得恢复内部存储、领取、单座工厂仓库检查、客户端容量公式、降低旧玩家容量、丢失旧商品、绕过事务或把仓库摘要恢复到设置页。

未更新本设计、页面职责设计、第三版专题设计、测试和架构检查的仓库规则修改不应合并。
