from pathlib import Path

p = Path('.github/unify-buildings-followup.py')
s = p.read_text().replace("edit('server/test/online-auto-sell.test.js', '当前工厂策略无需自动出售该商品', '当前建筑策略无需自动出售该商品')", "edit('server/test/online-auto-sell.test.js', '工厂策略无需自动出售', '建筑策略无需自动出售')")
p.write_text(s)

p = Path('tests/browser/runtime-harness.tsx')
s = p.read_text()
if 'function CommerceHarness({ scope' not in s:
    s = "import { GlobalBuildingsPage } from '../../src/pages/GlobalBuildingsPage';\nimport { GlobalMarketPage } from '../../src/pages/GlobalMarketPage';\n" + s
    a = s.index('function CommerceHarness() {')
    b = s.index('\nconst runtimeView =', a)
    s = s[:a] + Path('.github/unified-building-harness-fragment.tsx').read_text() + s[b:]
    s = s.replace("const runtimeView = view === 'commerce'", "const runtimeView = view === 'unified-buildings' ? <CommerceHarness scope=\"global\" />\n  : view === 'regional-buildings' ? <CommerceHarness scope=\"regional\" /> : view === 'commerce'")
    s = s.replace("'overview', 'map', 'commerce',", "'overview', 'map', 'commerce', 'unified-buildings', 'regional-buildings',")
    p.write_text(s)
    p = Path('runtime-test.html')
    p.write_text(p.read_text().replace("'overview', 'map', 'commerce',", "'overview', 'map', 'commerce', 'unified-buildings', 'regional-buildings',"))

for path in ['src/pages/GlobalBuildingsPage.tsx', 'src/pages/RegionalBuildingsPage.tsx']:
    p = Path(path)
    s = p.read_text()
    if "from '../hooks/useBuildingTypeFilter'" not in s:
        s = "import { useBuildingTypeFilter } from '../hooks/useBuildingTypeFilter';\n" + s
        s = s.replace(", type BuildingKindFilter", '')
        if 'GlobalBuildingsPage' in path:
            s = s.replace("useState<BuildingKindFilter>('all')", "useBuildingTypeFilter(`${model.game.userId}:global`)")
        else:
            s = s.replace("useState<BuildingKindFilter>('all')", "useBuildingTypeFilter(`${model.game.userId}:province:${model.selectedProvinceId}`)")
        p.write_text(s)
p = Path('src/pages/GlobalBuildingsPage.tsx')
s = p.read_text().replace('当前还没有已建成工厂。', '没有符合当前筛选条件的建筑。')
s = s.replace('，跨州单厂平均利润每分钟：${row.profitAccessibleValue}', "，${row.kind === 'commercial' ? '单座稳定利润' : '跨州单厂平均利润'}每分钟：${row.profitAccessibleValue}")
p.write_text(s)

for p in Path('tests/browser').glob('*.spec.ts'):
    lines = p.read_text().splitlines()
    for i, line in enumerate(lines):
        if "getByRole('tab', { name: '商业', exact: true })" in line and '.toBeVisible()' in line:
            lines[i] = line.replace('.toBeVisible()', '.toHaveCount(0)')
    p.write_text('\n'.join(lines) + '\n')
