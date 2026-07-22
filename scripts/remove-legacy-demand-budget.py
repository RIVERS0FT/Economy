from pathlib import Path
import re

path = Path('server/src/market-demand/allocation.js')
text = path.read_text()
text, count = re.subn(
    r"import \{\n  ACTIVE_PLAYER_WINDOW_MS,\n  ACTIVITY_WINDOW_MS,\n  BUDGET_MAX_FALL,\n  BUDGET_MAX_RISE,\n  BUDGET_SMOOTHING,\n  PLAYER_SCALE_MAX,\n\} from './catalog\.js';\n",
    '',
    text,
    count=1,
)
if count != 1:
    raise RuntimeError('legacy allocation imports not found')
text, count = re.subn(
    r"\n  function activePlayerCount\(world, now\) \{.*?\n  function allocateClassBudgets",
    '\n  function allocateClassBudgets',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError('legacy dynamic budget block not found')
text = text.replace(
    '  return { dynamicBudget, directDemandChoices, derivedDemandChoices };',
    '  return { directDemandChoices, derivedDemandChoices };',
)
path.write_text(text)
Path('population-validation.log').unlink(missing_ok=True)
Path('scripts/remove-legacy-demand-budget.py').unlink()
Path('.github/workflows/remove-legacy-demand-budget.yml').unlink()
