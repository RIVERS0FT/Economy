from pathlib import Path
import re

def show(path, patterns=None, before=8, after=25):
    lines = Path(path).read_text().splitlines()
    indices = set(range(len(lines))) if patterns is None else set()
    if patterns:
        for i, line in enumerate(lines):
            if any(re.search(p, line) for p in patterns):
                indices.update(range(max(0, i-before), min(len(lines), i+after+1)))
    print('\n=== '+path+' ===')
    for i in sorted(indices):
        print(f'{i+1}: {lines[i]}')

show('src/api/game.ts', ['class GameApiError', 'interface GameActionResult', 'saveFactoryAutoOperationPolicy', 'request_timeout', 'REQUEST_TIMEOUT'])
show('tests/browser/runtime-harness.tsx', ['function .*Commercial', 'function .*Unified', '__updateCommercialGroup', 'function .*Notification', '__notify', 'notify:'], before=12, after=45)
show('src/components/shell/GameShell.tsx', ['useNotificationCenter', 'NotificationCenter'], before=6, after=18)
show('src/styles/factory-auto-operation.css')
show('src/styles/commercial-buildings.css', ['commercial-action-error'])
show('scripts/verify-notification-center.mjs')
show('docs/UI_DESIGN_SYSTEM.md', ['通知面板', '最近通知'], before=2, after=5)
show('docs/CI_EXECUTION_DESIGN.md', ['^## ', '压缩', '合并', '分支'], before=1, after=3)
show('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['^##.*部署', 'deploy.yml', '线上验收'], before=1, after=3)
for path in Path('tests').rglob('*notification*'):
    if path.is_file(): show(str(path))
