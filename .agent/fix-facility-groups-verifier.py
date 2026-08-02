from pathlib import Path

path = Path('scripts/verify-facility-groups.mjs')
content = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str) -> None:
    global content
    count = content.count(old)
    if count != 1:
        raise SystemExit(f'expected one replacement, found {count}: {old!r}')
    content = content.replace(old, new, 1)


replace_once(
    "  'src/pages/ProductionPage.tsx',\n",
    "  'src/pages/ProductionPage.tsx',\n  'src/pages/production/ProductionFacilityDetail.tsx',\n",
)
replace_once("  'facility-recipe-section',\n", '')
replace_once(
    "]) requireText('src/pages/ProductionPage.tsx', text);\n\nfor (const forbidden of [",
    "]) requireText('src/pages/ProductionPage.tsx', text);\n\nfor (const text of [\n  'facility-production-settings',\n  'facility-production-settings-grid',\n  '<strong>生产设置</strong>',\n  '生产配方',\n  '下一周期切换为：',\n]) requireText('src/pages/production/ProductionFacilityDetail.tsx', text);\nfor (const forbidden of [\n  'facility-recipe-section',\n  'facility-production-method-section',\n  '<strong>{selectedMethod.name}</strong>',\n]) forbidText('src/pages/production/ProductionFacilityDetail.tsx', forbidden);\n\nfor (const forbidden of [",
)
replace_once(
    "  'grid-template-rows: auto minmax(112px, auto) minmax(0, 1fr) auto',\n",
    "  '.facility-production-formula-heading',\n",
)
replace_once(
    "forbidText('src/styles/facility-production-formula.css', '.facility-formula-summary');\n",
    "forbidText('src/styles/facility-production-formula.css', '.facility-formula-summary');\nforbidText(\n  'src/styles/facility-production-formula.css',\n  'grid-template-rows: auto minmax(112px, auto) minmax(0, 1fr) auto',\n);\nforbidText('src/styles/facility-production-formula.css', '.facility-group-card {');\n",
)
replace_once(
    "  '自然内容流是桌面详情高度的唯一来源',\n",
    "  '自然内容流是桌面详情高度的唯一来源',\n  '生产配方与作业制度必须合并为同一个“生产设置”区',\n  '生产公式与单厂平均利润共同属于同一个“生产结算”容器',\n",
)
replace_once(
    "  '完整文本无障碍描述',\n",
    "  '完整文本无障碍描述',\n  '生产配方与作业制度使用同一个“生产设置”区',\n  '公式、进度和单厂平均利润共同组成一张“生产结算”卡',\n",
)

path.write_text(content, encoding='utf-8')
print('facility group verifier aligned with production detail layout')
