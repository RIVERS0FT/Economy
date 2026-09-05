from pathlib import Path

POLICY = "{ enabled: false, inputCoverageCycles: 2, mode: 'balanced', outputMode: 'surplus' }"


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    assert count == 1, f'{label}: expected 1, got {count}'
    p.write_text(text.replace(old, new, 1))

# Facility-group tests that assert raw production inventory/cash must opt out of default automatic trading.
path = Path('server/test/facility-groups.test.js')
text = path.read_text()
helper_marker = "function unlockFacilityTestProvinces(player) {\n"
helper = f"""function disableFactoryAutoOperation(player, ...typeIds) {{
  player.factoryAutoOperationPolicies ||= {{}};
  for (const typeId of typeIds) player.factoryAutoOperationPolicies[provinceScopedKey(DEFAULT_PROVINCE_ID, typeId)] = {POLICY};
}}

"""
assert text.count(helper_marker) == 1
text = text.replace(helper_marker, helper + helper_marker, 1)
for test_name, type_id in [
    ('production increments produced goods statistics', 'farm'),
    ('production wage multiplier changes population wages without changing production cost and only affects the next cycle', 'farm'),
    ('electronics factory atomically consumes plastic and copper', 'electronics-factory'),
    ('running farm crop changes apply immediately with a staffing penalty and progress reset', 'farm'),
    ('legacy warehouse capacity errors are retired during migration', 'farm'),
    ('legacy running target plans become continuous production', 'farm'),
    ('running factory settles each completed cycle at its completion staffing rate and carries fractional capacity', 'farm'),
    ('cycle completion rate can increase integer output beyond the cycle-start projection', 'farm'),
]:
    marker = f"test('{test_name}', () => {{\n  const world = createWorld(now);\n  const player = ensurePlayer(world, alice, now);\n"
    replacement = marker + f"  disableFactoryAutoOperation(player, '{type_id}');\n"
    count = text.count(marker)
    assert count == 1, f'{test_name}: expected 1, got {count}'
    text = text.replace(marker, replacement, 1)
path.write_text(text)

# This isolation test is about industrial/commercial state independence, not automatic liquidation.
replace_once(
    'server/test/commercial-facility-isolation.test.js',
    "import { inventoryForProvince } from '../src/provinces.js';",
    "import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';",
    'commercial isolation province import',
)
replace_once(
    'server/test/commercial-facility-isolation.test.js',
    "  player.credits = 10_000;\n",
    f"  player.credits = 10_000;\n  player.factoryAutoOperationPolicies = {{ [provinceScopedKey(provinceId, 'farm')]: {POLICY} }};\n",
    'commercial isolation factory policy',
)

# Lazy-settlement tests verify authoritative production proposals/resources. Disable automatic sale/procurement explicitly.
replace_once(
    'server/test/production-lazy-settlement.test.js',
    "import { migrateFacilityGroupWorld } from '../src/facility-groups.js';\n",
    "import { migrateFacilityGroupWorld } from '../src/facility-groups.js';\nimport { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';\n",
    'lazy settlement province import',
)
replace_once(
    'server/test/production-lazy-settlement.test.js',
    "  player.credits = 1_000;\n  player.facilityGroups = [farmGroup()];\n",
    f"  player.credits = 1_000;\n  player.factoryAutoOperationPolicies = {{ [provinceScopedKey(DEFAULT_PROVINCE_ID, 'farm')]: {POLICY} }};\n  player.facilityGroups = [farmGroup()];\n",
    'lazy settlement factory policy',
)
