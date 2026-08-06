from pathlib import Path

path = Path('scripts/verify-gem-shop.mjs')
source = path.read_text(encoding='utf-8')
old = "for (const text of ['label=\"建造数量\"', 'label=\"建造资金\"', '立即扣除资金与建造材料']) {\n  requireText('src/pages/ProductionPage.tsx', text);\n}"
new = "for (const text of [\n  'label=\"建造数量\"',\n  'label=\"建造资金\"',\n  'label=\"建造材料\"',\n  'value=\"无需材料\"',\n  \"'建造资金' : '资金与建造材料'\",\n]) {\n  requireText('src/pages/ProductionPage.tsx', text);\n}"
if source.count(old) != 1:
    raise RuntimeError('verify-gem-shop construction presentation guard not found exactly once')
path.write_text(source.replace(old, new), encoding='utf-8', newline='\n')
print('gem shop construction presentation guard updated')
