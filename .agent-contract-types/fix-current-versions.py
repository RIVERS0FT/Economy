from pathlib import Path


def rewrite(path, replacements):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    for old, new in replacements:
        text = text.replace(old, new)
    file.write_text(text, encoding='utf-8', newline='\n')

CURRENT_REPLACEMENTS = [
    ('export const RESEARCH_WORLD_VERSION = 25;', 'export const RESEARCH_WORLD_VERSION = 26;'),
    ('version: 25,', 'version: 26,'),
    ('world.version = 25;', 'world.version = 26;'),
    ('migrated.version = 25;', 'migrated.version = 26;'),
    ('prepared.version = 25;', 'prepared.version = 26;'),
    ('clientStateVersion: 28,', 'clientStateVersion: 29,'),
]

for path in [
    'server/src/domain-core.js',
    'server/src/domain.js',
    'server/src/storage.js',
    'server/src/research.js',
    'server/src/runtime-store.js',
]:
    rewrite(path, CURRENT_REPLACEMENTS)

for root in ['tests/browser', 'tests/stress']:
    for path in Path(root).rglob('*'):
        if path.is_file() and path.suffix in {'.ts', '.tsx', '.js', '.mjs'}:
            rewrite(path, CURRENT_REPLACEMENTS)

for path in Path('scripts').glob('*'):
    if not path.is_file() or path.suffix not in {'.mjs', '.js', '.py'}:
        continue
    text = path.read_text(encoding='utf-8')
    text = text.replace('CURRENT_CLIENT_STATE_VERSION = 28', 'CURRENT_CLIENT_STATE_VERSION = 29')
    text = text.replace('MIN_COMPATIBLE_CLIENT_STATE_VERSION = 28', 'MIN_COMPATIBLE_CLIENT_STATE_VERSION = 29')
    text = text.replace('PRODUCTION_CONTRACT_SCHEMA_VERSION = 4', 'PRODUCTION_CONTRACT_SCHEMA_VERSION = 5')
    text = text.replace('RESEARCH_WORLD_VERSION = 25', 'RESEARCH_WORLD_VERSION = 26')
    text = text.replace('world\\.version = 25', 'world\\.version = 26')
    text = text.replace('world.version = 25', 'world.version = 26')
    text = text.replace('prepared\\.version = 25', 'prepared\\.version = 26')
    text = text.replace('prepared.version = 25', 'prepared.version = 26')
    text = text.replace('version: 25', 'version: 26')
    text = text.replace('clientStateVersion: 28', 'clientStateVersion: 29')
    text = text.replace('客户端状态版本：28', '客户端状态版本：29')
    text = text.replace('世界状态版本：25', '世界状态版本：26')
    text = text.replace('版本 29/25', '版本 29/26')
    path.write_text(text, encoding='utf-8', newline='\n')

for path in Path('docs').glob('*.md'):
    rewrite(path, [
        ('> 客户端状态版本：28', '> 客户端状态版本：29'),
        ('> 世界状态版本：25', '> 世界状态版本：26'),
    ])

print('客户端版本 29、世界版本 26 与合同 Schema 5 已同步到运行时、测试夹具和防回退断言')
