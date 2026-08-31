from pathlib import Path

path = Path('scripts/verify-page-content.mjs')
text = path.read_text(encoding='utf-8')
replacements = {
    "  '全局工厂条目的第一行原数据区域继续作为进入该工厂类型地区列表的主交互面',": "  '全局工厂条目只有第一行原数据区域作为进入该工厂类型地区列表的主交互面',",
    "  '<ProductArtwork productId={row.quickProduction.productId} />',": "  'visual: <ProductArtwork productId={option.productId} />,',",
    "  '<QuickProductionMethodIcon methodId={row.quickProduction.methodId} />',": "  'visual: <QuickProductionMethodIcon methodId={option.id as FacilityProductionMethodId} />,',",
    "  '<FacilityIcon facilityTypeId={row.facilityTypeId} className=\"global-facility-catalog-row__artwork\" />',": "  'className=\"global-facility-catalog-row__artwork\"',",
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'verifier fix expected one occurrence, got {count}: {old}')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8', newline='\n')
print('Updated legacy global building verifier anchors')
