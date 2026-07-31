import { replaceExact } from './helpers.mjs';

replaceExact(
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  '真实剪枝只淘汰过期或超过 800 笔的已关闭历史，不得因历史保存上限删除任何未完成订单。',
  '真实剪枝只淘汰过期或超过 800 笔的已关闭历史，不得因历史保存上限删除任何未完成订单。需求周期结算仍可在同一运行时中维护按需求组组织的轻量订单历史集合，以读取本周期已经成交或撤销的需求订单；该历史集合不得作为第二套盘口，不参与价格排序、撮合候选、玩家开放订单计数、仓库预占或工厂冻结聚合。',
);

replaceExact(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '订单 ID 查询与撤单必须复用 `orderById`，不得恢复全量线性查找。以上边界由订单簿运行时测试、剪枝测试、`scripts/verify-order-matching-core.mjs` 与 `scripts/verify-runtime-efficiency.mjs` 防回退。',
  '订单 ID 查询与撤单必须复用 `orderById`，不得恢复全量线性查找。市场需求周期结算所需的需求组历史集合可以保留已关闭需求订单，但只承担有界历史查询，不得进入活动盘口、价格排序或玩家资产聚合，也不得演变为玩家／系统分离盘口。以上边界由订单簿运行时测试、剪枝测试、市场需求服务器测试、`scripts/verify-order-matching-core.mjs` 与 `scripts/verify-runtime-efficiency.mjs` 防回退。',
);
