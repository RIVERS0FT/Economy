from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8', newline='\n')


def replace(path, old, new, count=1):
    text = read(path)
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} matches, found {actual}: {old!r}')
    write(path, text.replace(old, new, count))


# Remove the retired Work dimension from new admin activity telemetry writes.
path = 'server/src/player-admin-statistics.js'
replace(path, """function actionCounts(action) {
  return {
    work: action === 'work' ? 1 : 0,
    facility: FACILITY_ACTIONS.has(action) ? 1 : 0,
    order: ORDER_ACTIONS.has(action) ? 1 : 0,
    contract: CONTRACT_ACTIONS.has(action) ? 1 : 0,
    auction: AUCTION_ACTIONS.has(action) ? 1 : 0,
  };
}
""", """function actionCounts(action) {
  return {
    facility: FACILITY_ACTIONS.has(action) ? 1 : 0,
    order: ORDER_ACTIONS.has(action) ? 1 : 0,
    contract: CONTRACT_ACTIONS.has(action) ? 1 : 0,
    auction: AUCTION_ACTIONS.has(action) ? 1 : 0,
  };
}
""")
replace(path, "      work_count INTEGER NOT NULL DEFAULT 0 CHECK (work_count >= 0),\n", '')
replace(path, """        day_key, user_id, successful_action_count, work_count, facility_action_count,
        order_action_count, contract_action_count, auction_action_count,
        production_output_count, trade_quantity, contract_delivery_count,
        first_activity_at, last_activity_at
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
      ON CONFLICT(day_key, user_id) DO UPDATE SET
        successful_action_count = successful_action_count + 1,
        work_count = work_count + excluded.work_count,
        facility_action_count = facility_action_count + excluded.facility_action_count,
""", """        day_key, user_id, successful_action_count, facility_action_count,
        order_action_count, contract_action_count, auction_action_count,
        production_output_count, trade_quantity, contract_delivery_count,
        first_activity_at, last_activity_at
      ) VALUES (?, ?, 1, ?, ?, ?, ?, 0, 0, 0, ?, ?)
      ON CONFLICT(day_key, user_id) DO UPDATE SET
        successful_action_count = successful_action_count + 1,
        facility_action_count = facility_action_count + excluded.facility_action_count,
""")
replace(path, """        day_key, user_id, successful_action_count, work_count, facility_action_count,
        order_action_count, contract_action_count, auction_action_count,
        production_output_count, trade_quantity, contract_delivery_count,
        first_activity_at, last_activity_at
      ) VALUES (?, ?, 0, 0, 0, 0, 0, 0, ?, ?, ?, NULL, NULL)
""", """        day_key, user_id, successful_action_count, facility_action_count,
        order_action_count, contract_action_count, auction_action_count,
        production_output_count, trade_quantity, contract_delivery_count,
        first_activity_at, last_activity_at
      ) VALUES (?, ?, 0, 0, 0, 0, 0, ?, ?, ?, NULL, NULL)
""")
replace(path, """    counts.work,
    counts.facility,
""", """    counts.facility,
""")

# Convert remaining tests from retired Work actions to live actions while preserving test intent.
path = 'server/test/asset-events.test.js'
replace(path, "test('runtime COW work remains valid after V2 persistence strips presentation logs'", "test('runtime COW local action remains valid after V2 persistence strips presentation logs'")
replace(path, """    const worked = store.apply(alice, request(
      'work',
      {},
      'work-after-log-strip-12345678',
      '/api/game/work',
    ), now + 1);
    assert.equal(worked.result.ok, true);
""", """    const deposited = store.apply(alice, request(
      'bankDeposit',
      { amount: 1 },
      'bank-after-log-strip-12345678',
      '/api/game/bank/deposits',
    ), now + 1);
    assert.equal(deposited.result.ok, true);
""")

path = 'server/test/runtime-hot-path.test.js'
replace(path, """    const action = store.apply(alice, {
      action: 'work',
      payload: {},
      requestKey: 'hot-path-work-1',
      method: 'POST',
      path: '/api/game/work',
    }, now + 3_001);
""", """    const action = store.apply(alice, {
      action: 'bankDeposit',
      payload: { amount: 1 },
      requestKey: 'hot-path-bank-deposit-1',
      method: 'POST',
      path: '/api/game/bank/deposits',
    }, now + 3_001);
""")
replace(path, """    store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'cleanup-initial-1', method: 'POST', path: '/api/game/work',
    }, now + 3_001);
""", """    store.apply(alice, {
      action: 'bankDeposit', payload: { amount: 1 }, requestKey: 'cleanup-initial-1', method: 'POST', path: '/api/game/bank/deposits',
    }, now + 3_001);
""")
replace(path, "      '/api/game/work',\n", "      '/api/game/bank/deposits',\n")
replace(path, """    store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'cleanup-within-window-1', method: 'POST', path: '/api/game/work',
    }, now + 4_001);
""", """    store.apply(alice, {
      action: 'bankDeposit', payload: { amount: 1 }, requestKey: 'cleanup-within-window-1', method: 'POST', path: '/api/game/bank/deposits',
    }, now + 4_001);
""")
replace(path, """    store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'cleanup-after-window-1', method: 'POST', path: '/api/game/work',
    }, now + 5 * 60 * 1_000 + 3_002);
""", """    store.apply(alice, {
      action: 'bankDeposit', payload: { amount: 1 }, requestKey: 'cleanup-after-window-1', method: 'POST', path: '/api/game/bank/deposits',
    }, now + 5 * 60 * 1_000 + 3_002);
""")

path = 'server/test/state-polling.test.js'
replace(path, """    const action = store.apply(alice, {
      action: 'work',
      payload: {},
      requestKey: 'state-poll-work-1',
      method: 'POST',
      path: '/api/game/work',
    }, now + 2_000);
""", """    const action = store.apply(alice, {
      action: 'bankDeposit',
      payload: { amount: 1 },
      requestKey: 'state-poll-bank-deposit-1',
      method: 'POST',
      path: '/api/game/bank/deposits',
    }, now + 2_000);
""")
replace(path, '    assert.equal(changed.state.credits, 501);\n', '    assert.equal(changed.state.credits, 499);\n')
replace(path, "test('another player work action does not send an unrelated viewer a full market partition'", "test('another player local bank action does not send an unrelated viewer a full market partition'")
replace(path, """    const action = store.apply(bob, {
      action: 'work',
      payload: {},
      requestKey: 'state-poll-bob-work-1',
      method: 'POST',
      path: '/api/game/work',
    }, now + 100);
""", """    const action = store.apply(bob, {
      action: 'bankDeposit',
      payload: { amount: 1 },
      requestKey: 'state-poll-bob-bank-deposit-1',
      method: 'POST',
      path: '/api/game/bank/deposits',
    }, now + 100);
""")
replace(path, """    assert.equal(changed.patches.market, undefined);
    assert.ok(changed.patches.leaderboard?.leaderboards);
    assert.equal(changed.patches.leaderboard.leaderboards.generatedAt, undefined);
""", """    assert.equal(changed.patches?.market, undefined);
""")

path = 'server/test/player-admin-statistics.test.js'
replace(path, """    const request = {
      action: 'work',
      payload: {},
      requestKey: 'player-stats-work-1',
      method: 'POST',
      path: '/api/game/work',
    };
""", """    const request = {
      action: 'placeOrder',
      payload: {
        provinceId: 'california',
        assetKind: 'commodity',
        assetId: 'wheat',
        productId: 'wheat',
        side: 'buy',
        quantity: 1,
        price: 1,
      },
      requestKey: 'player-stats-order-1',
      method: 'POST',
      path: '/api/game/orders',
    };
""")
replace(path, """    const activity = store.database.prepare(`
      SELECT successful_action_count, work_count, production_output_count, trade_quantity
      FROM economy_player_activity_daily WHERE user_id = ?
    `).get(player.id);
    assert.equal(activity.successful_action_count, 1);
    assert.equal(activity.work_count, 1);
""", """    const activity = store.database.prepare(`
      SELECT successful_action_count, order_action_count, production_output_count, trade_quantity
      FROM economy_player_activity_daily WHERE user_id = ?
    `).get(player.id);
    assert.equal(activity.successful_action_count, 1);
    assert.equal(activity.order_action_count, 1);
""")
marker = """    assert.equal(activity.trade_quantity, 0);

    store.transaction(() => {
"""
replace(path, marker, """    assert.equal(activity.trade_quantity, 0);
    const activityColumns = store.database.prepare('PRAGMA table_info(economy_player_activity_daily)').all()
      .map((column) => String(column.name));
    assert.equal(activityColumns.includes('work_count'), false);

    store.transaction(() => {
""")

# Design and verifier record the retired admin telemetry dimension and compatible old-column behavior.
path = 'docs/GIFT_CODE_AND_ADMIN_DESIGN.md'
replace(path,
        '经济活跃的唯一口径是成功经济写操作：工作、建设或控制工厂、订单、仓库扩容、礼品兑换、宝石兑换、拍卖与长期合同等动作只有在服务器事务成功并更新 `lastEconomicActivityAt` 时才计入。状态轮询、失败动作、幂等重放、管理员读取以及后台生产、成交或合同自动结算不得计入经济活跃；后台结算可以独立计入生产／成交／合同参与，但不能刷新玩家活跃时间。',
        '经济活跃的唯一口径是成功经济写操作：建设或控制工厂、订单、仓库扩容、礼品兑换、宝石兑换、拍卖与长期合同等动作只有在服务器事务成功并更新 `lastEconomicActivityAt` 时才计入。状态轮询、失败动作、幂等重放、管理员读取以及后台生产、成交或合同自动结算不得计入经济活跃；后台结算可以独立计入生产／成交／合同参与，但不能刷新玩家活跃时间。工作玩法已经退役，新的日活动表不再创建或写入 `work_count`；已有正式数据库若保留该历史列，只作为无人读取的兼容冗余，避免为删除统计列重建分析表。')

path = 'scripts/verify-admin-player-statistics.mjs'
marker = """forbidText('server/src/player-admin-statistics.js', [
  'collectibleAuctions',
  'createCollectibleAuction',
  'placeCollectibleBid',
  'cancelCollectibleAuction',
  'function frozenFacilityQuantity(world, userId, facilityTypeId)',
]);
"""
replace(path, marker, """forbidText('server/src/player-admin-statistics.js', [
  'collectibleAuctions',
  'createCollectibleAuction',
  'placeCollectibleBid',
  'cancelCollectibleAuction',
  'function frozenFacilityQuantity(world, userId, facilityTypeId)',
  "action === 'work'",
  'work_count',
  'counts.work',
]);
""")
replace(path, """  'assert.equal(activity.successful_action_count, 1)',
""", """  'assert.equal(activity.successful_action_count, 1)',
  "assert.equal(activityColumns.includes('work_count'), false)",
""")
replace(path, """  '成功经济写操作',
  '精确日活动覆盖起点',
""", """  '成功经济写操作',
  '新的日活动表不再创建或写入 `work_count`',
  '精确日活动覆盖起点',
""", count=1)

# Final executable-source guard. Explicit retirement tests/verifiers/docs may still mention the old route.
checks = {
    'server/src/player-admin-statistics.js': ["action === 'work'", 'work_count', 'counts.work'],
    'server/test/asset-events.test.js': ["action: 'work'", '/api/game/work'],
    'server/test/player-admin-statistics.test.js': ["action: 'work'", '/api/game/work'],
    'server/test/runtime-hot-path.test.js': ["action: 'work'", '/api/game/work'],
    'server/test/state-polling.test.js': ["action: 'work'", '/api/game/work'],
}
for file, fragments in checks.items():
    source = read(file)
    for fragment in fragments:
        if fragment in source:
            raise SystemExit(f'{file}: retired Work executable reference remains: {fragment}')

print('retired Work telemetry and stale tests cleaned')
