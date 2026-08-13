from pathlib import Path

path = Path('scripts/verify-production-methods.mjs')
content = path.read_text(encoding='utf-8')
old = """  '<FacilityProductionConfigControls',\n  'onProductChange={(baseRecipeId)',\n  'onMethodChange={(methodId)',\n]) assert.ok(detailSource.includes(text), `生产方式客户端合成缺少 ${text}`);"""
new = """  '<FacilityProductionConfigControls',\n  'selectConfiguration(selectedBaseRecipeId, recipeState.selectedProductionMethodId);',\n  'selectConfiguration(recipeState.selectedBaseRecipeId, methodId);',\n]) assert.ok(detailSource.includes(text), `生产方式客户端合成缺少 ${text}`);"""
if old in content:
    content = content.replace(old, new, 1)
elif new not in content:
    raise SystemExit('scripts/verify-production-methods.mjs: callback verification marker missing')
path.write_text(content, encoding='utf-8')
