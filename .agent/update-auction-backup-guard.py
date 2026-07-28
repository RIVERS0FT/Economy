from pathlib import Path

path = Path('scripts/verify-asset-auctions.mjs')
text = path.read_text(encoding='utf-8')
old = '''requireText('.github/workflows/deploy.yml', [
  'Back up production database before world 18 migration',
  'sqlite3.connect(database)',
  'source.backup(destination)',
  "destination.execute('PRAGMA quick_check')",
  "economy-pre-world-v{target_world_version}-{timestamp}.sqlite",
  "backup_dir.glob(f'economy-pre-world-v{target_world_version}-*.sqlite')",
  'for stale in backups[10:]:',
  'database-backup.log',
]);'''
new = '''requireText('.github/workflows/deploy.yml', [
  'Prune backups and back up production database before world 18 migration',
  'sqlite3.connect(database)',
  'source.backup(destination)',
  "destination.execute('PRAGMA quick_check')",
  "economy-pre-world-v{target_world_version}-{timestamp}.sqlite",
  "backup_dir.glob('economy-pre-*.sqlite')",
  'MAX_BACKUP_FAMILIES = 5',
  'def prune_backups():',
  'prune_backups()',
  'database-backup.log',
]);'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one deployment backup guard, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
