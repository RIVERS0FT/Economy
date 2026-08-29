import { readFileSync, writeFileSync } from 'node:fs';

function replaceRequired(path, from, to, label) {
  const content = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
  if (!content.includes(from)) throw new Error(`${label}: source text not found`);
  writeFileSync(path, content.replace(from, to), 'utf8');
}

replaceRequired(
  'src/auto-trade/useOnlineAutoTrade.ts',
  `    const enabledSellProductIds = Object.entries(sellPolicies)\n      .filter(([, policy]) => policy?.enabled)\n      .map(([productId]) => productId)\n      .sort(byCatalogOrder);\n    const enabledBuyProductIds = Object.entries(buyPolicies)\n      .filter(([, policy]) => policy?.enabled)\n      .map(([productId]) => productId)\n      .sort(byCatalogOrder);\n\n    const sellProductId = enabledSellProductIds.find((productId) => {\n      const status = statusFor(productId, game);\n      return (!status.blockedSellByOwnBuy && status.sellNeedsMaintenance)\n        || (status.blockedSellByOwnBuy && status.hasManagedSellOrder);\n    });\n    const buyProductId = sellProductId ? undefined : enabledBuyProductIds.find((productId) => {\n      const status = statusFor(productId, game);\n      return (!status.blockedBuyByOwnSell && status.buyNeedsMaintenance)\n        || (status.blockedBuyByOwnSell && status.hasManagedBuyOrder);\n    });\n    const productId = sellProductId ?? buyProductId;\n    if (!productId) return;\n    const side = sellProductId ? 'sell' : 'buy';\n    const sellPolicy = sellPolicies[productId];\n    const buyPolicy = buyPolicies[productId];`,
  `    const enabledSellProductIds = Object.entries(sellPolicies)\n      .filter(([, policy]) => policy?.enabled)\n      .map(([productId]) => productId);\n    const enabledBuyProductIds = Object.entries(buyPolicies)\n      .filter(([, policy]) => policy?.enabled)\n      .map(([productId]) => productId);\n    // Legacy managed links remain maintenance candidates even when factory-derived policy is now disabled.\n    // The server re-derives authority and commits cancellation before these links can influence the new strategy.\n    const sellProductIds = [...new Set([\n      ...enabledSellProductIds,\n      ...Object.keys(game.onlineAutoSellManagedOrderIds ?? {}),\n    ])].sort(byCatalogOrder);\n    const buyProductIds = [...new Set([\n      ...enabledBuyProductIds,\n      ...Object.keys(game.onlineAutoBuyManagedOrderIds ?? {}),\n    ])].sort(byCatalogOrder);\n\n    const sellProductId = sellProductIds.find((productId) => {\n      const status = statusFor(productId, game);\n      const policy = sellPolicies[productId];\n      if (!policy?.enabled) return status.hasManagedSellOrder;\n      return (!status.blockedSellByOwnBuy && status.sellNeedsMaintenance)\n        || (status.blockedSellByOwnBuy && status.hasManagedSellOrder);\n    });\n    const buyProductId = sellProductId ? undefined : buyProductIds.find((productId) => {\n      const status = statusFor(productId, game);\n      const policy = buyPolicies[productId];\n      if (!policy?.enabled) return status.hasManagedBuyOrder;\n      return (!status.blockedBuyByOwnSell && status.buyNeedsMaintenance)\n        || (status.blockedBuyByOwnSell && status.hasManagedBuyOrder);\n    });\n    const productId = sellProductId ?? buyProductId;\n    if (!productId) return;\n    const side = sellProductId ? 'sell' : 'buy';\n    const sellPolicy = sellPolicies[productId];\n    const buyPolicy = buyPolicies[productId];`,
  'client stale managed candidate scan',
);

replaceRequired(
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  '旧浏览器设置不得再提供新的编辑入口。历史已经挂出的真实自动订单仍是合法统一订单簿资产，不得在只读状态请求中偷偷撤单或推进 revision；玩家下一次保存工厂自动经营、建造、启停或切换生产配置时，服务器按最新工厂策略重平衡相关托管单。玩家也可以像普通订单一样手动撤销历史开放订单。',
  '旧浏览器设置不得再提供新的编辑入口。历史已经挂出的真实自动订单仍是合法统一订单簿资产，不得在只读状态请求中偷偷撤单或推进 revision；玩家下一次保存工厂自动经营、建造、启停或切换生产配置时，服务器按最新工厂策略重平衡相关托管单。在线客户端还必须把仍存在 managed-order ID 的商品加入维护候选，即使新工厂策略已经关闭对应采购／出售；服务器重新派生策略后撤销旧托管单并以成功维护结果提交撤单与解冻，不能因返回失败结果让事务回滚。玩家也可以像普通订单一样手动撤销历史开放订单。',
  'legacy managed order cleanup authority',
);

replaceRequired(
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  '在线自动经营维护器只在 `catalog`、`player.assets`、`player.production`、`market.orders`、`market.quotes` 或 `contract` 变化时重新判断维护需求；纯经济事件、银行、签到、研发计时或排行榜变化不得触发自动经营扫描。维护候选只遍历工厂策略派生后实际启用采购／出售的商品，并复用当前 `market.orders` 对应的客户端订单索引识别托管单、自己的交叉单和可成交外部盘口。',
  '在线自动经营维护器只在 `catalog`、`player.assets`、`player.production`、`market.orders`、`market.quotes` 或 `contract` 变化时重新判断维护需求；纯经济事件、银行、签到、研发计时或排行榜变化不得触发自动经营扫描。维护候选只遍历工厂策略派生后实际启用采购／出售的商品，以及仍持有旧 managed-order ID、需要撤单清理的商品；并复用当前 `market.orders` 对应的客户端订单索引识别托管单、自己的交叉单和可成交外部盘口。',
  'managed cleanup performance boundary',
);

replaceRequired(
  'scripts/verify-online-auto-sell.mjs',
  `  ['server/src/online-auto-buy.js', [\n    'factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.buy',\n    '当前工厂策略无需自动采购该商品',\n    'managedOnlineAutoBuyOrderFor',\n    'applySettledCommodityOrder',\n  ]],`,
  `  ['server/src/online-auto-buy.js', [\n    'factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.buy',\n    '当前工厂策略无需自动采购该商品',\n    '已撤销旧托管买单',\n    'managedOnlineAutoBuyOrderFor',\n    'applySettledCommodityOrder',\n  ]],`,
  'buy cancellation verifier',
);

replaceRequired(
  'scripts/verify-online-auto-sell.mjs',
  `  ['server/src/online-auto-sell.js', [\n    'factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.sell',\n    '当前工厂策略无需自动出售该商品',\n    'productionReservedQuantitiesForPlayer',\n    'contractAvailableHoldForOnlineTrade',\n    'managedOnlineAutoSellOrderFor',\n  ]],`,
  `  ['server/src/online-auto-sell.js', [\n    'factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.sell',\n    '当前工厂策略无需自动出售该商品',\n    '已撤销旧托管卖单',\n    'productionReservedQuantitiesForPlayer',\n    'contractAvailableHoldForOnlineTrade',\n    'managedOnlineAutoSellOrderFor',\n  ]],`,
  'sell cancellation verifier',
);

replaceRequired(
  'scripts/verify-online-auto-sell.mjs',
  `  ['src/api/game.ts', [\n    'FactoryAutoOperationPolicyInput',`,
  `  ['src/auto-trade/useOnlineAutoTrade.ts', [\n    'Object.keys(game.onlineAutoSellManagedOrderIds ?? {})',\n    'Object.keys(game.onlineAutoBuyManagedOrderIds ?? {})',\n    'if (!policy?.enabled) return status.hasManagedSellOrder',\n    'if (!policy?.enabled) return status.hasManagedBuyOrder',\n  ]],\n  ['src/api/game.ts', [\n    'FactoryAutoOperationPolicyInput',`,
  'client stale managed verifier',
);

console.log('Stale managed automatic-order cleanup applied.');
