from pathlib import Path

path = Path('tests/browser/runtime-harness.tsx')
text = path.read_text(encoding='utf-8')
replacements = [
    (
        "          id: 'contract-active',\n          publisherId: 456,",
        "          id: 'contract-active',\n          kind: 'supply',\n          publisherSide: 'supplier',\n          publisherId: 456,",
    ),
    (
        "          id: 'contract-active-normal',\n          publisherId: 654,",
        "          id: 'contract-active-normal',\n          kind: 'supply',\n          publisherSide: 'supplier',\n          publisherId: 654,",
    ),
    (
        "          id: 'contract-open',\n          publisherId: 789,",
        "          id: 'contract-open',\n          kind: 'supply',\n          publisherSide: 'buyer',\n          publisherId: 789,",
    ),
    (
        "          id: 'contract-history',\n          publisherId: 123,",
        "          id: 'contract-history',\n          kind: 'supply',\n          publisherSide: 'buyer',\n          publisherId: 123,",
    ),
]
for old, new in replacements:
    if text.count(old) != 1:
        raise SystemExit(f'expected one fixture anchor: {old!r}, found {text.count(old)}')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8', newline='\n')

verify = Path('scripts/verify-contract-layout.mjs')
verify_text = verify.read_text(encoding='utf-8')
old = "  \"id: 'contract-active-normal'\",\n]) requireText(harnessPath, text);"
new = "  \"id: 'contract-active-normal'\",\n  \"kind: 'supply'\",\n  \"publisherSide: 'supplier'\",\n]) requireText(harnessPath, text);"
if old not in verify_text:
    raise SystemExit('missing contract harness verification anchor')
verify.write_text(verify_text.replace(old, new, 1), encoding='utf-8', newline='\n')
