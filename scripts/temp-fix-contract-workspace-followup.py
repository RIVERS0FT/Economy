from pathlib import Path
import subprocess

subprocess.run(['python3', 'scripts/temp-fix-contract-workspace.py'], check=True)

path = Path('src/pages/ContractWorkspacePage.tsx')
text = path.read_text()
replacements = {
  'label="自动还款" />': 'label="自动还款" description="到期时自动使用当前可用资金偿还，不透支未来收入。" />',
  'label="自动补充租金" />': 'label="自动补充租金" description="每期只使用当前可用资金补充租金，不透支未来收入。" />',
  'label="自动准备商品" />': 'label="自动准备商品" description="只从当前可用库存准备当日或当前批次商品，不透支未来产量。" />',
  'label="自动补充货款" />': 'label="自动补充货款" description="只从当前可用资金补充当日或当前批次货款，不透支未来收入。" />',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'missing toggle description anchor: {old}')
    text = text.replace(old, new, 1)
path.write_text(text)

Path('scripts/temp-typecheck-output.txt').unlink(missing_ok=True)
