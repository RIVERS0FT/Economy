from pathlib import Path

path = Path(__file__).resolve().with_name('apply-gameplay-strategy-next-phase.py')
text = path.read_text(encoding='utf-8')
text = text.replace('\\)', ')')
text = text.replace("'## 6. 研发\\n\\n'", "'### 5.4 研发页面\\n\\n'")
text = text.replace("'## 8. 合同\\n\\n'", "'## 7. 合同\\n\\n'")
text = text.replace(
    'store.getContractAuditDetail = (user, contractId, rawOptions = {}) => store.transaction(() => {',
    'store.getContractAuditDetail = (user, contractId, options = {}) => store.transaction(() => {',
)
text = text.replace(
    '"""  ContractAuditHistoryPage,\\n  ContractAuditDetail,"""',
    '"""  ContractAuditDetail,\\n  ContractAuditHistoryPage,"""',
).replace(
    '"""  ContractAuditHistoryPage,\\n  ContractAuditDetail,\\n  ContractPerformanceSummary,"""',
    '"""  ContractAuditDetail,\\n  ContractAuditHistoryPage,\\n  ContractPerformanceSummary,"""',
)

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
next_block = text.find('# Insert the new method immediately before the existing detail method for a stable API surface.', marker_index)
if call_start < 0 or next_block < 0:
    raise SystemExit('Could not locate obsolete contract no-op patch boundaries')
text = text[:call_start] + text[next_block:]

phase4_start = text.find('# Phase 4: leaderboard current-segment goals')
leaderboard_style_start = text.find("append_once('src/styles/leaderboards.css'", phase4_start)
if phase4_start < 0 or leaderboard_style_start < 0:
    raise SystemExit('Could not locate leaderboard patch section')
leaderboard_patch = r'''# Phase 4: leaderboard current-segment goals ----------------------------------------
replace_once(
    'src/pages/LeaderboardPage.tsx',
    "import { formatCurrency, formatNumber, formatRank } from '../utils/formatters';",
    "import { formatCurrency, formatNumber, formatRank } from '../utils/formatters';\nimport { personalLeaderboardGoal } from '../utils/leaderboardGoals';",
)
insert_after(
    'src/pages/LeaderboardPage.tsx',
    """  const current = board.currentPlayer;\n  const currentRank = current?.rank;\n""",
    """  const personalGoal = personalLeaderboardGoal(board);\n""",
)
insert_after(
    'src/pages/LeaderboardPage.tsx',
    """      <footer className=\"leaderboard-current-player\">\n        <div>\n          <span>我的排名</span>\n          <strong>{formatRank(currentRank)}</strong>\n        </div>\n        <div>\n          <span>我的成绩</span>\n          <strong>{current ? scoreValue(board, current.score) : '暂无'}</strong>\n        </div>\n      </footer>\n""",
    """      {personalGoal ? (\n        <div className=\"leaderboard-personal-goal\" aria-label={`${board.title}个人竞争目标`}>\n          <span>当前 {personalGoal.bandLabel}</span>\n          <strong>{personalGoal.targetLabel}</strong>\n          <small>{personalGoal.distance > 0 ? `距离目标还差 ${formatNumber(personalGoal.distance)} 名` : '当前目标已达成'}</small>\n        </div>\n      ) : null}\n""",
)
'''
text = text[:phase4_start] + leaderboard_patch + text[leaderboard_style_start:]

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
