from pathlib import Path
import re
import subprocess

TARGET = 'ceb4e5df390a111602624510e672ac698a1476d4'
def run(*args, check=True):
    return subprocess.run(args, check=check, text=True, capture_output=True)

if run('git', 'merge-base', '--is-ancestor', TARGET, 'HEAD', check=False).returncode:
    result = run('git', 'merge', '--no-commit', '--no-ff', TARGET, check=False)
    print(result.stdout, result.stderr)
    paths = run('git', 'diff', '--name-only', '--diff-filter=U').stdout.splitlines()
    allowed = {
        'docs/COMMERCIAL_BUILDINGS_DESIGN.md',
        'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
        'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
        'docs/UI_DESIGN_SYSTEM.md',
        'docs/WAREHOUSE_EXPANSION_DESIGN.md',
        'src/styles/factory-auto-operation.css',
    }
    assert set(paths) <= allowed, ('Unexpected merge conflicts', paths)
    for path in paths:
        if path == 'src/styles/factory-auto-operation.css':
            Path(path).write_text(run('git', 'show', ':3:' + path).stdout)
            continue
        def resolve(match):
            ours, theirs = match.group(1), match.group(2)
            if path == 'docs/COMMERCIAL_BUILDINGS_DESIGN.md':
                assert '冻结' in theirs and '抵押' in ours
                return ours.replace('抵押', '冻结')
            if path == 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md':
                assert '工厂生产公式继续展示' in ours and '运行中／冻结中' in theirs
                return ours
            if path == 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md':
                assert '自动经营策略' in ours and '银行冻结数量' in theirs
                return ours.replace('银行抵押数量', '银行冻结数量')
            if path == 'docs/UI_DESIGN_SYSTEM.md':
                assert '共享建筑组件边界' in ours and '24px' in theirs and '冻结中' in theirs
                return theirs + '\n' + ours
            if path == 'docs/WAREHOUSE_EXPANSION_DESIGN.md':
                assert '商业自动经营与共享库存保障' in ours and '固定在同一行' in theirs
                return theirs + '\n' + ours
            raise AssertionError(path)
        text = re.sub(r'^<<<<<<< [^\n]*\n(.*?)^=======\n(.*?)^>>>>>>> [^\n]*\n?', resolve, Path(path).read_text(), flags=re.M | re.S)
        assert '<<<<<<<' not in text and '>>>>>>>' not in text, path
        Path(path).write_text(text)
    p = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
    p.write_text(p.read_text().replace('运行／冻结／抵押数量', '运行中／冻结中两项数量'))
    run('git', 'add', *paths)
    run('git', 'diff', '--check')
    run('git', 'commit', '-m', 'merge: preserve daily market trends and unified freeze terminology')

p = Path('scripts/verify-warehouse-expansion.mjs')
text = p.read_text()
if 'facility-auto-operation__header' in text:
    text = text.replace("read('src/components/facilities/FacilityAutoOperationControls.tsx')", "(read('src/components/facilities/FacilityAutoOperationControls.tsx') + read('src/components/buildings/BuildingAutoOperationSection.tsx'))")
p.write_text(text)

for p in list(Path('.github').glob('unify-buildings-*.py')) + [
    Path('.github/unified-building-harness-fragment.tsx'),
    Path('.github/building-review-diagnostics.md'),
    Path('.github/building-merge-conflicts.md'),
    Path('.github/workflows/prepare-unified-buildings.yml'),
]:
    if p.exists(): p.unlink()
