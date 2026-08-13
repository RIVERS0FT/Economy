from pathlib import Path

page = Path('src/pages/ProductionPage.tsx')
content = page.read_text(encoding='utf-8')
old = 'completedTechnologyIds={game.research.completedTechnologyIds ?? []}'
new = 'completedTechnologyIds={game.research?.completedTechnologyIds ?? []}'
count = content.count(old)
if count != 2:
    if content.count(new) == 2:
        count = 0
    else:
        raise SystemExit(f'ProductionPage expected 2 unsafe research reads, found {count}')
if count:
    content = content.replace(old, new)
    page.write_text(content, encoding='utf-8')

ui = Path('docs/UI_DESIGN_SYSTEM.md')
text = ui.read_text(encoding='utf-8')
heading = '### 生产页缺失研发状态兼容'
section = '''### 生产页缺失研发状态兼容

正式服务器快照继续返回 `research` 与 `researchTechnologies`；但浏览器历史回归快照、逐步发布兼容数据或旧客户端缓存可能暂时缺少 `research`。生产页不得因此在首屏读取 `completedTechnologyIds` 时崩溃：工厂目录准入继续复用 `getUnlockedFacilityTypes` 的既有兼容语义，作业制度研发状态在缺少 `research` 时仅按空 `completedTechnologyIds` 渲染锁定提示。该客户端兜底不得绕过服务器 `setFacilityRecipe` 的正式科技校验，也不得把缺失研发状态写回服务器或永久视为已完成科技。
'''
if heading not in text:
    ui.write_text(text.rstrip() + '\n\n' + section, encoding='utf-8')
