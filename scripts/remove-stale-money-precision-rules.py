from pathlib import Path

root = Path(__file__).resolve().parents[1]
heading = '## 普通货币精度与玩家结算'
stale_phrases = (
    '第三位及以后不拒绝',
    '始终结算到 0.01',
    '进入玩家账本前再次结算到两位',
    '尾差进入服务器精度准备金',
)
removed = []

for path in sorted((root / 'docs').glob('*.md')):
    text = path.read_text(encoding='utf-8')
    changed = False
    while heading in text:
        start = text.index(heading)
        next_heading = text.find('\n## ', start + len(heading))
        end = len(text) if next_heading < 0 else next_heading + 1
        section = text[start:end]
        if not all(phrase in section for phrase in stale_phrases):
            raise RuntimeError(f'{path.relative_to(root)} contains an unexpected precision section')
        text = (text[:start].rstrip() + '\n\n' + text[end:].lstrip()).rstrip() + '\n'
        removed.append(str(path.relative_to(root)))
        changed = True
    if changed:
        path.write_text(text, encoding='utf-8')

if not removed:
    raise RuntimeError('No stale money precision sections were found')

verifier_path = root / 'scripts' / 'verify-money-precision.mjs'
verifier = verifier_path.read_text(encoding='utf-8')
verifier = verifier.replace(
    "import { readFileSync } from 'node:fs';",
    "import { readFileSync, readdirSync } from 'node:fs';",
)
anchor = "console.log('Money precision verification passed.');"
checks = """const stalePrecisionRule = /第三位及以后不拒绝|始终结算到 0\\.01|进入玩家账本前再次结算到两位|尾差进入服务器精度准备金/;
for (const file of readdirSync(new URL('../docs/', import.meta.url))) {
  if (!file.endsWith('.md')) continue;
  assert.doesNotMatch(read(`docs/${file}`), stalePrecisionRule, `${file} contains a superseded money precision rule`);
}

"""
if checks not in verifier:
    if anchor not in verifier:
        raise RuntimeError('Money precision verifier anchor is missing')
    verifier = verifier.replace(anchor, checks + anchor, 1)
verifier_path.write_text(verifier, encoding='utf-8')

print(f'Removed {len(removed)} stale precision sections: {", ".join(removed)}')
