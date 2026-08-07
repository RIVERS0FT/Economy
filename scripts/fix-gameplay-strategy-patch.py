from pathlib import Path

path = Path(__file__).resolve().with_name('apply-gameplay-strategy-next-phase.py')
text = path.read_text(encoding='utf-8')
text = text.replace('\\)', ')')
text = text.replace("'## 6. 研发\\n\\n'", "'### 5.4 研发页面\\n\\n'")
text = text.replace("'## 8. 合同\\n\\n'", "'## 7. 合同\\n\\n'")

old_literal = '"""  products,\\n  inventories,\\n  now,\\n  onToggle,"""'
new_literal = '"""  products,\\n  inventories,\\n  markets,\\n  credits,\\n  warehouseAvailableCapacity,\\n  now,\\n  onToggle,"""'
old_index = text.find(old_literal)
if old_index < 0:
    raise SystemExit('Could not find ambiguous FacilityClusterDetailContent old literal')
new_index = text.find(new_literal, old_index + len(old_literal))
if new_index < 0:
    raise SystemExit('Could not find FacilityClusterDetailContent replacement literal')
specific_old = '"""export function FacilityClusterDetailContent({\\n  entry,\\n  products,\\n  inventories,\\n  now,\\n  onToggle,"""'
specific_new = '"""export function FacilityClusterDetailContent({\\n  entry,\\n  products,\\n  inventories,\\n  markets,\\n  credits,\\n  warehouseAvailableCapacity,\\n  now,\\n  onToggle,"""'
text = text[:old_index] + specific_old + text[old_index + len(old_literal):]
new_index = text.find(new_literal, old_index + len(specific_old))
text = text[:new_index] + specific_new + text[new_index + len(new_literal):]

contract_marker = 'store.listContractAuditHistory = (user, rawOptions = {}) => store.transaction(() => {'
marker_index = text.find(contract_marker)
if marker_index < 0:
    raise SystemExit('Could not locate obsolete contract no-op patch marker')
call_start = text.rfind('insert_after(', 0, marker_index)
call_end = text.find('\n)\n', marker_index)
if call_start < 0 or call_end < 0:
    raise SystemExit('Could not locate obsolete contract no-op patch boundaries')
text = text[:call_start] + text[call_end + 3:]

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
