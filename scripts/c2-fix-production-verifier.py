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

ui_path = Path('docs/UI_DESIGN_SYSTEM.md')
ui = ui_path.read_text(encoding='utf-8')
heading = '### 未解锁作业制度的研发锁定'
section = """### 未解锁作业制度的研发锁定

生产方式下拉选择继续复用共享 `production-config` `combobox` 与生产方案槽。未解锁作业制度必须保留在候选列表中并显示禁用状态，同时明确所需研发科技；不得通过隐藏选项、复制第二套选择器或仅依赖客户端禁用来代替权限控制。客户端禁用只负责提示，服务器 `setFacilityRecipe` 必须按正式 `requiredTechnologyIds` 再次校验；研发完成后的状态刷新应使原候选项自然转为可选，作业制度说明不得显示在收起态生产设置区。
"""
if heading not in ui:
    ui_path.write_text(ui.rstrip() + '\n\n' + section, encoding='utf-8')
