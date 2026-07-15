from pathlib import Path

root = Path.cwd()
for path in (root / 'scripts').glob('verify-*.mjs'):
    content = path.read_text(encoding='utf-8')
    updated = content.replace("'>前往市场交易该工厂 →'", "'前往市场交易该工厂 →'")
    if updated != content:
        path.write_text(updated, encoding='utf-8')
