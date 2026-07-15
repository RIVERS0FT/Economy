from pathlib import Path

root = Path.cwd()
for path in (root / 'scripts').glob('verify-*.mjs'):
    content = path.read_text(encoding='utf-8')
    updated = content.replace("'>前往市场交易该工厂 →'", "'前往市场交易该工厂 →'")
    if updated != content:
        path.write_text(updated, encoding='utf-8')

market_path = root / 'scripts/verify-market-assets.mjs'
market_content = market_path.read_text(encoding='utf-8')
market_content = market_content.replace(
    "'前往市场交易该工厂','>保存计划</Button>'",
    "'>保存计划</Button>'",
)
market_path.write_text(market_content, encoding='utf-8')

ui_path = root / 'docs/UI_DESIGN_SYSTEM.md'
ui_content = ui_path.read_text(encoding='utf-8')
ui_content = ui_content.replace(
    '- 工厂卡桌面使用统一高度，移动端使用自然高度；',
    '- 桌面端所有工厂集群卡片使用统一高度，移动端使用自然高度；',
)
ui_content = ui_content.replace(
    '工厂卡外层使用容器查询决定卡片内边距：',
    '工厂卡外层使用容器查询决定卡片内边距，统一使用 `8px / 12px / 16px` 三档：',
)
ui_path.write_text(ui_content, encoding='utf-8')
