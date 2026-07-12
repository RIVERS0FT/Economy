# Economy 工厂集群与统一市场 V3 设计

> 状态：工厂状态机与订单市场防回退基线

## 定量完成关停补充规则（2026-07-12）

定量计划达到目标后必须调用统一停止流程：`enabled = false`、`status = stopped`、`statusReason = plan_complete`，并清除运行周期。存在 `pendingProductionPlan` 时先将其提升为当前计划，再关闭开关；不得自动继续下一周期。
