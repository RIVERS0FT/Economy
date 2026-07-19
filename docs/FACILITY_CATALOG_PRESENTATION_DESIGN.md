# Economy 工厂目录展示顺序设计

> 状态：当前实现与不可回退规则  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-19

## 1. 唯一顺序来源

服务器 `FACILITY_TYPE_CATALOG` 返回的顺序进入客户端 `game.facilityTypes`。`game.facilityTypes` 是客户端工厂展示顺序的唯一权威。

客户端不得再维护独立工厂顺序表，也不得把玩家持有数据的返回顺序当作目录顺序。

## 2. 必须复用该顺序的界面

以下界面必须保持完全相同的工厂目录顺序：

- “工厂类型”下拉框；
- 生产页已拥有工厂卡片；
- 后续新增的工厂目录导航、筛选器和选择器。

工厂类型下拉框与已拥有工厂卡片必须保持完全相同的目录顺序。

## 3. 已拥有工厂卡片实现

`facilityGroups` 是玩家持有状态，不是目录。生产页必须：

1. 先按 `facilityTypeId` 建立 `groupsByTypeId`；
2. 再遍历 `game.facilityTypes`；
3. 只为当前玩家实际拥有的类型输出卡片；
4. 使用目录中的 `type` 直接渲染名称、配方和市场入口。

推荐结构：

```ts
const groupsByTypeId = new Map(
  game.facilityGroups.map((group) => [group.facilityTypeId, group]),
);

const orderedFacilityGroups = game.facilityTypes.flatMap((type) => {
  const group = groupsByTypeId.get(type.id);
  return group ? [{ type, group }] : [];
});
```

不得按 `facilityGroups` 返回顺序、中文名称、ID 或 `localeCompare` 重新排序。

## 4. 稳定性规则

- 侧栏展开、折叠和响应式列数变化不得改变工厂卡片顺序。
- 工厂运行、停止、异常、冻结、买入、解冻或施工完成不得改变已有类型之间的相对顺序。
- 新增正式工厂类型时，只需调整服务器目录；客户端不得追加另一处排序配置。
- 未知 `facilityTypeId` 不得生成缺少正式目录定义的卡片。

## 5. 验收标准

测试数据应故意让 `facilityGroups` 与 `facilityTypes` 顺序不同，并验证：

1. 下拉框顺序等于 `facilityTypes`；
2. 工厂卡片顺序等于过滤到已拥有类型后的 `facilityTypes`；
3. 侧栏展开和折叠后顺序不变；
4. 客户端代码不存在以 `facilityGroups` 为渲染入口的直接卡片遍历。

## 6. 不可回退规则

除非先更新本设计文档和架构检查，否则不得：

- 直接使用 `game.facilityGroups.map(...)` 作为工厂卡片渲染入口；
- 按名称、ID、本地化比较或玩家持有顺序重新排列工厂卡片；
- 在客户端复制服务器工厂目录顺序；
- 让下拉框和卡片使用两套不同排序规则。
