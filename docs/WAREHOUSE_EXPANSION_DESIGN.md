# Economy 仓库扩容设计

> 状态：当前共享仓库容量、占用、生产约束与升级规则基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-11  
> 客户端状态版本：`version: 7`

页面归属以 `docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为准，生产结算以 `docs/INDUSTRY_AND_PRODUCTION_DESIGN.md` 为准。

## 1. 核心规则

- 所有商品共用一个玩家仓库容量。
- 仓库等级、容量、占用和剩余空间属于服务器权威状态。
- 共享仓库完整管理入口只位于生产页面。
- 所有工厂产成品完成后直接进入共享仓库。
- 工厂不拥有内部商品或内部容量。
- 仓库空间不足时，工厂不得完成会造成净库存增加的周期。
- 扩容费用由系统回收并计入 `stats.systemSinks`。
- 用户可见扩容和生产记录只保存在浏览器本地。

## 2. 等级与容量

```text
初始等级：1
初始容量：500
每级增加：250
最高等级：12
最高容量：3250
capacity(level) = 500 + (level - 1) × 250
```

## 3. 扩容费用

```text
cost(level) = 150 × level²
```

最高等级的 `warehouseUpgradeCost` 为 `null`。扩容必须在 SQLite `BEGIN IMMEDIATE` 事务中完成并使用 `Idempotency-Key`。

## 4. 权威仓库占用

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

## 5. 工厂直接入仓

工厂一个完整周期对共享仓库占用的净增长：

```text
netStoragePerCycle = max(0, outputPerCycle - inputPerCycle)
```

- 农场、矿场等无原料工厂必须为完整产出预留空间。
- 面粉厂、钢铁厂等加工工厂可以利用同周期原料消耗释放的空间。
- 工厂产成品直接增加到输出商品的 `available` 库存。
- 工厂没有 `internalGoods` 或 `internalCapacity`。
- 不存在从工厂领取产成品的操作。
- 多座工厂共享同一剩余容量，服务器逐座结算后立即更新占用。
- 买单预占会减少工厂可用生产空间。

共享仓库无法容纳下一个完整周期的净增长时：

```text
facility.status = full
facility.stopReason = output_full
```

仓库扩容后不会自动重启工厂，玩家必须手动启动。

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

`warehouseAvailableCapacity` 是新建买单和工厂净新增产出的共同空间。

## 7. 旧数据迁移

- 旧 `facility.internalGoods` 一次性无损转移到对应输出商品的共享仓库可用库存。
- 删除 `facility.internalGoods` 和 `facility.internalCapacity`。
- 删除挂牌快照中的内部存储字段。
- 旧内部商品迁移可导致暂时超限，但不得丢失资产。
- 超限时剩余容量返回 0；释放库存或扩容前不能继续增加净库存。
- 迁移必须幂等，保存后的 SQLite 世界 JSON 不得再包含内部存储字段。

## 8. 页面与 UI 归属

### 8.1 生产页面

共享仓库完整管理卡必须位于 `ProductionPage`，并位于建设新工厂和工厂列表之前。

必须展示：等级、使用率、实物库存、买单预占、剩余容量、扩容后容量、费用、扩容按钮和异常状态。

工厂卡必须说明产成品自动入仓，不得显示内部容量、内部商品或领取按钮。

`WarehouseUpgradeCard` 只能由 `ProductionPage` 渲染。

### 8.2 其他页面

- 状态栏可以显示只读仓库使用摘要。
- 市场页可以解释买单预占，但不得扩容。
- 资金页显示商品库存和本地生产/扩容历史，不得扩容。
- 设置页不得显示仓库摘要或操作。
- `AssetsPage`、`SettingsPage`、`OverviewPage`、`MarketPage` 和 `LeaderboardPage` 不得渲染 `WarehouseUpgradeCard`。

## 9. 本地日志

扩容事件记录资金扣款、等级变化和容量变化。

生产事件通过服务器状态差异记录：

- 运营费扣除；
- 原料库存减少；
- 输出商品共享仓库库存增加；
- 工厂 `completedQuantity` 增量。

新事件不得使用工厂内部商品变化。旧浏览器中的领取历史仅保留只读兼容。

## 10. 测试要求

必须覆盖：

1. 仓库等级和费用；
2. 实物库存与买单预占；
3. 原料型工厂直接入仓；
4. 加工厂利用原料消耗释放空间；
5. 仓库不足时工厂停止且不扣费；
6. 多工厂共享剩余空间；
7. 旧内部商品无损迁移；
8. API 与 SQLite 不包含内部存储字段；
9. 不存在领取接口和按钮；
10. `WarehouseUpgradeCard` 只由生产页渲染。

## 11. 不可回退规则

不得：

- 恢复工厂内部存储；
- 恢复产成品领取；
- 忽略工厂生产对共享仓库的占用；
- 忽略未完成买单预占；
- 在客户端复制正式容量或费用公式；
- 降低旧玩家已有容量；
- 丢失旧内部商品；
- 绕过事务或幂等保护；
- 把仓库摘要或操作恢复到设置页。

未更新本设计、页面职责设计、测试和架构检查的仓库规则修改不应合并。
