from pathlib import Path

path = Path(__file__).resolve().with_name('patch-leaderboard-personal-best.py')
text = path.read_text(encoding='utf-8')
old = '''    """  stats.leaderboardGemsIssued = safeNonNegativeInteger(player.stats.leaderboardGemsIssued);\\n  return player.stats;\\n}\\n""",
    """  stats.leaderboardGemsIssued = safeNonNegativeInteger(player.stats.leaderboardGemsIssued);\\n  if (!stats.leaderboardPersonalBests || typeof stats.leaderboardPersonalBests !== 'object' || Array.isArray(stats.leaderboardPersonalBests)) {\\n    stats.leaderboardPersonalBests = {};\\n  }\\n  return player.stats;\\n}'''
new = '''    """  player.stats.leaderboardGemsIssued = safeNonNegativeInteger(player.stats.leaderboardGemsIssued);\\n  return player.stats;\\n}\\n""",
    """  player.stats.leaderboardGemsIssued = safeNonNegativeInteger(player.stats.leaderboardGemsIssued);\\n  if (!player.stats.leaderboardPersonalBests || typeof player.stats.leaderboardPersonalBests !== 'object' || Array.isArray(player.stats.leaderboardPersonalBests)) {\\n    player.stats.leaderboardPersonalBests = {};\\n  }\\n  return player.stats;\\n}'''
if old not in text:
    raise SystemExit('Could not locate playerStats personal-best patch literal')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Leaderboard personal-best patch anchor normalized.')
