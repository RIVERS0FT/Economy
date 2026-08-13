import { lazy, Suspense, type ReactNode } from 'react';
import { useGameAuthorityPartitions } from '../app/gameAuthorityStore';
import type { StatePartitionName } from '../app/stateDelivery.js';
import { FacilityRecipeProfitMarketsProvider } from '../components/facilities/FacilityRecipeProfitContext';
import { FacilitySelectAvailabilityScope } from '../components/facilities/FacilitySelectAvailabilityScope';
import type { TabId } from '../config/navigation';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';

function cachedLoader<T>(loader: () => Promise<T>) {
  let promise: Promise<T> | null = null;
  return () => {
    promise ??= loader();
    return promise;
  };
}

const loadAuctionPage = cachedLoader(() => import('./AuctionPage'));
const loadBankPage = cachedLoader(() => import('./BankPage'));
const loadContractPage = cachedLoader(() => import('./ContractPage'));
const loadLeaderboardPage = cachedLoader(() => import('./LeaderboardPage'));
const loadMarketPage = cachedLoader(() => import('./MarketPage'));
const loadOverviewPage = cachedLoader(() => import('./OverviewPage'));
const loadProductionPage = cachedLoader(() => import('./ProductionPage'));
const loadResearchPage = cachedLoader(() => import('./ResearchPage'));
const loadGemShopPage = cachedLoader(() => import('./GemShopPage'));
const loadSettingsPage = cachedLoader(() => import('./SettingsPage'));

const pagePreloaders: Record<TabId, () => Promise<unknown>> = {
  home: loadOverviewPage,
  market: loadMarketPage,
  production: loadProductionPage,
  research: loadResearchPage,
  auction: loadAuctionPage,
  contracts: loadContractPage,
  bank: loadBankPage,
  leaderboard: loadLeaderboardPage,
  'gem-shop': loadGemShopPage,
  settings: loadSettingsPage,
};

const PAGE_AUTHORITY_PARTITIONS: Record<TabId, readonly StatePartitionName[]> = {
  home: ['catalog', 'player', 'market'],
  market: ['catalog', 'player', 'market'],
  production: ['catalog', 'player', 'market', 'contract'],
  research: ['catalog', 'player'],
  auction: ['catalog', 'player', 'auction'],
  contracts: ['catalog', 'player', 'market', 'contract'],
  bank: ['catalog', 'player'],
  leaderboard: ['catalog', 'player', 'leaderboard'],
  'gem-shop': ['catalog', 'player'],
  settings: ['catalog', 'player'],
};

export function preloadPage(tab: TabId) {
  return pagePreloaders[tab]();
}

const AuctionPage = lazy(() => import('./AuctionPage').then((module) => ({ default: module.AuctionPage })));
const BankPage = lazy(() => import('./BankPage').then((module) => ({ default: module.BankPage })));
const ContractPage = lazy(() => import('./ContractPage').then((module) => ({ default: module.ContractPage })));
const LeaderboardPage = lazy(() => import('./LeaderboardPage').then((module) => ({ default: module.LeaderboardPage })));
const MarketPage = lazy(() => import('./MarketPage').then((module) => ({ default: module.MarketPage })));
const OverviewPage = lazy(() => import('./OverviewPage').then((module) => ({ default: module.OverviewPage })));
const ProductionPage = lazy(() => import('./ProductionPage').then((module) => ({ default: module.ProductionPage })));
const ResearchPage = lazy(() => import('./ResearchPage').then((module) => ({ default: module.ResearchPage })));
const GemShopPage = lazy(() => import('./GemShopPage').then((module) => ({ default: module.GemShopPage })));
const SettingsPage = lazy(() => import('./SettingsPage').then((module) => ({ default: module.SettingsPage })));

function AuthorityPageBoundary({
  model,
  partitions,
  render,
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  partitions: readonly StatePartitionName[];
  render: () => ReactNode;
}) {
  useGameAuthorityPartitions(partitions);
  return (
    <FacilitySelectAvailabilityScope game={model.game}>
      {render()}
    </FacilitySelectAvailabilityScope>
  );
}

export function PageRouter({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const tab = model.tab;
  let renderPage: () => ReactNode;
  switch (tab) {
    case 'market':
      renderPage = () => <MarketPage model={model} />;
      break;
    case 'production':
      renderPage = () => (
        <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>
          <ProductionPage model={model} />
        </FacilityRecipeProfitMarketsProvider>
      );
      break;
    case 'research':
      renderPage = () => <ResearchPage model={model} />;
      break;
    case 'auction':
      renderPage = () => <AuctionPage model={model} />;
      break;
    case 'contracts':
      renderPage = () => <ContractPage model={model} />;
      break;
    case 'bank':
      renderPage = () => <BankPage model={model} />;
      break;
    case 'leaderboard':
      renderPage = () => <LeaderboardPage model={model} />;
      break;
    case 'gem-shop':
      renderPage = () => <GemShopPage model={model} />;
      break;
    case 'settings':
      renderPage = () => <SettingsPage model={model} />;
      break;
    case 'home':
    default:
      renderPage = () => <OverviewPage model={model} />;
  }

  return (
    <Suspense fallback={<div className="page-loading" role="status">正在加载页面…</div>}>
      <AuthorityPageBoundary
        key={tab}
        model={model}
        partitions={PAGE_AUTHORITY_PARTITIONS[tab]}
        render={renderPage}
      />
    </Suspense>
  );
}
