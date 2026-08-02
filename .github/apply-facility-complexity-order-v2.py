from pathlib import Path
import re

DOMAIN_PATH = Path('server/test/domain.test.js')
SCRIPT_PATH = Path('.github/apply-facility-complexity-order.py')

text = DOMAIN_PATH.read_text(encoding='utf-8')
text, count = re.subn(
    r"  const expectedFacilities = \[\n(.*?)\n  \];",
    lambda match: "const expectedFacilities = [\n" + match.group(1) + "\n];",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('domain expectedFacilities normalization failed')
text = text.replace(
    '  assert.deepEqual(FACILITY_TYPE_CATALOG.map((facility) => facility.id), expectedFacilities);',
    'assert.deepEqual(FACILITY_TYPE_CATALOG.map((item) => item.id), expectedFacilities);',
    1,
)
DOMAIN_PATH.write_text(text, encoding='utf-8', newline='\n')

source = SCRIPT_PATH.read_text(encoding='utf-8')
exec(compile(source, str(SCRIPT_PATH), 'exec'), {})

text = DOMAIN_PATH.read_text(encoding='utf-8')
expected_block = """const expectedFacilities = [
  'farm', 'orchard', 'ranch', 'fishery',
  'logging-camp', 'mine', 'oil-field', 'mill', 'sawmill',
  'pulp-mill', 'steelworks', 'textile-mill', 'food-factory', 'paper-mill',
  'refinery', 'beverage-factory', 'furniture-factory', 'garment-factory',
  'machine-factory', 'electronics-factory', 'appliance-factory',
];"""
indented_expected = '\n'.join(f'  {line}' for line in expected_block.splitlines())
if text.count(expected_block) != 1:
    raise SystemExit('domain expectedFacilities cleanup failed')
text = text.replace(expected_block, indented_expected, 1)

assertion_block = """assert.deepEqual(FACILITY_TYPE_CATALOG.map((item) => item.id), expectedFacilities);
const facilityComplexityRanks = FACILITY_TYPE_CATALOG.map((item) => Number(item.complexity.slice(1)));
assert.deepEqual(
  facilityComplexityRanks,
  [...facilityComplexityRanks].sort((left, right) => left - right),
  '工厂正式目录必须按复杂度 C1 至 C7 升序排列',
);"""
indented_assertion = """  assert.deepEqual(FACILITY_TYPE_CATALOG.map((facility) => facility.id), expectedFacilities);
  const facilityComplexityRanks = FACILITY_TYPE_CATALOG.map((facility) => Number(facility.complexity.slice(1)));
  assert.deepEqual(
    facilityComplexityRanks,
    [...facilityComplexityRanks].sort((left, right) => left - right),
    '工厂正式目录必须按复杂度 C1 至 C7 升序排列',
  );"""
if text.count(assertion_block) != 1:
    raise SystemExit('domain complexity assertion cleanup failed')
text = text.replace(assertion_block, indented_assertion, 1)
DOMAIN_PATH.write_text(text, encoding='utf-8', newline='\n')
