from pathlib import Path

path = Path(__file__).resolve().with_name('apply-gameplay-strategy-next-phase.py')
text = path.read_text(encoding='utf-8')
text = text.replace('\\)', ')')

ambiguous = r'''replace_once(
    'src/pages/production/ProductionFacilityDetail.tsx',
    """  products,
  inventories,
  now,
  onToggle,""",
    """  products,
  inventories,
  markets,
  credits,
  warehouseAvailableCapacity,
  now,
  onToggle,""",
)'''
specific = r'''replace_once(
    'src/pages/production/ProductionFacilityDetail.tsx',
    """export function FacilityClusterDetailContent({
  entry,
  products,
  inventories,
  now,
  onToggle,""",
    """export function FacilityClusterDetailContent({
  entry,
  products,
  inventories,
  markets,
  credits,
  warehouseAvailableCapacity,
  now,
  onToggle,""",
)'''
text = text.replace(ambiguous, specific)

sentinel = '# MOBILE_FACILITY_DIAGNOSTICS_FORWARDING'
if sentinel not in text:
    text += r'''

# MOBILE_FACILITY_DIAGNOSTICS_FORWARDING
replace_once(
    'src/pages/production/MobileFacilityDetailSheet.tsx',
    """  products,
  inventories,
  now,
  isOpen,""",
    """  products,
  inventories,
  markets,
  credits,
  warehouseAvailableCapacity,
  now,
  isOpen,""",
)
replace_once(
    'src/pages/production/MobileFacilityDetailSheet.tsx',
    """        products={products}
        inventories={inventories}
        now={now}
        onRecipeChange={onRecipeChange}""",
    """        products={products}
        inventories={inventories}
        markets={markets}
        credits={credits}
        warehouseAvailableCapacity={warehouseAvailableCapacity}
        now={now}
        onRecipeChange={onRecipeChange}""",
)

# Keep generated funnel code simple after the cohort replacement.
statistics_path = 'server/src/player-admin-statistics.js'
statistics_text = read(statistics_path)
statistics_text = statistics_text.replace(
    "  const stageUsers = [registeredStage, actionStage, facilityStage, productionStage, tradeStage, researchStage, bankStage, growthLineStage];\n",
    '',
).replace("  void stageUsers;\n", '')
write(statistics_path, statistics_text)
'''

path.write_text(text, encoding='utf-8')
print('Temporary gameplay strategy patch normalized.')
