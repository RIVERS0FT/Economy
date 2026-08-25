from pathlib import Path

path = Path('scripts/verify-page-content.mjs')
source = path.read_text(encoding='utf-8')
anchor = "  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 邀请卡唯一归属商店，只展示玩家自己的专属分享链接、永久邀请码',\n"
addition = anchor + "  'src/components/warehouse/WarehouseInventoryPanel.tsx 缺少: 无限容量',\n  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 返回按最近顺序回到上一个非地图业务页面',\n  'src/pages/ProvincePage.tsx 缺少: <WarehouseInventoryPanel model={model} className=\"province-warehouse-section\" />',\n"
if anchor not in source:
    raise SystemExit('obsolete failure anchor missing')
source = source.replace(anchor, addition, 1)
old = "  'onDetailFacilityChange={setFacilityDetailTypeId}',\n"
first = source.find(old)
if first < 0:
    raise SystemExit('province detail verifier token missing')
source = source[:first] + "  'onDetailFacilityChange={handleFacilityDetailChange}',\n" + source[first + len(old):]
second = source.find(old, first + 1)
if second < 0:
    raise SystemExit('global building detail verifier token missing')
source = source[:second] + "    'onDetailFacilityChange={(nextFacilityTypeId) => {',\n" + source[second + len(old):]
path.write_text(source, encoding='utf-8')
