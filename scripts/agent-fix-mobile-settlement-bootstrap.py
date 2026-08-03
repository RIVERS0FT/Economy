from pathlib import Path

path = Path('scripts/agent-apply-mobile-settlement-fix.py')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        '- 周期与当前集群周期成本固定放在输入组合区的物资行下方，并以时间、成本两行显示；周期不乘工厂数量，不得显示总工时，也不得恢复输入输出之间的独立中列或横向时间成本分隔符。',
        '- 周期与当前集群周期成本固定放在输入组合区的物资行下方，并以时间、成本两行显示；周期不乘以工厂规模，不得显示总工时，也不得恢复输入输出之间的独立中列或横向时间成本分隔符。',
        '产业设计旧规则替换基线',
    ),
    (
        "require(group_css, '.facility-production-settings-grid')",
        "replace_once(\n    verifier,\n    \"  'expect(box.x + box.width).toBeLessThanOrEqual(390)',\",\n    \"  'expect(box.x + box.width).toBeLessThanOrEqual(width)',\",\n)\n\nrequire(group_css, '.facility-production-settings-grid')",
        '移动下拉框宽度验证补丁入口',
    ),
    (
        "  '时间与成本在输入物资下方同一行显示',",
        "  '输入与输出物资槽顶部对齐',\n  '再在其下同一行显示时间与成本',",
        '生产结算设计验证文案',
    ),
]

for old, new, label in replacements:
    if text.count(old) != 1:
        raise SystemExit(f'未找到唯一的{label}')
    text = text.replace(old, new)

path.write_text(text, encoding='utf-8')
