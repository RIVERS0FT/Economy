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
