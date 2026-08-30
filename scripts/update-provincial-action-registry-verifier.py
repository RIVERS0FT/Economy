from pathlib import Path

path = Path('scripts/verify-provincial-unlock-transport.mjs')
source = path.read_text(encoding='utf-8')
old = """const storageV2 = read('server/src/world-storage-v2.js');
const stateSlices = read('server/shared/economy-state-slices.js');
"""
new = """const storageV2 = read('server/src/world-storage-v2.js');
const actionRegistry = read('server/src/player-action-registry.js');
const stateSlices = read('server/shared/economy-state-slices.js');
"""
if source.count(old) != 1:
    raise SystemExit('provincial verifier source declarations changed')
source = source.replace(old, new, 1)
old = """requireText(storageV2, "'transportShipments'", '运输记录必须进入世界顶层 segment。');
requireText(storageV2, "'transportShip'", '运输动作必须使用局部玩家 Mutation Scope。');
requireText(storageV2, "'chooseStartingProvince'", '起始州选择必须使用局部玩家 Mutation Scope。');
requireText(storageV2, "'unlockProvince'", '州解锁必须使用局部玩家 Mutation Scope。');
"""
new = """requireText(storageV2, "'transportShipments'", '运输记录必须进入世界顶层 segment。');
requireText(storageV2, "case 'local-player':", '分段存储必须保留注册表驱动的局部玩家 Mutation Scope。');
requireText(storageV2, 'label: `local:${action}`', '局部玩家 Mutation Scope 必须保留动作标签。');
requireText(actionRegistry, "transportShip: defineAction({ rateLimitCategory: 'orders', mutationScope: 'local-player'", '运输动作必须在统一注册表声明局部玩家 Mutation Scope。');
requireText(actionRegistry, "chooseStartingProvince: defineAction({ mutationScope: 'local-player'", '起始州选择必须在统一注册表声明局部玩家 Mutation Scope。');
requireText(actionRegistry, "unlockProvince: defineAction({ mutationScope: 'local-player'", '州解锁必须在统一注册表声明局部玩家 Mutation Scope。');
"""
if source.count(old) != 1:
    raise SystemExit('provincial verifier storage-scope block changed')
source = source.replace(old, new, 1)
path.write_text(source, encoding='utf-8')
print('provincial scope verifier migrated to action registry')
