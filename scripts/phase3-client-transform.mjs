import { readFileSync, writeFileSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content); }
function replaceOnce(path, from, to) {
  const content = read(path);
  const first = content.indexOf(from);
  if (first < 0) throw new Error(`${path}: missing exact fragment: ${from.slice(0, 100)}`);
  if (content.indexOf(from, first + from.length) >= 0) throw new Error(`${path}: duplicate exact fragment`);
  write(path, content.slice(0, first) + to + content.slice(first + from.length));
}
function replaceBetween(path, start, end, replacement) {
  const content = read(path);
  const startIndex = content.indexOf(start);
  if (startIndex < 0) throw new Error(`${path}: missing start marker`);
  const endIndex = content.indexOf(end, startIndex + start.length);
  if (endIndex < 0) throw new Error(`${path}: missing end marker`);
  write(path, content.slice(0, startIndex) + replacement + content.slice(endIndex));
}

replaceOnce(
  'src/app/stateDelivery.js',
  `      if (Object.keys(incomingSliceRevisions).length > 0) {\n        sliceRevisions = { ...sliceRevisions, ...incomingSliceRevisions };\n      }`,
  `      for (const partitionName of ['player', 'market']) {\n        if (!changedPartitions.includes(partitionName)) continue;\n        for (const sliceName of STATE_SLICE_NAMES_BY_PARTITION[partitionName] || []) {\n          const incomingRevision = incomingSliceRevisions[sliceName];\n          if (validRevisionToken(incomingRevision)) sliceRevisions[sliceName] = incomingRevision;\n          else delete sliceRevisions[sliceName];\n        }\n      }`,
);

replaceOnce(
  'src/pages/AuctionPage.tsx',
  `import { useAuctionNewIds } from '../hooks/useNavigationBadges';\nimport { useNow } from '../hooks/useNow';\nimport { formatCurrency, formatDuration, formatNumber, formatTime } from '../utils/formatters';`,
  `import { useAuctionNewIds } from '../hooks/useNavigationBadges';\nimport { LiveDurationUntil } from '../components/time/LiveServerTime';\nimport { formatCurrency, formatNumber, formatTime } from '../utils/formatters';`,
);
replaceOnce(
  'src/pages/AuctionPage.tsx',
  `function remainingText(endsAt: number, now: number) {\n  const remaining = Math.max(0, endsAt - now);\n  return remaining === 0 ? '等待服务器结算' : formatDuration(remaining);\n}`,
  `function AuctionRemainingTime({ endsAt, referenceNow }: { endsAt: number; referenceNow: number }) {\n  return <LiveDurationUntil deadline={endsAt} referenceNow={referenceNow} zeroText="等待服务器结算" />;\n}`,
);
replaceOnce(
  'src/pages/AuctionPage.tsx',
  `export function AuctionPage({ model }: { model: LoadedGameViewModel }) {\n  const now = useNow(model.game.lastProcessedAt);`,
  `export function AuctionPage({ model }: { model: LoadedGameViewModel }) {\n  const referenceNow = model.game.lastProcessedAt;`,
);
replaceOnce(
  'src/pages/AuctionPage.tsx',
  `<StatusTag tone="warning">{remainingText(auction.endsAt, now)}</StatusTag>`,
  `<StatusTag tone="warning"><AuctionRemainingTime endsAt={auction.endsAt} referenceNow={referenceNow} /></StatusTag>`,
);

replaceOnce(
  'src/pages/GemShopPage.tsx',
  `import { CurrencyAmount } from '../components/ui/CurrencyAmount';\nimport { IntegerInput } from '../components/ui/FormControls';\nimport { Button, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';\nimport { useNow } from '../hooks/useNow';\nimport { formatCurrency, formatDate, formatDuration, formatNumber } from '../utils/formatters';`,
  `import { CurrencyAmount } from '../components/ui/CurrencyAmount';\nimport { IntegerInput } from '../components/ui/FormControls';\nimport { Button, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';\nimport { LiveDurationUntil } from '../components/time/LiveServerTime';\nimport { formatCurrency, formatDate, formatNumber } from '../utils/formatters';`,
);
replaceOnce('src/pages/GemShopPage.tsx', `  const now = useNow(model.game.lastProcessedAt);\n`, '');
replaceOnce('src/pages/GemShopPage.tsx', `  const quoteRemaining = summary?.nextRateAt ? Math.max(0, summary.nextRateAt - now) : 0;\n`, '');
replaceOnce(
  'src/pages/GemShopPage.tsx',
  `{quoteRemaining > 0 ? formatDuration(quoteRemaining) : '即将更新'}`,
  `<LiveDurationUntil deadline={summary.nextRateAt} referenceNow={model.game.lastProcessedAt} zeroText="即将更新" />`,
);

replaceOnce(
  'src/pages/BankPage.tsx',
  `import { useNow } from '../hooks/useNow';\nimport { formatCurrency, formatDuration, formatNumber, formatTime } from '../utils/formatters';`,
  `import { LiveDurationUntil } from '../components/time/LiveServerTime';\nimport { useNow } from '../hooks/useNow';\nimport { formatCurrency, formatNumber, formatTime } from '../utils/formatters';`,
);
replaceOnce(
  'src/pages/BankPage.tsx',
  `  const now = useNow(model.game.lastProcessedAt);`,
  `  const referenceNow = model.game.lastProcessedAt;\n  const riskNow = useNow(referenceNow, 60_000);`,
);
replaceOnce(
  'src/pages/BankPage.tsx',
  `  const recentDefault = bankAccount.recentDefaultAt !== null && now - bankAccount.recentDefaultAt < RECENT_DEFAULT_MS;`,
  `  const recentDefault = bankAccount.recentDefaultAt !== null && riskNow - bankAccount.recentDefaultAt < RECENT_DEFAULT_MS;`,
);
replaceOnce('src/pages/BankPage.tsx', `  const loanRemaining = loanDeadline ? Math.max(0, loanDeadline - now) : 0;\n  const settlementRemaining = Math.max(0, bankSummary.nextInterestSettlementAt - now);\n`, '');
replaceOnce(
  'src/pages/BankPage.tsx',
  `{settlementRemaining > 0 ? formatDuration(settlementRemaining) : '等待服务器结算'}`,
  `<LiveDurationUntil deadline={bankSummary.nextInterestSettlementAt} referenceNow={referenceNow} zeroText="等待服务器结算" />`,
);
replaceOnce(
  'src/pages/BankPage.tsx',
  `value={loanRemaining > 0 ? formatDuration(loanRemaining) : '等待服务器结算'}`,
  `value={loanDeadline ? <LiveDurationUntil deadline={loanDeadline} referenceNow={referenceNow} zeroText="等待服务器结算" /> : '—'}`,
);

replaceOnce('src/pages/ProductionPage.tsx', `import { useNow } from '../hooks/useNow';\n`, '');
replaceOnce('src/pages/ProductionPage.tsx', `  const now = useNow(game.lastProcessedAt);`, `  const now = game.lastProcessedAt;`);

replaceOnce(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `import { formatNumber } from '../../utils/formatters';`,
  `import { useNow } from '../../hooks/useNow';\nimport { formatNumber } from '../../utils/formatters';`,
);
replaceOnce(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `  const { group, type } = entry;\n  const markets = useFacilityRecipeProfitMarkets();\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const profitScope = currentFormulaScope(group, now);`,
  `  const { group, type } = entry;\n  const liveNow = useNow(now, 10_000);\n  const markets = useFacilityRecipeProfitMarkets();\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const profitScope = currentFormulaScope(group, liveNow);`,
);
replaceOnce(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `  const { group, type } = entry;\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const profitScope = currentFormulaScope(group, now);\n\n  return (\n    <section\n      className="facility-information"`,
  `  const { group, type } = entry;\n  const liveNow = useNow(now);\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const profitScope = currentFormulaScope(group, liveNow);\n\n  return (\n    <section\n      className="facility-information"`,
);
replaceOnce(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `  const { group, type } = entry;\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const operatingScope = currentFormulaScope(group, now);`,
  `  const { group, type } = entry;\n  const liveNow = useNow(now);\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const operatingScope = currentFormulaScope(group, liveNow);`,
);
replaceOnce('src/pages/production/ProductionFacilityDetail.tsx', `<FacilityStaffingSummary entry={entry} now={now} />`, `<FacilityStaffingSummary entry={entry} now={liveNow} />`);
replaceOnce(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `        now={now}\n        onOpenProductMarket={onOpenProductMarket}`,
  `        now={liveNow}\n        onOpenProductMarket={onOpenProductMarket}`,
);

replaceOnce('src/pages/ResearchPage.tsx', `export function ResearchPage({ model }: { model: TutorialAwareGameViewModel }) {\n  const now = useNow(model.game.lastProcessedAt);`, `export function ResearchPage({ model }: { model: TutorialAwareGameViewModel }) {\n  const now = useNow(model.game.lastProcessedAt, 10_000);`);
replaceOnce(
  'src/pages/ResearchPage.tsx',
  `}: ResearchDetailProps) {\n  const presentation = resolveResearchDetailPresentation({\n    model,\n    technology,\n    technologiesById,\n    completed,\n    now,\n  });`,
  `}: ResearchDetailProps) {\n  const liveNow = useNow(now);\n  const presentation = resolveResearchDetailPresentation({\n    model,\n    technology,\n    technologiesById,\n    completed,\n    now: liveNow,\n  });`,
);
replaceOnce(
  'src/pages/ResearchPage.tsx',
  `function ResearchDetailActions(props: ResearchDetailProps) {\n  const { canStart, fundsMet, actionLabel } = resolveResearchDetailPresentation(props);`,
  `function ResearchDetailActions(props: ResearchDetailProps) {\n  const liveNow = useNow(props.now);\n  const { canStart, fundsMet, actionLabel } = resolveResearchDetailPresentation({ ...props, now: liveNow });`,
);

replaceOnce(
  'src/pages/OverviewPage.tsx',
  `import { GameGuideStrip } from '../components/GameGuideStrip';`,
  `import { GameGuideStrip } from '../components/GameGuideStrip';\nimport { OverviewEconomicCalendarPanel, OverviewWorkButton } from './overview/OverviewLiveSections';`,
);
replaceOnce('src/pages/OverviewPage.tsx', `import { eventMarketFeedback } from '../utils/marketDecisionSignals';\n`, '');
replaceOnce(
  'src/pages/OverviewPage.tsx',
  `function signedPercentBps(value: number | null) {\n  if (value === null) return '暂无足够成交';\n  const sign = value > 0 ? '+' : value < 0 ? '−' : '';\n  return \`${'${sign}'}${'${(Math.abs(value) / 100).toFixed(1)}'}%\`;\n}\n\n`,
  '',
);
replaceOnce(
  'src/pages/OverviewPage.tsx',
  `  const now = useNow(game.lastProcessedAt);\n  const workRemaining = Math.max(0, game.work.cooldownUntil - now);`,
  `  const now = useNow(game.lastProcessedAt, 60_000);`,
);
replaceOnce('src/pages/OverviewPage.tsx', `  const productNames = useMemo(() => new Map(game.products.map((product) => [product.id, product.name])), [game.products]);\n`, '');
replaceOnce(
  'src/pages/OverviewPage.tsx',
  `              <Button\n                variant="secondary"\n                className="overview-work-button"\n                disabled={isWorking || workRemaining > 0}\n                onClick={() => void showResult(work())}\n              >\n                {isWorking ? '处理中…' : workRemaining > 0 ? formatDuration(workRemaining) : '开始工作'}\n              </Button>`,
  `              <OverviewWorkButton\n                referenceNow={game.lastProcessedAt}\n                cooldownUntil={game.work.cooldownUntil}\n                isWorking={isWorking}\n                onWork={() => void showResult(work())}\n              />`,
);
replaceBetween(
  'src/pages/OverviewPage.tsx',
  `<Panel className="widget overview-economic-calendar-panel">`,
  `<div className="overview-summary-row">`,
  `<OverviewEconomicCalendarPanel\n  events={economicEvents}\n  products={game.products}\n  markets={game.markets}\n  referenceNow={game.lastProcessedAt}\n/>\n\n<div className="overview-summary-row">`,
);

replaceOnce(
  'src/pages/MarketPage.tsx',
  `import { orderStatusNames, type LoadedGameViewModel } from '../app/gameViewModel';`,
  `import { getClientOrderIndex, openOrdersForAsset } from '../app/clientOrderIndex';\nimport { orderStatusNames, type LoadedGameViewModel } from '../app/gameViewModel';`,
);
replaceOnce(
  'src/pages/MarketPage.tsx',
  `  const selectedOrders = useMemo(() => game.orders.filter((order) => (\n    orderKind(order) === marketAssetKind\n    && orderAssetId(order) === assetId\n    && ['open', 'partial'].includes(order.status)\n  )), [assetId, game.orders, marketAssetKind]);\n  const ownSelectedOrders = useMemo(\n    () => selectedOrders.filter((order) => order.isOwn),\n    [selectedOrders],\n  );\n  const ownOpenOrders = useMemo(() => game.orders.filter((order) => (\n    order.isOwn && ['open', 'partial'].includes(order.status)\n  )), [game.orders]);`,
  `  const orderIndex = useMemo(() => getClientOrderIndex(game.orders), [game.orders]);\n  const selectedOrders = useMemo(\n    () => openOrdersForAsset(orderIndex, marketAssetKind, assetId),\n    [assetId, marketAssetKind, orderIndex],\n  );\n  const ownSelectedOrders = useMemo(\n    () => selectedOrders.filter((order) => order.isOwn),\n    [selectedOrders],\n  );\n  const ownOpenOrders = orderIndex.ownOpenOrders;`,
);

replaceOnce(
  'src/game-guide/useGameTutorial.ts',
  `import { subscribeStateAuthorityPartition } from '../app/stateDelivery.js';`,
  `import { subscribeStateAuthoritySlice } from '../app/stateDelivery.js';`,
);
replaceOnce(
  'src/game-guide/useGameTutorial.ts',
  `    return subscribeStateAuthorityPartition('player', confirmProduction);`,
  `    return subscribeStateAuthoritySlice('player.production', confirmProduction);`,
);

console.log('Phase 3 exact client transforms applied.');
