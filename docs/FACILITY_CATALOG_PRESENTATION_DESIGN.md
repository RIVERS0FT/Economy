# Economy 工厂目录展示顺序设计

> 状态：当前实现与不可回退规则  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-21

## 1. 唯一顺序来源

服务器 `FACILITY_TYPE_CATALOG` 返回的顺序进入客户端 `game.facilityTypes`。`game.facilityTypes` 是客户端工厂展示顺序的唯一权威。

客户端不得再维护独立工厂顺序表，也不得把玩家持有数据的返回顺序当作目录顺序。

## 2. 必须复用该顺序的界面

以下界面必须保持完全相同的工厂目录顺序：

- “工厂类型”建设下拉框；
- 生产页已拥有工厂集群选择卡；
- 生产页默认详情工厂与失效后的回退选择；
- 后续新增的工厂目录导航、筛选器和选择器。

工厂类型下拉框与已拥有工厂卡片必须保持完全相同的目录顺序。建设下拉框、已拥有工厂选择卡和详情默认选择必须使用同一目录顺序。详情选择状态与建设下拉框状态必须独立，不能因为查看工厂详情而改变待建设工厂类型。

## 3. 已拥有工厂选择器实现

`facilityGroups` 是玩家持有状态，不是目录。生产页必须：

1. 先按 `facilityTypeId` 建立 `groupsByTypeId`；
2. 再遍历 `game.facilityTypes`；
3. 只为当前玩家实际拥有且 `count > 0` 的类型输出选择卡；
4. 使用目录中的 `type` 直接渲染名称、配方和市场入口；
5. 默认选择过滤结果中的第一项；当前选择不再拥有时回退到新的第一项，无已拥有工厂时清空选择并关闭移动详情悬浮框。

推荐结构：

```ts
const groupsByTypeId = new Map(
  game.facilityGroups.map((group) => [group.facilityTypeId, group]),
);

const orderedFacilityGroups = game.facilityTypes.flatMap((type) => {
  const group = groupsByTypeId.get(type.id);
  return group && group.count > 0 ? [{ type, group }] : [];
});

const selectedFacilityEntry = orderedFacilityGroups.find(
  ({ type }) => type.id === selectedFacilityGroupId,
) ?? orderedFacilityGroups[0];
```

不得按 `facilityGroups` 返回顺序、中文名称、ID 或 `localeCompare` 重新排序。也不得按运行状态、工厂数量或最近查看重排选择卡，不得把“运行中优先”“最近查看”作为默认详情规则。

## 4. 稳定性规则

- 侧栏展开、折叠、响应式列数变化和移动详情悬浮框开关不得改变工厂选择卡顺序。
- 工厂运行、停止、异常、冻结、买入、解冻或施工完成不得改变已有类型之间的相对顺序。
- 五秒状态轮询只替换权威工厂数据，不重置仍然有效的 `selectedFacilityGroupId`，也不关闭已打开的移动详情悬浮框。
- 新增正式工厂类型时，只需调整服务器目录；客户端不得追加另一处排序配置。
- 未知 `facilityTypeId` 不得生成缺少正式目录定义的选择卡或详情。

## 5. 验收标准

测试数据应故意让 `facilityGroups` 与 `facilityTypes` 顺序不同，并验证：

1. 建设下拉框顺序等于 `facilityTypes`；
2. 工厂选择卡顺序等于过滤到已拥有类型后的 `facilityTypes`；
3. 默认详情工厂是过滤结果第一项，且不会改变建设下拉框；
4. 侧栏展开、折叠、轮询刷新和移动悬浮框开关后顺序及有效选择不变；
5. 当前工厂数量降为零后按正式目录回退，无已拥有工厂时清空详情；
6. 客户端代码不存在以 `facilityGroups` 为渲染入口的直接选择卡遍历。

## 6. 不可回退规则

除非先更新本设计文档和架构检查，否则不得：

- 直接使用 `game.facilityGroups.map(...)` 作为工厂选择卡渲染入口；
- 按名称、ID、本地化比较、运行状态、数量或玩家持有顺序重新排列工厂选择卡；
- 在客户端复制服务器工厂目录顺序；
- 让建设下拉框、选择卡和默认详情使用不同排序规则；
- 复用建设类型状态承载详情选择，或让轮询把有效详情选择重置到第一项。
