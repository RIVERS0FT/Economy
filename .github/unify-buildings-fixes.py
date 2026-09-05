from pathlib import Path

p = Path('src/styles/factory-auto-operation.css')
s = p.read_text().replace('align-items: flex-start;', 'align-items: center;')
p.write_text(s)

p = Path('scripts/verify-provincial-economy.mjs')
s = '\n'.join(line for line in p.read_text().splitlines() if "{ id: 'commerce', label: '商业' }" not in line) + '\n'
p.write_text(s)

p = Path('server/test/commercial-auto-operation.test.js')
s = p.read_text()
s = s.replace("world.markets[provinceScopedKey(provinceId, input.productId)].officialPrice = 1", "world.markets[provinceScopedKey(provinceId, input.productId)].officialPrice = 15")
s = s.replace('player.credits, credits - 6', 'player.credits, credits - 6 * market.officialPrice')
s = s.replace("world.markets[provinceScopedKey(provinceId, 'food')].officialPrice = 1;\n  player.credits = 2;", "world.markets[provinceScopedKey(provinceId, 'food')].officialPrice = 15;\n  player.credits = 30;")
p.write_text(s)

p = Path('tests/browser/unified-buildings.spec.ts')
s = p.read_text()
s = s.replace('expect(width.scroll).toBeLessThanOrEqual(width.client + 1)', "expect(width.scroll, JSON.stringify(await page.locator('.global-buildings-page').evaluateAll((roots) => roots.flatMap((root) => Array.from(root.querySelectorAll('*')).filter((el) => el.getBoundingClientRect().right > root.getBoundingClientRect().right + 1).slice(0, 20).map((el) => ({ tag: el.tagName, cls: el.getAttribute('class'), width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right - root.getBoundingClientRect().right, scroll: el.scrollWidth, client: el.clientWidth })))))).toBeLessThanOrEqual(width.client + 1)")
p.write_text(s)

p = Path('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md')
s = p.read_text()
if '自动经营标题与开关的垂直中心对齐' not in s:
    s += '\n自动经营标题与开关的垂直中心对齐，正常宽度下不得分行；状态摘要的营业开关仍按本文原胶囊几何排列。该规则由共享自动经营组件同时覆盖工业与商业。\n'
p.write_text(s)
p = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
s = p.read_text()
if '筛选状态只在当前会话' not in s:
    s += '\n建筑分类筛选状态只在当前会话按玩家与目录范围（全局或州）保存，页面栈跨宿主返回后恢复原筛选；切换州或玩家不得混用，不写服务器存档或影响经济执行。\n'
p.write_text(s)
