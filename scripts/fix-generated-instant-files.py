#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/verify-gem-shop.mjs')
text = path.read_text(encoding='utf-8')
text = text.replace("'工厂施工加速接口返回 `410 Gone`'", "'固定返回 `410 Gone`'", 1)
start = text.index('if (failures.length) {')
end = text.index("console.log('商店验证通过", start)
text = text[:start] + '''if (failures.length) {
  console.error(`商店与宝石验证失败:\\n- ${failures.join('\\n- ')}`);
  process.exit(1);
}
''' + text[end:]
path.write_text(text, encoding='utf-8')

path = Path('scripts/verify-form-state-isolation.mjs')
text = path.read_text(encoding='utf-8')
text = text.replace(
    "'buildFacility: (facilityTypeId: string) => Promise<ActionResult>;',",
    "'buildFacility: (facilityTypeId: string, quantity?: number) => Promise<ActionResult>;',",
    1,
)
text = text.replace(
    '''"buildFacility: (facilityTypeId) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId))",''',
    '''"buildFacility: (facilityTypeId, quantity = 1) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId, quantity))",''',
    1,
)
text = text.replace(
    "'buildFacility(selectedType.id)',",
    "'buildFacility(selectedType.id, buildQuantity)',",
    1,
)
path.write_text(text, encoding='utf-8')

path = Path('scripts/verify-runtime-efficiency.mjs')
text = path.read_text(encoding='utf-8')
text = text.replace("  'next integer release boundary',", "  'instant construction registers no employment deadline',", 1)
path.write_text(text, encoding='utf-8')
print('generated instant files fixed')
