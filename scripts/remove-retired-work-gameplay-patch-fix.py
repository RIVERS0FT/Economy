from pathlib import Path

path = Path('scripts/remove-retired-work-gameplay-patch.py')
text = path.read_text(encoding='utf-8')
old = "replace('server/src/facility-groups.js', '        Number(player.stats.workIssued || 0)\\n          + ', '        ', count=1)"
new = "replace('server/src/facility-groups.js', '        weeklyChange: Number(player.stats.workIssued || 0)\\n          + ', '        weeklyChange: ', count=1)"
if old not in text:
    raise SystemExit('temporary patch source not found')
path.write_text(text.replace(old, new), encoding='utf-8', newline='\n')
