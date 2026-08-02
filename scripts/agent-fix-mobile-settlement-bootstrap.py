from pathlib import Path

path = Path('scripts/agent-apply-mobile-settlement-fix.py')
text = path.read_text(encoding='utf-8')
old = '- 周期与当前集群周期成本固定放在输入组合区的物资行下方，并以时间、成本两行显示；周期不乘工厂数量，不得显示总工时，也不得恢复输入输出之间的独立中列或横向时间成本分隔符。'
new = '- 周期与当前集群周期成本固定放在输入组合区的物资行下方，并以时间、成本两行显示；周期不乘以工厂规模，不得显示总工时，也不得恢复输入输出之间的独立中列或横向时间成本分隔符。'
if text.count(old) != 1:
    raise SystemExit('未找到唯一的产业设计旧规则替换基线')
path.write_text(text.replace(old, new), encoding='utf-8')
