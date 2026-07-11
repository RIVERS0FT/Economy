from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative_path: str, old: str, new: str) -> None:
    path = ROOT / relative_path
    text = path.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'{relative_path} 缺少预期内容:\n{old}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'server/src/facility-groups.js',
    """  for (const player of Object.values(world.players || {})) {
    for (const group of player.facilityGroups || []) {
      const listed = listedQuantity(world, player.userId, group.facilityTypeId);
      if (listed > 0 && group.status !== 'running') {
        group.status = 'listed';
        group.stopReason = 'listed';
      } else if (listed === 0 && group.status === 'listed') {
        group.status = 'paused';
        group.stopReason = 'manual';
      }
    }
  }
""",
    """  for (const player of Object.values(world.players || {})) {
    for (const group of player.facilityGroups || []) {
      const listed = listedQuantity(world, player.userId, group.facilityTypeId);
      const available = Math.max(0, group.count - listed);
      if (group.status === 'listed' || group.stopReason === 'listed') {
        group.status = group.count === 1 ? 'ready' : 'paused';
        group.stopReason = 'manual';
      }
      if (group.status === 'running') {
        group.participatingCount = Math.min(group.participatingCount, available);
        group.pendingJoinCount = Math.min(
          group.pendingJoinCount,
          Math.max(0, available - group.participatingCount),
        );
        if (group.participatingCount < 1) {
          group.status = 'paused';
          group.stopReason = 'manual';
          group.participatingCount = 0;
          group.pendingJoinCount = 0;
          delete group.cycleStartedAt;
        }
      }
    }
  }
""",
)

replace_once(
    'server/src/facility-groups.js',
    """  } else if (group.status !== 'listed') {
    group.status = group.count === 1 ? 'ready' : 'paused';
    group.stopReason = 'manual';
  }
""",
    """  } else {
    group.status = group.count === 1 ? 'ready' : 'paused';
    group.stopReason = 'manual';
  }
""",
)

replace_once(
    'server/src/facility-groups.js',
    """  if (!type || !group || group.count < 1) return result(false, '工厂集群不存在');
  if (listedQuantity(world, userId, type.id) > 0) return result(false, '存在挂牌数量时不能启动该工厂集群');
  if (group.status === 'running') return result(false, '工厂集群已经运行');
  const blocked = blockReason(world, player, group, type, group.count);
""",
    """  if (!type || !group || group.count < 1) return result(false, '工厂集群不存在');
  if (group.status === 'running') return result(false, '工厂集群已经运行');
  const availableCount = Math.max(0, group.count - listedQuantity(world, userId, type.id));
  if (availableCount < 1) return result(false, '没有未挂牌工厂可启动');
  const blocked = blockReason(world, player, group, type, availableCount);
""",
)

replace_once(
    'server/src/facility-groups.js',
    """  group.participatingCount = group.count;
  group.pendingJoinCount = 0;
  group.cycleStartedAt = now;
  return result(true, `${type.name}集群已统一启动，共 ${group.count} 座参与生产`);
""",
    """  group.participatingCount = availableCount;
  group.pendingJoinCount = 0;
  group.cycleStartedAt = now;
  return result(true, `${type.name}集群已启动，${availableCount} 座未挂牌工厂参与生产`);
""",
)

replace_once(
    'server/src/facility-groups.js',
    """  if (!group) return result(false, '工厂集群不存在');
  if (group.status === 'running') return result(false, '请先停止工厂集群再修改生产计划');
  if (listedQuantity(world, userId, type.id) > 0) return result(false, '存在挂牌数量时不能修改生产计划');
  const mode = payload.mode === 'target' ? 'target' : payload.mode === 'continuous' ? 'continuous' : null;
""",
    """  if (!group) return result(false, '工厂集群不存在');
  if (group.status === 'running') return result(false, '请先停止工厂集群再修改生产计划');
  const availableCount = Math.max(0, group.count - listedQuantity(world, userId, type.id));
  if (availableCount < 1) return result(false, '没有未挂牌工厂可设置生产计划');
  const mode = payload.mode === 'target' ? 'target' : payload.mode === 'continuous' ? 'continuous' : null;
""",
)

replace_once(
    'server/src/facility-groups.js',
    "  const cycleOutput = type.output.quantity * group.count;\n",
    "  const cycleOutput = type.output.quantity * availableCount;\n",
)

replace_once(
    'server/src/facility-groups.js',
    """  group.status = 'listed';
  group.stopReason = 'listed';
  group.participatingCount = 0;
  group.pendingJoinCount = 0;
  delete group.cycleStartedAt;
  return result(true, `${quantity} 座${type.name}已按单价 ¤${unitPrice} 挂牌`);
""",
    """  return result(true, `${quantity} 座${type.name}已按单价 ¤${unitPrice} 挂牌；挂牌工厂不参与生产`);
""",
)

replace_once(
    'server/src/facility-groups.js',
    """  if (group && listedQuantity(world, userId, listing.facilityTypeId) === 0) {
    group.status = 'paused';
    group.stopReason = 'manual';
  }
""",
    """  if (group?.status === 'running') {
    group.pendingJoinCount += listing.quantity;
  } else if (group && (group.status === 'listed' || group.stopReason === 'listed')) {
    group.status = group.count === 1 ? 'ready' : 'paused';
    group.stopReason = 'manual';
  }
""",
)

replace_once(
    'server/src/facility-groups.js',
    """  else if (group.status !== 'listed') {
    group.status = group.count === quantity ? 'ready' : 'paused';
    group.stopReason = 'manual';
  }
""",
    """  else {
    group.status = group.count === quantity ? 'ready' : 'paused';
    group.stopReason = 'manual';
  }
""",
)

replace_once(
    'server/src/facility-groups.js',
    """  if (listing.ownerType === 'player') {
    const seller = getPlayer(world, listing.ownerId);
    const sellerGroup = groupFor(seller, listing.facilityTypeId);
    if (sellerGroup && listedQuantity(world, seller.userId, listing.facilityTypeId) === 0) {
      sellerGroup.status = 'paused';
      sellerGroup.stopReason = 'manual';
    }
  }

""",
    "",
)

replace_once(
    'src/pages/ProductionPage.tsx',
    'description="同类工厂组成一个数量型集群，共享统一生产周期、生产计划和启停状态；新建或收购数量从下一周期加入。"',
    'description="同类未挂牌工厂共享统一生产周期、生产计划和启停状态；挂牌工厂不参与生产，新建、收购或撤销挂牌的数量从下一周期加入。"',
)
replace_once(
    'src/pages/ProductionPage.tsx',
    """            const canConfigure = group.status !== 'running' && group.listedCount === 0;
            const canStart = group.status !== 'running' && group.listedCount === 0 && group.availableCount > 0;
""",
    """            const canConfigure = group.status !== 'running' && group.availableCount > 0;
            const canStart = group.status !== 'running' && group.availableCount > 0;
""",
)
replace_once(
    'src/pages/ProductionPage.tsx',
    """                    <Button disabled={!canStart} onClick={() => void showResult(startFacility(group.facilityTypeId))}>启动全部</Button>
""",
    """                    <Button disabled={!canStart} onClick={() => void showResult(startFacility(group.facilityTypeId))}>启动全部未挂牌工厂</Button>
""",
)
replace_once(
    'src/pages/ProductionPage.tsx',
    """                  <span className="ui-helper-text">同类工厂统一启停，产成品自动入仓。</span>
""",
    """                  <span className="ui-helper-text">挂牌工厂不参与生产；启动时仅 {group.availableCount} 座未挂牌工厂进入统一周期，产成品自动入仓。</span>
""",
)

replace_once(
    'README.md',
    '存在挂牌数量时，该类型集群不能启动。',
    '存在挂牌数量时，该类型集群仍可启动未挂牌数量。挂牌工厂不参与生产；运行中撤销挂牌的数量从下一周期加入。',
)

replace_once(
    'docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
    '- 同类型工厂统一启动、统一停止；不支持部分启停。',
    '- 同类型未挂牌工厂统一启动、统一停止；挂牌工厂不参与生产。',
)
replace_once(
    'docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
    '存在任何挂牌数量时，该类型集群不能启动，避免产生隐性单座状态差异。',
    '存在挂牌数量时，该类型集群仍可启动全部未挂牌工厂。启动时 `participatingCount = availableCount`，挂牌数量保持冻结且不参与生产。运行中撤销挂牌时，解冻数量进入 `pendingJoinCount`，从下一周期加入，不重置当前进度。',
)
replace_once(
    'docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
    """- 集群必须停止；
- 数量不能超过未挂牌数量；
""",
    """- 新增挂牌时集群必须停止；
- 数量不能超过未挂牌数量；
- 挂牌数量从可生产数量中冻结，挂牌工厂不参与生产；
- 已有挂牌不阻止未挂牌数量启动和生产；
- 运行中撤销挂牌时，解冻数量从下一周期加入；
""",
)
replace_once(
    'docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
    '17. 页面不出现工厂实例、小时指标、累计产量或系统估值。',
    '17. 页面不出现工厂实例、小时指标、累计产量或系统估值；\n18. 挂牌工厂不参与生产，已有挂牌不阻止未挂牌数量启动；\n19. 运行中撤销挂牌的数量只从下一周期加入；\n20. 出售挂牌数量不得停止卖方正在运行的未挂牌集群。',
)

replace_once(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    '- 同类工厂只能统一启动或统一停止。',
    '- 同类未挂牌工厂只能统一启动或统一停止；挂牌工厂不参与生产。',
)
replace_once(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    '存在挂牌数量时，该类型集群不能启动。',
    '存在挂牌数量时，该类型集群仍可按 `availableCount = count - listedCount` 启动未挂牌数量。挂牌工厂不参与生产；运行中撤销挂牌的数量进入 `pendingJoinCount`，从下一周期加入。',
)
replace_once(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    """- 集群必须停止；
- 挂牌数量不能超过未挂牌数量；
""",
    """- 新增挂牌时集群必须停止；
- 挂牌数量不能超过未挂牌数量；
- 挂牌数量不参与生产，但不阻止未挂牌数量启动；
- 运行中撤销挂牌的数量从下一周期加入；
""",
)
replace_once(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    '10. 幂等请求不重复改变数量。',
    '10. 幂等请求不重复改变数量；\n11. 挂牌工厂不参与生产且不阻止未挂牌数量启动；\n12. 撤销挂牌和出售挂牌数量不得破坏当前周期。',
)

replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '- 统一启动全部或停止全部；',
    '- 启动全部未挂牌工厂或停止当前生产集群；\n- 挂牌工厂不参与生产，已有挂牌不阻止未挂牌数量启动；',
)

replace_once(
    'scripts/verify-page-content.mjs',
    """   '周期产量', '周期成本', '原料库存', '统一生产计划', '启动全部', '停止全部', '挂牌数量', '单座价格',
""",
    """   '周期产量', '周期成本', '原料库存', '统一生产计划', '启动全部未挂牌工厂', '停止全部',
   '挂牌工厂不参与生产', '挂牌数量', '单座价格',
""",
)

replace_once(
    'scripts/verify-facility-groups-market-v3.mjs',
    """   'listFacilityGroup',
   'buyFacilityGroup',
""",
    """   'listFacilityGroup',
   'buyFacilityGroup',
   'const availableCount = Math.max(0, group.count - listedQuantity',
   'group.pendingJoinCount += listing.quantity',
""",
)
replace_once(
    'scripts/verify-facility-groups-market-v3.mjs',
    """   'facility group actions remain idempotent',
""",
    """   'facility group actions remain idempotent',
   'listed factories are excluded while unlisted factories can start and produce',
   'target plan uses only unlisted factory quantity',
   'cancelling a listing during production joins that quantity next cycle',
   'selling listed factories does not stop the seller running group',
""",
)
replace_once(
    'scripts/verify-facility-groups-market-v3.mjs',
    """   '同类型工厂统一启动、统一停止', '工厂挂牌和购买按类型、数量和单座价格',
""",
    """   '同类型未挂牌工厂统一启动、统一停止', '挂牌工厂不参与生产', '未挂牌数量启动',
   '工厂挂牌和购买按类型、数量和单座价格',
""",
)
replace_once(
    'scripts/verify-facility-groups-market-v3.mjs',
    """if (failures.length) {
""",
    """forbidText('server/src/facility-groups.js', '存在挂牌数量时不能启动该工厂集群');
forbidText('src/pages/ProductionPage.tsx', 'group.listedCount === 0');

if (failures.length) {
""",
)

new_test = ROOT / 'server/test/listed-factory-production.test.js'
new_test.write_text("""import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const now = 1_700_000_000_000;

function group(overrides = {}) {
  return {
    facilityTypeId: 'farm',
    count: 5,
    participatingCount: 0,
    pendingJoinCount: 0,
    status: 'paused',
    stopReason: 'manual',
    productionMode: 'continuous',
    completedQuantity: 0,
    ...overrides,
  };
}

function listing(ownerId, quantity = 2) {
  return {
    id: `farm-listing-${ownerId}`,
    facilityTypeId: 'farm',
    ownerType: 'player',
    ownerId,
    ownerName: ownerId === alice.id ? 'Alice' : 'Bob',
    quantity,
    unitPrice: 80,
    createdAt: now,
  };
}

function action(actionName, payload, key, path) {
  return { action: actionName, payload, requestKey: key, method: 'POST', path };
}

function seedStore(configure) {
  const store = new EconomyStore(':memory:');
  const world = createWorld(now);
  const alicePlayer = ensurePlayer(world, alice, now);
  const bobPlayer = ensurePlayer(world, bob, now);
  alicePlayer.credits = 10_000;
  bobPlayer.credits = 10_000;
  configure?.({ world, alicePlayer, bobPlayer });
  store.insertWorld.run(1, JSON.stringify(world), now - 60_000);
  return store;
}

test('listed factories are excluded while unlisted factories can start and produce', () => {
  const store = seedStore(({ world, alicePlayer }) => {
    alicePlayer.facilityGroups = [group()];
    world.facilityListings.push(listing(alice.id, 2));
  });
  try {
    const started = store.apply(alice, action(
      'startFacility',
      { facilityTypeId: 'farm' },
      'start-listed-farm-12345678',
      '/api/game/facilities/farm/start',
    ), now + 1);
    const startedFarm = started.state.facilityGroups[0];
    assert.equal(started.result.ok, true);
    assert.equal(startedFarm.status, 'running');
    assert.equal(startedFarm.count, 5);
    assert.equal(startedFarm.listedCount, 2);
    assert.equal(startedFarm.availableCount, 3);
    assert.equal(startedFarm.participatingCount, 3);

    const produced = store.getState(alice, now + 30_001);
    assert.equal(produced.inventories.grain.available, 6);
    assert.equal(produced.credits, 9_997);
    assert.equal(produced.facilityGroups[0].participatingCount, 3);
  } finally {
    store.close();
  }
});

test('target plan uses only unlisted factory quantity', () => {
  const store = seedStore(({ world, alicePlayer }) => {
    alicePlayer.facilityGroups = [group()];
    world.facilityListings.push(listing(alice.id, 2));
  });
  try {
    const planned = store.apply(alice, action(
      'setProductionPlan',
      { facilityTypeId: 'farm', mode: 'target', targetQuantity: 12 },
      'plan-listed-farm-12345678',
      '/api/game/facilities/farm/plan',
    ), now + 1);
    assert.equal(planned.result.ok, true);
    assert.equal(planned.state.facilityGroups[0].targetQuantity, 12);

    const invalid = store.apply(alice, action(
      'setProductionPlan',
      { facilityTypeId: 'farm', mode: 'target', targetQuantity: 10 },
      'plan-listed-farm-invalid-12345678',
      '/api/game/facilities/farm/plan',
    ), now + 2);
    assert.equal(invalid.result.ok, false);
    assert.match(invalid.result.message, /周期产量 6/);
  } finally {
    store.close();
  }
});

test('cancelling a listing during production joins that quantity next cycle', () => {
  const store = seedStore(({ world, alicePlayer }) => {
    alicePlayer.facilityGroups = [group()];
    world.facilityListings.push(listing(alice.id, 2));
  });
  try {
    store.apply(alice, action(
      'startFacility',
      { facilityTypeId: 'farm' },
      'start-before-unlist-12345678',
      '/api/game/facilities/farm/start',
    ), now + 1);
    const cancelled = store.apply(alice, action(
      'cancelFacilityListing',
      { listingId: `farm-listing-${alice.id}` },
      'cancel-running-listing-12345678',
      `/api/game/facility-listings/farm-listing-${alice.id}/cancel`,
    ), now + 10_000);
    const pending = cancelled.state.facilityGroups[0];
    assert.equal(cancelled.result.ok, true);
    assert.equal(pending.status, 'running');
    assert.equal(pending.participatingCount, 3);
    assert.equal(pending.pendingJoinCount, 2);
    assert.equal(pending.nextCycleCount, 5);

    const nextCycle = store.getState(alice, now + 30_001);
    assert.equal(nextCycle.inventories.grain.available, 6);
    assert.equal(nextCycle.facilityGroups[0].participatingCount, 5);
    assert.equal(nextCycle.facilityGroups[0].pendingJoinCount, 0);
  } finally {
    store.close();
  }
});

test('selling listed factories does not stop the seller running group', () => {
  const store = seedStore(({ world, bobPlayer }) => {
    bobPlayer.facilityGroups = [group()];
    world.facilityListings.push(listing(bob.id, 2));
  });
  try {
    const started = store.apply(bob, action(
      'startFacility',
      { facilityTypeId: 'farm' },
      'start-seller-listed-farm-12345678',
      '/api/game/facilities/farm/start',
    ), now + 1);
    assert.equal(started.result.ok, true);
    assert.equal(started.state.facilityGroups[0].participatingCount, 3);

    const bought = store.apply(alice, action(
      'buyFacility',
      { listingId: `farm-listing-${bob.id}`, quantity: 1 },
      'buy-running-seller-listing-12345678',
      `/api/game/facility-listings/farm-listing-${bob.id}/buy`,
    ), now + 2);
    assert.equal(bought.result.ok, true);

    const seller = store.getState(bob, now + 3);
    const farm = seller.facilityGroups[0];
    assert.equal(farm.status, 'running');
    assert.equal(farm.count, 4);
    assert.equal(farm.listedCount, 1);
    assert.equal(farm.availableCount, 3);
    assert.equal(farm.participatingCount, 3);
  } finally {
    store.close();
  }
});
""", encoding='utf-8')

# 临时迁移文件不会进入 PR。
(ROOT / '.github/workflows/apply-listed-factory-production.yml').unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
