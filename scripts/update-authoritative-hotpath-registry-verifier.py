from pathlib import Path

path = Path('scripts/verify-authoritative-hotpaths.mjs')
source = path.read_text(encoding='utf-8')
old = """  'server/src/world-storage-v2.js',
  'server/src/authoritative-write-executor.js',
"""
new = """  'server/src/world-storage-v2.js',
  'server/src/player-action-registry.js',
  'server/src/authoritative-write-executor.js',
"""
if source.count(old) != 1:
    raise SystemExit('required files block changed')
source = source.replace(old, new, 1)
old = """const worldStorage = read('server/src/world-storage-v2.js');
for (const text of [
  'WORLD_STORAGE_SCHEMA_VERSION = 2',
  'createRuntimeMutationScope',
  'cloneWorldForMutation',
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  "label: 'commodity:placeOrder'",
]) assert.ok(worldStorage.includes(text), `分段世界存储缺少: ${text}`);
"""
new = """const worldStorage = read('server/src/world-storage-v2.js');
const actionRegistry = read('server/src/player-action-registry.js');
for (const text of [
  'WORLD_STORAGE_SCHEMA_VERSION = 2',
  'createRuntimeMutationScope',
  'cloneWorldForMutation',
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  'getPlayerActionMetadata(action)',
  'requireOrderExecutionMetadata(execution)',
  "? 'commodity:placeOrder'",
]) assert.ok(worldStorage.includes(text), `分段世界存储缺少: ${text}`);
for (const text of [
  "placeOrder: defineAction({ rateLimitCategory: 'orders', mutationScope: 'order'",
  "cancelOrder: defineAction({ rateLimitCategory: 'orders', mutationScope: 'order'",
  'ORDER_EXECUTION_REGISTRY',
]) assert.ok(actionRegistry.includes(text), `玩家动作注册表缺少订单热路径规则: ${text}`);
"""
if source.count(old) != 1:
    raise SystemExit('world storage verifier block changed')
source = source.replace(old, new, 1)
path.write_text(source, encoding='utf-8')
print('authoritative hotpath verifier migrated to action registry')
