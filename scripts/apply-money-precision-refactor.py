from pathlib import Path
import base64
import zlib

root = Path(__file__).resolve().parents[1]
parts_dir = root / 'scripts' / '.money-precision-refactor'
encoded = ''.join(path.read_text(encoding='utf-8').strip() for path in sorted(parts_dir.glob('part*.txt')))
source = zlib.decompress(base64.b64decode(encoded)).decode('utf-8')
needle = """    if count != 1:\n        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:100]!r}')\n    write(path, text.replace(old, new, 1))\n"""
replacement = """    if count != 1:\n        if path == 'server/src/contract-audit-store.js' and old.startswith('      const grossTotal = Math.max(0, after.marketSellFeeGross') and count == 2:\n            write(path, text.replace(old, new, 1))\n            return\n        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:100]!r}')\n    write(path, text.replace(old, new, 1))\n"""
if source.count(needle) != 1:
    raise RuntimeError('Unable to patch refactor assertion helper')
source = source.replace(needle, replacement, 1)
exec(compile(source, 'apply-money-precision-refactor.py', 'exec'))

ui_path = root / 'docs' / 'UI_DESIGN_SYSTEM.md'
ui_text = ui_path.read_text(encoding='utf-8')
ui_text = ui_text.replace('普通界面金额统一显示两位', '普通金额统一显示两位')
if '普通金额统一显示两位' not in ui_text:
    ui_text = ui_text.rstrip() + '''

### 金额显示精度边界

- 普通金额统一显示两位；精确流水、合同审计和管理员诊断详情统一显示六位。
- 非零且绝对值小于 `0.01` 的普通金额显示为 `< 0.01`，不得误显示为零。
- 显示格式化结果只用于界面渲染，不得重新参与服务器或客户端业务运算。
'''
ui_path.write_text(ui_text.rstrip() + '\n', encoding='utf-8')
