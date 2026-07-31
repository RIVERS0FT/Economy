from pathlib import Path
import base64
import zlib

root = Path(__file__).resolve().parents[1]
parts_dir = root / 'scripts' / '.money-precision-refactor'
encoded = ''.join(path.read_text(encoding='utf-8').strip() for path in sorted(parts_dir.glob('part*.txt')))
source = zlib.decompress(base64.b64decode(encoded))
exec(compile(source, 'apply-money-precision-refactor.py', 'exec'))
