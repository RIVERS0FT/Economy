from pathlib import Path
import subprocess

path = Path('tests/browser/build-action-readiness.spec.ts')
text = path.read_text()
old = r"/\/.*invitation[^/]*(?:\?.*)?$/"
new = "'**/economy-api/game/invitations'"
assert text.count(old) == 1
path.write_text(text.replace(old, new))
subprocess.run(['git', 'add', str(path)], check=True)
