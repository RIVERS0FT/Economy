from pathlib import Path

path = Path('scripts/verify-provincial-economy.mjs')
source = path.read_text(encoding='utf-8')
old = "assert.equal(gameShell.includes(\"previousTab !== 'map' && previousTab !== 'province'\"), true, '州级上下文页不得污染普通业务页面返回历史');"
new = """for (const text of [
  'appendPlayerPageHistory',
  'pushPlayerPage',
  'replacePlayerPage',
  'currentLocation: pageLocation',
]) assert.ok(gameShell.includes(text), `州级上下文页统一返回栈缺少: ${text}`);
const pageStack = read('src/navigation/playerPageStack.ts');
for (const text of [
  'MAX_PLAYER_PAGE_STACK_DEPTH = 20',
  \"type: 'province'\",
  \"type: 'regional-product'\",
  \"type: 'regional-facility'\",
  'maximumHistoryDepth = MAX_PLAYER_PAGE_STACK_DEPTH - 1',
]) assert.ok(pageStack.includes(text), `受限页面栈缺少: ${text}`);"""
if old not in source:
    raise SystemExit('stale province-history verifier assertion not found')
source = source.replace(old, new, 1)
old_warehouse = "  '<WarehouseInventoryPanel model={model} className=\"province-warehouse-section\" />',\n"
new_warehouse = "  '<WarehouseInventoryPanel', 'className=\"province-warehouse-section\"', 'onOpenProduct={openWarehouseProduct}',\n"
if old_warehouse not in source:
    raise SystemExit('stale ProvincePage warehouse verifier token not found')
source = source.replace(old_warehouse, new_warehouse, 1)
path.write_text(source, encoding='utf-8')
