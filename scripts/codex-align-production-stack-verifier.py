from pathlib import Path

path = Path('scripts/verify-production-desktop-layout.mjs')
source = path.read_text(encoding='utf-8')
old = '''for (const text of [
  "const [facilityDetailTypeId, setFacilityDetailTypeId] = useState<string | null>(null);",
  "activeSection === 'buildings' && Boolean(facilityDetailType)",
  'className="province-facility-detail-title"',
  '<RegionalEntityPageTitle',
  "{ label: '返回建筑列表', onClick: () => setFacilityDetailTypeId(null) }",
  '{!isEntityDetail ? sectionSwitch : null}',
  'detailFacilityTypeId={facilityDetailTypeId ?? undefined}',
  'onDetailFacilityChange={setFacilityDetailTypeId}',
]) assert.equal(provincePage.includes(text), true, `地区工厂二级详情缺少: ${text}`);'''
new = '''for (const text of [
  "const [fallbackFacilityDetailTypeId, setFallbackFacilityDetailTypeId] = useState<string | null>(null);",
  "location?.type === 'regional-facility'",
  "location.host === 'province'",
  "activeSection === 'buildings' && Boolean(facilityDetailType)",
  'className="province-facility-detail-title"',
  '<RegionalEntityPageTitle',
  "type: 'regional-facility'",
  "host: 'province'",
  'pageNavigation.pushPage({',
  '{!isEntityDetail ? sectionSwitch : null}',
  'detailFacilityTypeId={facilityDetailTypeId ?? undefined}',
  'onDetailFacilityChange={handleFacilityDetailChange}',
]) assert.equal(provincePage.includes(text), true, `地区工厂二级详情缺少: ${text}`);'''
if old not in source:
    raise SystemExit('stale ProvincePage production detail verifier block not found')
path.write_text(source.replace(old, new, 1), encoding='utf-8')
