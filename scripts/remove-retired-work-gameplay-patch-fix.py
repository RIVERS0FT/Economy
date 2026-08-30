from pathlib import Path

patch_path = Path('scripts/remove-retired-work-gameplay-patch.py')
patch_text = patch_path.read_text(encoding='utf-8')
old = "replace('server/src/facility-groups.js', '        Number(player.stats.workIssued || 0)\\n          + ', '        ', count=1)"
new = "replace('server/src/facility-groups.js', '        weeklyChange: Number(player.stats.workIssued || 0)\\n          + ', '        weeklyChange: ', count=1)"
if old not in patch_text:
    raise SystemExit('temporary patch source not found')
patch_path.write_text(patch_text.replace(old, new), encoding='utf-8', newline='\n')

test_path = Path('server/test/domain.test.js')
test_text = test_path.read_text(encoding='utf-8')
old_success = """    const success = store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'activity-success', method: 'POST', path: '/api/game/work',
    }, now + 10_000);
"""
new_success = """    const success = store.apply(alice, {
      action: 'bankDeposit', payload: { amount: 1 }, requestKey: 'activity-success', method: 'POST', path: '/api/game/bank/deposits',
    }, now + 10_000);
"""
old_failure = """    const failure = store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'activity-failure', method: 'POST', path: '/api/game/work',
    }, now + 10_001);
"""
new_failure = """    const failure = store.apply(alice, {
      action: 'bankDeposit', payload: { amount: 999_999 }, requestKey: 'activity-failure', method: 'POST', path: '/api/game/bank/deposits',
    }, now + 10_001);
"""
for old_block, new_block in [(old_success, new_success), (old_failure, new_failure)]:
    if old_block not in test_text:
        raise SystemExit('economic activity test source not found')
    test_text = test_text.replace(old_block, new_block, 1)
test_path.write_text(test_text, encoding='utf-8', newline='\n')
