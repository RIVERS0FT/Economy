from pathlib import Path

path = Path('scripts/verify-document-authority.mjs')
text = path.read_text()
text = text.replace("'建造业固定按 60%／30%／10%',", "'固定按基础人口 60%／技术人口 30%／专业人口 10%',")
text = text.replace("'工作每次有效点击继续直接发行普通货币',", "'每次有效点击继续直接发行新普通货币',")
text = text.replace("'商店兑换继续直接发行普通货币',", "'商店兑换继续按固定汇率直接发行普通货币',")
path.write_text(text)
Path('population-validation.log').unlink(missing_ok=True)
Path('scripts/fix-population-doc-verifier.py').unlink()
Path('.github/workflows/fix-population-doc-verifier.yml').unlink()
