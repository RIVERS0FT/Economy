from pathlib import Path

path = Path('/tmp/apply.py')
text = path.read_text()
old = '''def replace(path: str, old: str, new: str):
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        raise SystemExit(f'missing replacement anchor in {path}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1))
'''
new = '''def replace(path: str, old: str, new: str):
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        for width in range(1, 17):
            prefix = ' ' * width
            indented_old = '\\n'.join(prefix + line if line else line for line in old.split('\\n'))
            if indented_old in text:
                old = indented_old
                new = '\\n'.join(prefix + line if line else line for line in new.split('\\n'))
                break
    if old not in text:
        raise SystemExit(f'missing replacement anchor in {path}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1))
'''
if old not in text:
    raise SystemExit('replace helper anchor missing')
path.write_text(text.replace(old, new, 1))
