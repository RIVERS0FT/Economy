from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1))


def replace_all(path: str, old: str, new: str, expected: int | None = None) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if expected is not None and count != expected:
        raise RuntimeError(f"{path}: expected {expected} matches, found {count}: {old[:80]!r}")
    if count == 0:
        raise RuntimeError(f"{path}: no matches: {old[:80]!r}")
    file.write_text(text.replace(old, new))


# Facility production, construction and facility-market fees.
replace_once(
    "server/src/facility-groups.js",
    "import { findSelfCrossingOrder, SELF_CROSS_MESSAGE } from './order-book-integrity.js';\n",
    "import { findSelfCrossingOrder, SELF_CROSS_MESSAGE } from './order-book-integrity.js';\n"
    "import { creditPopulationEmployment, releaseConstructionEmployment } from './population-economy.js';\n",
)
replace_once(
    "server/src/facility-groups.js",
    "  delete normalized.demandCycleId;\n  delete normalized.marketSellFeeVersion;",
    "  delete normalized.demandCycleId;\n  delete normalized.populationModelId;\n  delete normalized.fundingPool;\n  delete normalized.marketSellFeeVersion;",
)
replace_once(
    "server/src/facility-groups.js",
    "  player.stats.giftIssued = Number(player.stats.giftIssued || 0);\n",
    "  player.stats.giftIssued = Number(player.stats.giftIssued || 0);\n"
    "  player.stats.gemExchangeCredits = Number(player.stats.gemExchangeCredits || 0);\n"
    "  player.stats.populationIncome = Number(player.stats.populationIncome || 0);\n"
    "  player.stats.employmentPayments = Number(player.stats.employmentPayments || 0);\n"
    "  player.stats.productionPayroll = Number(player.stats.productionPayroll || 0);\n"
    "  player.stats.constructionPayroll = Number(player.stats.constructionPayroll || 0);\n"
    "  player.stats.warehousePayroll = Number(player.stats.warehousePayroll || 0);\n"
    "  player.stats.marketServiceFees = Number(player.stats.marketServiceFees || 0);\n",
)
replace_once(
    "server/src/facility-groups.js",
    "          player.facilityConstruction = {\n            facilityTypeId: type.id,\n            startedAt: Math.max(0, Number(facility.constructionCompletesAt || now) - type.buildTimeMs),\n            completesAt: Number(facility.constructionCompletesAt || now),\n          };",
    "          player.facilityConstruction = {\n            facilityTypeId: type.id,\n            startedAt: Math.max(0, Number(facility.constructionCompletesAt || now) - type.buildTimeMs),\n            completesAt: Number(facility.constructionCompletesAt || now),\n            buildCost: type.buildCost,\n            employmentReleased: type.buildCost,\n          };",
)
replace_all("server/src/facility-groups.js", "  world.version = 13;", "  world.version = 14;", expected=2)
replace_once(
    "server/src/facility-groups.js",
    "function executeCycle(player, group, type, count) {\n  const recipe = activeRecipeFor(type, group);\n  const requirements = groupRequirements(recipe, count);\n  player.credits -= requirements.cost;\n  player.stats.systemSinks += requirements.cost;\n  player.stats.producedGoods = Number(player.stats.producedGoods || 0) + requirements.output;",
    "function executeCycle(world, player, group, type, count) {\n  const recipe = activeRecipeFor(type, group);\n  const requirements = groupRequirements(recipe, count);\n  player.credits -= requirements.cost;\n  creditPopulationEmployment(world, requirements.cost, 'production', { complexity: type.complexity });\n  player.stats.productionPayroll = Number(player.stats.productionPayroll || 0) + requirements.cost;\n  player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + requirements.cost;\n  player.stats.producedGoods = Number(player.stats.producedGoods || 0) + requirements.output;",
)
replace_once(
    "server/src/facility-groups.js",
    "function finishConstruction(player, now) {\n  const construction = player.facilityConstruction;\n  if (!construction || now < construction.completesAt) return;",
    "function finishConstruction(world, player, now) {\n  const construction = player.facilityConstruction;\n  if (!construction) return;\n  releaseConstructionEmployment(world, construction, now);\n  if (now < construction.completesAt) return;",
)
replace_once(
    "server/src/facility-groups.js",
    "    executeCycle(player, group, type, group.participatingCount);",
    "    executeCycle(world, player, group, type, group.participatingCount);",
)
replace_once(
    "server/src/facility-groups.js",
    "        seller.credits += sellerSettlement.netTotal;\n        seller.stats.systemSinks = Number(seller.stats.systemSinks || 0) + sellerSettlement.fee;\n        seller.stats.facilityVolume = Number(seller.stats.facilityVolume || 0) + quantity * price;",
    "        seller.credits += sellerSettlement.netTotal;\n        if (sellerSettlement.fee > 0) {\n          creditPopulationEmployment(world, sellerSettlement.fee, 'marketService');\n          seller.stats.marketServiceFees = Number(seller.stats.marketServiceFees || 0) + sellerSettlement.fee;\n          seller.stats.employmentPayments = Number(seller.stats.employmentPayments || 0) + sellerSettlement.fee;\n        }\n        seller.stats.facilityVolume = Number(seller.stats.facilityVolume || 0) + quantity * price;",
)
replace_once(
    "server/src/facility-groups.js",
    "    finishConstruction(player, now);",
    "    finishConstruction(world, player, now);",
)
replace_once(
    "server/src/facility-groups.js",
    "  player.credits -= type.buildCost;\n  player.stats.systemSinks += type.buildCost;\n  player.facilityConstruction = {\n    facilityTypeId: type.id,\n    startedAt: now,\n    completesAt: now + type.buildTimeMs,\n  };",
    "  player.credits -= type.buildCost;\n  player.stats.constructionPayroll = Number(player.stats.constructionPayroll || 0) + type.buildCost;\n  player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + type.buildCost;\n  player.facilityConstruction = {\n    facilityTypeId: type.id,\n    startedAt: now,\n    completesAt: now + type.buildTimeMs,\n    buildCost: type.buildCost,\n    employmentReleased: 0,\n  };",
)
replace_once(
    "server/src/facility-groups.js",
    "        weeklyChange: Number(player.stats.workIssued || 0) + Number(player.stats.populationIssued || 0) + Number(player.stats.giftIssued || 0) - Number(player.stats.systemSinks || 0),",
    "        weeklyChange: Number(player.stats.workIssued || 0)\n          + Number(player.stats.gemExchangeCredits || 0)\n          + Number(player.stats.populationIncome || 0)\n          + Number(player.stats.populationIssued || 0)\n          + Number(player.stats.giftIssued || 0)\n          - Number(player.stats.systemSinks || 0)\n          - Number(player.stats.employmentPayments || 0),",
)
replace_once("server/src/facility-groups.js", "    version: 15,", "    version: 16,")

# Warehouse expansion becomes population employment.
replace_once(
    "server/src/warehouse.js",
    "import { isOpenOrder, orderKind } from './order-identity.js';\n",
    "import { isOpenOrder, orderKind } from './order-identity.js';\n"
    "import { creditPopulationEmploymentForPlayer } from './population-economy.js';\n",
)
replace_once(
    "server/src/warehouse.js",
    "  player.stats ||= {};\n  player.stats.systemSinks = Number(player.stats.systemSinks || 0) + cost;",
    "  player.stats ||= {};\n  if (!creditPopulationEmploymentForPlayer(player, cost, 'warehouse')) {\n    throw new Error('仓库扩容无法连接人口经济账户');\n  }\n  player.stats.warehousePayroll = Number(player.stats.warehousePayroll || 0) + cost;\n  player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + cost;",
)

# Higher-complexity cycle costs become the optimized wage bill.
for old, new in [
    ("operatingCost: 6, inputs: [{ productId: 'crude-oil', quantity: 2 }]", "operatingCost: 8, inputs: [{ productId: 'crude-oil', quantity: 2 }]"),
    ("operatingCost: 11, inputs: [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }]", "operatingCost: 14, inputs: [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }]"),
    ("operatingCost: 6, inputs: [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }]", "operatingCost: 9, inputs: [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }]"),
    ("operatingCost: 5, inputs: [{ productId: 'lumber', quantity: 2 }]", "operatingCost: 8, inputs: [{ productId: 'lumber', quantity: 2 }]"),
    ("operatingCost: 6, inputs: [{ productId: 'textile', quantity: 2 }]", "operatingCost: 9, inputs: [{ productId: 'textile', quantity: 2 }]"),
    ("operatingCost: 6, inputs: [{ productId: 'steel', quantity: 2 }]", "operatingCost: 10, inputs: [{ productId: 'steel', quantity: 2 }]"),
    ("operatingCost: 10, inputs: [{ productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 }]", "operatingCost: 15, inputs: [{ productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 }]"),
    ("operatingCost: 6, inputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 }]", "operatingCost: 12, inputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 }]"),
]:
    replace_once("server/src/industry-catalog.js", old, new)

# Core world/player migration fields.
replace_all("server/src/domain-core.js", "version: 13,", "version: 14,", expected=1)
replace_once("server/src/domain-core.js", "  world.version = 13;", "  world.version = 14;")
replace_once(
    "server/src/domain-core.js",
    "      giftIssued: 0,\n",
    "      giftIssued: 0,\n"
    "      gemExchangeCredits: 0,\n"
    "      populationIncome: 0,\n"
    "      employmentPayments: 0,\n"
    "      productionPayroll: 0,\n"
    "      constructionPayroll: 0,\n"
    "      warehousePayroll: 0,\n"
    "      marketServiceFees: 0,\n",
)
replace_once(
    "server/src/domain-core.js",
    "    player.stats.giftIssued = Number(player.stats.giftIssued || 0);\n",
    "    player.stats.giftIssued = Number(player.stats.giftIssued || 0);\n"
    "    player.stats.gemExchangeCredits = Number(player.stats.gemExchangeCredits || 0);\n"
    "    player.stats.populationIncome = Number(player.stats.populationIncome || 0);\n"
    "    player.stats.employmentPayments = Number(player.stats.employmentPayments || 0);\n"
    "    player.stats.productionPayroll = Number(player.stats.productionPayroll || 0);\n"
    "    player.stats.constructionPayroll = Number(player.stats.constructionPayroll || 0);\n"
    "    player.stats.warehousePayroll = Number(player.stats.warehousePayroll || 0);\n"
    "    player.stats.marketServiceFees = Number(player.stats.marketServiceFees || 0);\n",
)

# Domain wrapper owns population migration/binding and version 14.
replace_once(
    "server/src/domain.js",
    "import { orderAssetId, orderKind } from './order-identity.js';\n",
    "import { orderAssetId, orderKind } from './order-identity.js';\n"
    "import { ensurePopulationEconomy } from './population-economy.js';\n",
)
replace_once(
    "server/src/domain.js",
    "  marketDemand.initializeWorld(world, now);\n  world.orderBookIntegrityVersion = ORDER_BOOK_INTEGRITY_VERSION;\n  world.version = 13;",
    "  marketDemand.initializeWorld(world, now);\n  ensurePopulationEconomy(world, now);\n  world.orderBookIntegrityVersion = ORDER_BOOK_INTEGRITY_VERSION;\n  world.version = 14;",
)
replace_once(
    "server/src/domain.js",
    "  migrated.orderBookIntegrityVersion = ORDER_BOOK_INTEGRITY_VERSION;\n  migrated.version = 13;",
    "  ensurePopulationEconomy(migrated, now);\n  migrated.orderBookIntegrityVersion = ORDER_BOOK_INTEGRITY_VERSION;\n  migrated.version = 14;",
)
replace_once(
    "server/src/domain.js",
    "  const player = core.ensurePlayer(world, user, now);\n  marketDemand.normalizeWorld(world, now);",
    "  const player = core.ensurePlayer(world, user, now);\n  ensurePopulationEconomy(world, now);\n  marketDemand.normalizeWorld(world, now);",
)
replace_once(
    "server/src/domain.js",
    "  migrateWorld(world, now);\n  core.processWorld(world, now);",
    "  migrateWorld(world, now);\n  ensurePopulationEconomy(world, now);\n  core.processWorld(world, now);",
)

# Storage/client versions.
replace_once("server/src/storage.js", "    version: 15,", "    version: 16,")
replace_once("server/src/storage.js", "    world.version = 13;", "    world.version = 14;")

# Admin summary exposes population economy.
replace_once(
    "server/src/admin-summary.js",
    "export function getStableAdminSummary(store, user, now = Date.now()) {",
    "import { createPopulationEconomySummary } from './population-economy.js';\n\n"
    "export function getStableAdminSummary(store, user, now = Date.now()) {",
)
replace_once(
    "server/src/admin-summary.js",
    "      apiStatus: 'ok',\n    };",
    "      apiStatus: 'ok',\n      populationEconomy: createPopulationEconomySummary(world),\n    };",
)

# Remove temporary patch machinery from the final patch commit.
Path("scripts/apply-population-economy-v7.py").unlink()
Path(".github/workflows/apply-population-economy-v7.yml").unlink()
