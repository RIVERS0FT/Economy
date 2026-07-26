from pathlib import Path

path = Path('server/src/facility-groups.js')
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'missing facility marker: {label}')
    text = text.replace(old, new, 1)


replace_once(
    "import { activeLoanLiability, ensurePlayerBankAccount, mortgagedFacilityQuantity } from './banking.js';\n",
    "import { activeLoanLiability, ensurePlayerBankAccount, mortgagedFacilityQuantity } from './banking.js';\nimport { ensureGemState } from './invitations.js';\n",
    'gem import',
)
replace_once(
    "const MAX_PRICE_POINTS = 288;\n",
    "const MAX_PRICE_POINTS = 288;\nexport const GEM_CONSTRUCTION_ACCELERATION_MS = 30 * 60 * 1000;\nexport const GEM_CONSTRUCTION_ACCELERATION_COST = 1;\n",
    'acceleration constants',
)
replace_once(
    """  return result(true, `${type.name}开始施工，建成后将在下一生产周期加入同类工厂集群`);
}

function startFacilityGroup""",
    """  return result(true, `${type.name}开始施工，建成后将在下一生产周期加入同类工厂集群`);
}

function accelerateFacilityConstruction(world, userId, now) {
  const player = getPlayer(world, userId);
  ensureGemState(player);
  const construction = player.facilityConstruction;
  if (!construction) return result(false, '当前没有正在施工的工厂');
  const type = typeFor(construction.facilityTypeId);
  if (!type) return result(false, '施工中的工厂类型不存在');
  const remainingMsBefore = Math.max(0, Number(construction.completesAt || 0) - now);
  if (remainingMsBefore <= 0) return result(false, '施工已经完成，正在等待服务器确认');
  if (player.gems < GEM_CONSTRUCTION_ACCELERATION_COST) return result(false, '宝石余额不足');

  releaseConstructionEmployment(world, construction, now);
  player.gems -= GEM_CONSTRUCTION_ACCELERATION_COST;
  const shortenedCompletesAt = Number(construction.completesAt) - GEM_CONSTRUCTION_ACCELERATION_MS;
  const completedImmediately = shortenedCompletesAt <= now;
  if (completedImmediately) {
    const settlementNow = Math.max(now, Number(construction.startedAt || now) + 1);
    construction.completesAt = settlementNow;
    releaseConstructionEmployment(world, construction, settlementNow);
    finishConstruction(world, player, settlementNow);
  } else {
    construction.completesAt = shortenedCompletesAt;
    releaseConstructionEmployment(world, construction, now);
  }
  const remainingMsAfter = completedImmediately
    ? 0
    : Math.max(0, Number(player.facilityConstruction?.completesAt || 0) - now);
  return {
    ok: true,
    message: completedImmediately
      ? `消耗 ${GEM_CONSTRUCTION_ACCELERATION_COST} 宝石，${type.name}已立即完工`
      : `消耗 ${GEM_CONSTRUCTION_ACCELERATION_COST} 宝石，${type.name}施工减少 30m`,
    gemsSpent: GEM_CONSTRUCTION_ACCELERATION_COST,
    balanceAfter: player.gems,
    facilityTypeId: type.id,
    reducedMs: Math.min(GEM_CONSTRUCTION_ACCELERATION_MS, remainingMsBefore),
    remainingMsBefore,
    remainingMsAfter,
    completedImmediately,
  };
}

function startFacilityGroup""",
    'acceleration function',
)
replace_once(
    "  if (action === 'buildFacility') actionResult = buildFacilityGroup(world, userId, payload, now);\n  else if (action === 'startFacility')",
    "  if (action === 'buildFacility') actionResult = buildFacilityGroup(world, userId, payload, now);\n  else if (action === 'accelerateFacilityConstruction') actionResult = accelerateFacilityConstruction(world, userId, now);\n  else if (action === 'startFacility')",
    'action dispatcher',
)
replace_once(
    "    facilityConstruction: player.facilityConstruction ? clone(player.facilityConstruction) : undefined,\n",
    "    facilityConstruction: player.facilityConstruction ? {\n      ...clone(player.facilityConstruction),\n      gemAccelerationMs: GEM_CONSTRUCTION_ACCELERATION_MS,\n      gemAccelerationCost: GEM_CONSTRUCTION_ACCELERATION_COST,\n    } : undefined,\n",
    'client construction',
)
path.write_text(text)
