from pathlib import Path


def replace(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing {label}')
    p.write_text(text.replace(old, new, 1))

# A cheap pure predicate lets ordinary actions preserve the existing single-transaction fast path.
replace(
    'server/src/production-input-sourcing.js',
    "function aggregateProductionDemand(world, userId, now) {",
    "function aggregateProductionDemand(world, userId, now) {",
    'aggregate demand anchor',
)
p = Path('server/src/production-input-sourcing.js')
text = p.read_text()
marker = "function buyMarketShortage(world, userId, productId, provinceId, shortage, now) {"
helper = """export function productionInputSourcingRequired(world, userId, now = Date.now()) {
  if (!world?.players?.[String(userId)]) return false;
  return aggregateProductionDemand(world, userId, now).size > 0;
}

"""
if 'export function productionInputSourcingRequired' not in text:
    if marker not in text:
        raise SystemExit('missing production sourcing helper marker')
    text = text.replace(marker, helper + marker, 1)
p.write_text(text)

# Existing legacy contracts, including old totalDeliveries=null long-term contracts, remain legacy.
p = Path('server/src/daily-supply-contracts.js')
text = p.read_text()
start = text.index('export function migrateDailySupplyContracts(world, now = Date.now()) {')
end = text.index('export function processDailySupplyContracts', start)
replacement = """export function migrateDailySupplyContracts(world, now = Date.now()) {
  world.productionContracts ||= [];
  world.productionContracts = world.productionContracts.map((contract) => (
    isDailySupplyContract(contract) ? normalizeDailyContract(contract, now) : contract
  ));
  return world;
}
"""
text = text[:start] + replacement + text[end:]
p.write_text(text)

# Preserve normal executeRuntimeAction path unless production really has due input demand.
p = Path('server/src/runtime-store.js')
text = p.read_text()
text = text.replace(
    "  finalizeProductionOutputContracts,\n  prepareProductionInputsForPlayer,\n} from './production-input-sourcing.js';",
    "  finalizeProductionOutputContracts,\n  prepareProductionInputsForPlayer,\n  productionInputSourcingRequired,\n} from './production-input-sourcing.js';",
    1,
)
old_apply = """  apply(user, requestMeta, now = Date.now()) {
    const prepared = this.prepareProductionInputs(user, requestMeta, now);
    if (prepared.cached) return prepared.cached;
    if (CONTRACT_ACTIONS.has(requestMeta.action)) return this.applyContractAction(user, requestMeta, prepared.baseline, now);
    const response = executeRuntimeAction(this, user, requestMeta, now);
    return this.finalizeProductionInputs(user, prepared.baseline, response, requestMeta, now);
  }
"""
new_apply = """  apply(user, requestMeta, now = Date.now()) {
    const needsProductionInputSourcing = this.worldCache?.world
      ? productionInputSourcingRequired(this.worldCache.world, Number(user.id), now)
      : true;
    if (!CONTRACT_ACTIONS.has(requestMeta.action) && !needsProductionInputSourcing) {
      return executeRuntimeAction(this, user, requestMeta, now);
    }
    if (!needsProductionInputSourcing) {
      return this.applyContractAction(user, requestMeta, null, now);
    }
    const prepared = this.prepareProductionInputs(user, requestMeta, now);
    if (prepared.cached) return prepared.cached;
    if (CONTRACT_ACTIONS.has(requestMeta.action)) return this.applyContractAction(user, requestMeta, prepared.baseline, now);
    const response = executeRuntimeAction(this, user, requestMeta, now);
    return this.finalizeProductionInputs(user, prepared.baseline, response, requestMeta, now);
  }
"""
if old_apply not in text:
    raise SystemExit('missing runtime apply anchor')
text = text.replace(old_apply, new_apply, 1)
p.write_text(text)

# Lock legacy long-term compatibility in server tests.
p = Path('server/test/daily-supply-contracts.test.js')
text = p.read_text()
if 'migrateDailySupplyContracts,' not in text:
    text = text.replace('  consumeDailySupplyForBuyer,\n', '  consumeDailySupplyForBuyer,\n  migrateDailySupplyContracts,\n', 1)
if "legacy long-term supply contracts are not force-migrated" not in text:
    text += """

test('legacy long-term supply contracts are not force-migrated', () => {
  const legacy = {
    id: 'legacy-long-term',
    kind: 'supply',
    publisherId: 1,
    publisherRole: 'buyer',
    buyerId: 1,
    supplierId: 2,
    productId: PRODUCT_ID,
    quantityPerDelivery: 10,
    unitPrice: 5,
    deliveryIntervalMs: CONTRACT_DAY_MS,
    totalDeliveries: null,
    completedDeliveries: 3,
    firstDeliveryDelayMs: 0,
    status: 'active',
    createdAt: NOW - CONTRACT_DAY_MS,
    acceptedAt: NOW - CONTRACT_DAY_MS,
    nextDueAt: NOW + CONTRACT_DAY_MS,
  };
  const state = world(legacy);
  migrateDailySupplyContracts(state, NOW);
  assert.equal(state.productionContracts[0].supplyMode, undefined);
  assert.equal(state.productionContracts[0].totalDeliveries, null);
  assert.equal(state.productionContracts[0].completedDeliveries, 3);
});
"""
p.write_text(text)

# The branch still has protocol 37 before merging latest main; avoid a stale hard-coded number in the new paragraph.
p = Path('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md')
text = p.read_text()
old = '客户端状态版本继续为 37、世界状态版本继续为 32，因为新增字段通过兼容别名与现有分区增量投影交付，不扩大兼容窗口。'
new = '客户端状态版本继续使用共享当前协议版本、世界状态版本继续为 32；本次合同字段通过兼容别名与现有分区增量投影交付，不单独扩大客户端兼容窗口。'
if old not in text:
    raise SystemExit('missing stale protocol paragraph')
p.write_text(text.replace(old, new, 1))

# Dedicated guard: legacy totalDeliveries=null must never be used as an implicit daily-migration trigger again.
p = Path('scripts/verify-daily-supply-contracts.mjs')
text = p.read_text()
needle = "requireText(daily, 'CONTRACT_DAY_OFFSET_MS = 8 * 60 * 60 * 1000', '每日额度自然日必须与北京时间边界一致。');"
addition = """requireText(daily, 'isDailySupplyContract(contract) ? normalizeDailyContract(contract, now) : contract', '旧商品合同迁移必须只规范已标记的每日合同。');
forbidText(daily, "contract?.totalDeliveries !== null", '每日合同迁移不得再用旧 totalDeliveries 是否为空判断并强制迁移旧长期合同。');
requireText(runtime, 'return executeRuntimeAction(this, user, requestMeta, now);', '无到期生产输入需求的普通动作必须保留既有单事务 fast path。');
"""
if addition.strip() not in text:
    if needle not in text:
        raise SystemExit('missing daily verifier guard anchor')
    text = text.replace(needle, needle + '\n' + addition, 1)
p.write_text(text)
