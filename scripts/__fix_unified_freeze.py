from pathlib import Path


def patch(path, old, new):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'{path}: expected block not found')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')

patch(
    'server/src/facility-groups.js',
    '''  const listedCount = listedQuantity(world, player.userId, group.facilityTypeId, group.provinceId);\n  const auctionedCount = auctionedQuantity(world, player.userId, group.facilityTypeId, group.provinceId);\n  const transactionFrozenCount = listedCount + auctionedCount;\n  const mortgagedCount = mortgagedFacilityQuantity(player, group.facilityTypeId, group.provinceId);\n  const contractCollateralCount = playerLoanCollateralQuantity(world, player.userId, group.facilityTypeId, group.provinceId);\n  const frozenCount = transactionFrozenCount + mortgagedCount + contractCollateralCount;\n  const leasedOutCount = leasedOutFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);\n  const leasedInCount = leasedInFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);\n  const productionAvailableCount = Math.max(0, group.count - frozenCount - leasedOutCount + leasedInCount);\n  const availableCount = Math.max(0, group.count - frozenCount - mortgagedCount - contractCollateralCount - leasedOutCount);\n''',
    '''  const listedCount = listedQuantity(world, player.userId, group.facilityTypeId, group.provinceId);\n  const auctionedCount = auctionedQuantity(world, player.userId, group.facilityTypeId, group.provinceId);\n  const frozenCount = listedCount + auctionedCount;\n  const mortgagedCount = mortgagedFacilityQuantity(player, group.facilityTypeId, group.provinceId);\n  const contractCollateralCount = playerLoanCollateralQuantity(world, player.userId, group.facilityTypeId, group.provinceId);\n  const leasedOutCount = leasedOutFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);\n  const leasedInCount = leasedInFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);\n  const productionAvailableCount = Math.max(0, group.count - frozenCount - leasedOutCount + leasedInCount);\n  const availableCount = Math.max(0, group.count - frozenCount - mortgagedCount - contractCollateralCount - leasedOutCount);\n''',
)

patch(
    'src/pages/production/ProductionFacilityDetail.tsx',
    '冻结中 <strong>{<CompactNumber value={group.frozenCount ?? group.listedCount} />}</strong>',
    '冻结中 <strong>{<CompactNumber value={(group.frozenCount ?? group.listedCount) + group.mortgagedCount + (group.contractCollateralCount ?? 0)} />}</strong>',
)

patch(
    'src/components/assets/AssetOverviewPanel.tsx',
    '  const frozenFacilities = game.facilityGroups.reduce((sum, group) => sum + Number(group.frozenCount || 0), 0);',
    '  const frozenFacilities = game.facilityGroups.reduce((sum, group) => sum + Number(group.frozenCount || 0) + Number(group.mortgagedCount || 0) + Number(group.contractCollateralCount || 0), 0);',
)

# Preserve the internal field boundary in design: frozenCount stays transaction-only; UI composes all freeze reasons.
for path in ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', 'docs/UI_DESIGN_SYSTEM.md']:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    text = text.replace('让冻结工厂退出生产、进入 `frozenCount`', '让贷款冻结工厂退出生产、进入内部交易冻结字段 `frozenCount`')
    text = text.replace('让冻结工厂退出生产，进入 `frozenCount`', '让贷款冻结工厂退出生产，进入内部交易冻结字段 `frozenCount`')
    file.write_text(text, encoding='utf-8')

industry = Path('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md')
text = industry.read_text(encoding='utf-8')
anchor = '银行贷款冻结数量继续参与生产，但不得出售、拍卖或重复冻结；贷款冻结与拍卖／交易冻结在内部仍分别保存，普通玩家界面统一归类为“冻结”。'
if anchor in text:
    text = text.replace(anchor, anchor + ' 内部 `frozenCount` 仍只表示交易／拍卖冻结；工厂详情的“冻结中”数量由客户端合并 `frozenCount + mortgagedCount + contractCollateralCount`，不得反向改变生产可用数量。', 1)
else:
    text += '\n\n内部 `frozenCount` 仍只表示交易／拍卖冻结；工厂详情的“冻结中”数量由客户端合并 `frozenCount + mortgagedCount + contractCollateralCount`，不得反向改变生产可用数量。\n'
industry.write_text(text, encoding='utf-8')

ui = Path('docs/UI_DESIGN_SYSTEM.md')
text = ui.read_text(encoding='utf-8')
if '工厂详情“冻结中”数量统一合并' not in text:
    text += '\n- 工厂详情“冻结中”数量统一合并交易／拍卖冻结、银行贷款冻结与玩家借贷合同冻结；这是展示汇总，不改变内部 `frozenCount` 的交易冻结语义，也不得让贷款冻结工厂退出生产。\n'
ui.write_text(text, encoding='utf-8')

# Improve first-upgrade chart continuity: use still-retained raw trades only for missing completed daily buckets.
market = Path('server/src/market-state-delivery.js')
text = market.read_text(encoding='utf-8')
old = '''  for (const entry of Array.isArray(market?.dailyHistory) ? market.dailyHistory : []) remember(entry);\n  if (assetKind === 'commodity') {\n    remember({ dateKey: checkInDateKey(now), price: Number(market?.officialPrice || market?.lastPrice || 0), buyQuantity: Math.max(0, Number(market?.todayBuyQuantity || 0)), sellQuantity: Math.max(0, Number(market?.todaySellQuantity || 0)) });\n  } else {\n    for (const point of realTradePointsBetween(market, now - MARKET_DAILY_HISTORY_DAYS * DAY_MS, now)) {\n      const dateKey = checkInDateKey(Number(point.createdAt || 0));\n      const current = byDate.get(dateKey) || { dateKey, price: Number(point.price || 0), buyVolume: 0, sellVolume: 0, neutralVolume: 0, volume: 0 };\n      const quantity = Math.max(0, Number(point.quantity || 0));\n      current.price = Number(point.price || current.price || 0);\n      current.volume += quantity;\n      if (point.takerSide === 'buy') current.buyVolume += quantity;\n      else if (point.takerSide === 'sell') current.sellVolume += quantity;\n      byDate.set(dateKey, current);\n    }\n  }\n'''
new = '''  for (const entry of Array.isArray(market?.dailyHistory) ? market.dailyHistory : []) remember(entry);\n  for (const point of realTradePointsBetween(market, now - MARKET_DAILY_HISTORY_DAYS * DAY_MS, now)) {\n    const dateKey = checkInDateKey(Number(point.createdAt || 0));\n    if (byDate.has(dateKey)) continue;\n    const sameDay = realTradePointsBetween(\n      market,\n      Date.parse(`${dateKey}T00:00:00+08:00`),\n      Date.parse(`${dateKey}T23:59:59.999+08:00`),\n    );\n    if (sameDay.length < 1) continue;\n    const buyVolume = sameDay.reduce((sum, trade) => sum + (trade.takerSide === 'buy' ? Math.max(0, Number(trade.quantity || 0)) : 0), 0);\n    const sellVolume = sameDay.reduce((sum, trade) => sum + (trade.takerSide === 'sell' ? Math.max(0, Number(trade.quantity || 0)) : 0), 0);\n    remember({\n      dateKey,\n      price: Number(sameDay[sameDay.length - 1].price || 0),\n      buyVolume,\n      sellVolume,\n      volume: buyVolume + sellVolume,\n    });\n  }\n  if (assetKind === 'commodity') {\n    remember({ dateKey: checkInDateKey(now), price: Number(market?.officialPrice || market?.lastPrice || 0), buyQuantity: Math.max(0, Number(market?.todayBuyQuantity || 0)), sellQuantity: Math.max(0, Number(market?.todaySellQuantity || 0)) });\n  }\n'''
if old not in text:
    raise SystemExit('server/src/market-state-delivery.js: daily history block not found')
market.write_text(text.replace(old, new, 1), encoding='utf-8')

# Lock the display/internal boundary in structural verifiers.
warehouse = Path('scripts/verify-warehouse-expansion.mjs')
text = warehouse.read_text(encoding='utf-8')
line = "requireText('src/pages/production/ProductionFacilityDetail.tsx', '(group.frozenCount ?? group.listedCount) + group.mortgagedCount + (group.contractCollateralCount ?? 0)');"
if line not in text:
    text += '\n' + line + '\n'
warehouse.write_text(text, encoding='utf-8')

assets = Path('scripts/verify-assets-page.mjs')
text = assets.read_text(encoding='utf-8')
needle = 'Number(group.frozenCount || 0) + Number(group.mortgagedCount || 0) + Number(group.contractCollateralCount || 0)'
if needle not in text:
    text += f"\nrequireText(componentPath, '{needle}');\n"
assets.write_text(text, encoding='utf-8')

for path in ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', 'docs/UI_DESIGN_SYSTEM.md']:
    file = Path(path)
    file.write_text(file.read_text(encoding='utf-8').rstrip('\n') + '\n', encoding='utf-8')

print('Unified freeze boundary fixed.')
