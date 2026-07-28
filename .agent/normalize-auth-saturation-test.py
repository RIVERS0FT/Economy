from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{path}: expected {expected} matches, found {count}: {old!r}')
    file.write_text(text.replace(old, new), encoding='utf-8')


replace_exact(
    'tests/browser/auth-three-layer.spec.ts',
    ".toContain('saturate(140%)');",
    ".toMatch(/saturate\\((?:140%|1\\.4)\\)/);",
    3,
)
replace_exact(
    'scripts/verify-auth-three-layer.mjs',
    '  "toContain(\'saturate(140%)\')",',
    "  'toMatch(/saturate\\\\((?:140%|1\\\\.4)\\\\)/)',",
    1,
)
