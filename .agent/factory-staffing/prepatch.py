from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
old = '详情只显示一行“单厂平均利润／分钟”：左侧为指标名称和“当前配方预计／下一周期预计／启动后预计／恢复后预计 · 最近真实成交价”，右侧为数值或内联缺价提示。\n'
new = '详情只显示一行“单厂平均利润／分钟”：左侧为指标名称和“当前配方预计／下一周期预计／启动后预计／恢复后预计 · 最近真实成交价”，右侧为数值或内联缺价提示。缺失商品名称只允许出现在该行右侧和辅助说明中，不得扩展为逐商品成交价明细或第二张卡。不得恢复市场利润分析标题、盈利状态标签、原料成本、产出价值、周期成本、单周期利润、静态回本、警告列表或说明段落。完整估算口径可通过该行的辅助说明提供，但不得增加第二行指标卡或内部滚动区。\n'
count = text.count(old)
if count != 1:
    raise SystemExit(f'docs migration prepatch expected one match, found {count}')
path.write_text(text.replace(old, new, 1))
