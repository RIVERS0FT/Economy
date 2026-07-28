from pathlib import Path


def replace_once(path, old, new):
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old!r}')
    target.write_text(text.replace(old, new, 1))


path = Path('server/test/facility-groups.test.js')
path.write_text(path.read_text().rstrip() + '\n')

verification = Path('scripts/verify-money-precision.mjs')
text = verification.read_text()
for old, new in {
    'CURRENT_CLIENT_STATE_VERSION = 20': 'CURRENT_CLIENT_STATE_VERSION = 21',
    'MIN_COMPATIBLE_CLIENT_STATE_VERSION = 20': 'MIN_COMPATIBLE_CLIENT_STATE_VERSION = 21',
    'world\\.version = 17': 'world\\.version = 18',
}.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'money precision verification expected one match, found {count}: {old}')
    text = text.replace(old, new, 1)
verification.write_text(text)

readme = Path('README.md')
text = readme.read_text()
for old, new in {
    '客户端状态版本：`20`': '客户端状态版本：`21`',
    '世界状态版本：`17`': '世界状态版本：`18`',
}.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'root README version expected one match, found {count}: {old}')
    text = text.replace(old, new, 1)
readme.write_text(text)

replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '生产公式是集群运行能力展示，公式只展示集群输入、输出、周期和成本。当前周期只使用 `participatingCount`；停止或异常使用 `nextCycleCount` 表示启动后或恢复后的集群能力。周期时长不乘工厂数量，`pendingJoinCount` 不得提前进入当前周期，`group.count` 不得作为公式乘数。开关只改变服务器运行意图；异常时仍保持开启视觉，并等待资金、原料或仓库恢复后自动从完整新周期继续。',
    '生产公式是集群运行能力展示，公式只展示集群输入、输出、周期和成本。当前周期显示 `participatingCount`、`cycleStaffingRateBps` 和 `cycleEffectiveCount`；停止或异常使用 `nextCycleCount`、预计满员率与 `nextCycleEffectiveCount` 表示启动后或恢复后的集群能力。输入、输出和成本统一按整数等效产能计算；周期时长不乘工厂数量，`pendingJoinCount` 不得提前进入当前周期，`group.count` 不得作为公式乘数。开关只改变服务器运行意图；异常时仍保持开启视觉，并等待资金、原料或仓库恢复后自动从完整新周期继续。',
)
replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '公式上方必须显示“本周期 × N”“启动后 × N”或“恢复后 × N”的范围标识。',
    '公式上方必须显示“本周期 P 座 · 满员率 R% · 等效 × E”，停止或异常时显示对应的“启动后／恢复后 P 座 · 满员率 R% · 等效 × E”范围标识。',
)
replace_once(
    'docs/UI_DESIGN_SYSTEM.md',
    '- 让生产公式恢复单座输入、输出或成本，或让运行中的公式不按 `participatingCount` 变化；\n- 停止或异常时不使用 `nextCycleCount`，使用 `group.count` 作为公式乘数，或把 `pendingJoinCount` 提前计入当前周期；',
    '- 让生产公式恢复单座输入、输出或成本，或让运行中的公式不同时显示 `participatingCount`、锁定满员率和 `cycleEffectiveCount`；\n- 停止或异常使用 `nextCycleCount`、预计满员率与 `nextCycleEffectiveCount`；不得使用 `group.count` 作为公式乘数，也不得把 `pendingJoinCount` 提前计入当前周期；',
)
replace_once(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    '详情只显示一行“单厂平均利润／分钟”：左侧为指标名称和“当前配方预计／下一周期预计／启动后预计／恢复后预计 · 最近真实成交价 · 满员率 R%”，右侧为按对应周期满员率线性缩放后的数值或内联缺价提示。\n',
    '详情只显示一行“单厂平均利润／分钟”：左侧为指标名称和“当前配方预计／下一周期预计／启动后预计／恢复后预计 · 最近真实成交价 · 满员率 R%”，右侧为按对应周期满员率线性缩放后的数值或内联缺价提示。缺失商品名称只允许出现在该行右侧和辅助说明中，不得扩展为逐商品成交价明细或第二张卡。不得恢复市场利润分析标题、盈利状态标签、原料成本、产出价值、周期成本、单周期利润、静态回本、警告列表或说明段落。完整估算口径可通过该行的辅助说明提供，但不得增加第二行指标卡或内部滚动区。\n',
)

verifier = Path('scripts/verify-unified-factory-recipes-grid.mjs')
text = verifier.read_text()
for old, new in {
    '运行中按 `participatingCount`': '运行中显示 `participatingCount`、本周期锁定满员率与 `cycleEffectiveCount`',
    '当前周期只使用 `participatingCount`': '当前周期显示 `participatingCount`、`cycleStaffingRateBps` 和 `cycleEffectiveCount`',
    '停止或异常使用 `nextCycleCount`': '停止或异常使用 `nextCycleCount`、预计满员率与 `nextCycleEffectiveCount`',
}.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'unified factory verifier expected one match, found {count}: {old}')
    text = text.replace(old, new, 1)
verifier.write_text(text)

auctions = Path('scripts/verify-asset-auctions.mjs')
text = auctions.read_text()
for old, new in {
    'world.version = 17;': 'world.version = 18;',
    'Back up production database before world 17 migration': 'Back up production database before world 18 migration',
    '客户端状态版本：`20`': '客户端状态版本：`21`',
    '世界状态版本：`17`': '世界状态版本：`18`',
}.items():
    text = text.replace(old, new)
for expected in [
    'world.version = 18;',
    'Back up production database before world 18 migration',
    '客户端状态版本：`21`',
    '世界状态版本：`18`',
]:
    if expected not in text:
        raise SystemExit(f'asset auction verifier missing synchronized assertion: {expected}')
auctions.write_text(text)

asset_tests = Path('server/test/asset-auctions.test.js')
text = asset_tests.read_text()
old = 'assert.equal(state.version, 17);'
if text.count(old) != 1:
    raise SystemExit(f'asset auction version test expected one match, found {text.count(old)}')
asset_tests.write_text(text.replace(old, 'assert.equal(state.version, 18);', 1))

domain_tests = Path('server/test/domain.test.js')
text = domain_tests.read_text()
replacements = {
    'assert.equal(persisted.version, 17);': 'assert.equal(persisted.version, 18);',
    'assert.equal(world.version, 16);': 'assert.equal(world.version, 18);',
}
for old, new in replacements.items():
    count = text.count(old)
    if count < 1:
        raise SystemExit(f'domain version test expected at least one match: {old}')
    text = text.replace(old, new)
domain_tests.write_text(text)

print('factory staffing post-migration contracts synchronized')
