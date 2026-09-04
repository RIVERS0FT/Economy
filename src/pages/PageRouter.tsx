import { lazy, Suspense, type ReactNode } from 'react';
import { useGameAuthorityDependencies } from '../app/gameAuthorityStore';
import type { StateAuthorityDependency } from '../app/stateDelivery.js';
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
const loadGlobalMarketPage = cachedLoader(() => import('./GlobalMarketPage'));
const loadMapPage = cachedLoader(() => import('./MapPage'));
const loadOverviewPage = cachedLoader(() => import('./OverviewPage'));
const loadProvincePage = cachedLoader(() => import('./ProvincePage'));
const loadGlobalBuildingsPage = cachedLoader(() => import('./GlobalBuildingsPage'));
const loadTransportPage = cachedLoader(() => import('./TransportPage'));
const loadResearchPage = cachedLoader(() => import('./ResearchPage'));
const loadGemShopPage = cachedLoader(() => import('./GemShopPage'));
const loadSettingsPage = cachedLoader(() => import('./SettingsPage'));

const pagePreloaders: Record<TabId, () => Promise<unknown>> = {
  home: loadOverviewPage,
  map: loadMapPage,
  province: loadProvincePage,
  market: loadGlobalMarketPage,
  buildings: loadGlobalBuildingsPage,
  transport: loadTransportPage,
  research: loadResearchPage,
  auction: loadAuctionPage,
  contracts: loadContractPage,
  bank: loadBankPage,
  leaderboard: loadLeaderboardPage,
  'gem-shop': loadGemShopPage,
  settings: loadSettingsPage,
};

const PAGE_AUTHORITY_DEPENDENCIES: Record<TabId, readonly StateAuthorityDependency[]> = {
  home: [
    'catalog',
    'player.identity',
    'player.assets',
    'player.production',
    'player.progression',
  ],
  map: ['catalog', 'player.assets', 'player.production', 'market.orders', 'market.quotes'],
  province: ['catalog', 'player.assets', 'player.production', 'market.orders', 'market.quotes'],
  market: ['catalog', 'player.assets', 'player.production', 'market.orders', 'market.quotes'],
  buildings: [
    'catalog',
    'player.assets',
    'player.production',
    'player.progression',
    'market.orders',
    'market.quotes',
    'contract',
  ],
  transport: ['catalog', 'player.assets', 'player.misc', 'market.quotes'],
  research: ['catalog', 'player.assets', 'player.production', 'player.progression', 'market.quotes'],
  auction: ['catalog', 'player.assets', 'player.production', 'auction'],
  contracts: ['catalog', 'player.assets', 'player.production', 'market.quotes', 'contract'],
  bank: ['catalog', 'player.assets', 'player.production', 'player.bank'],
  leaderboard: ['catalog', 'player.identity', 'player.assets', 'leaderboard'],
  'gem-shop': ['catalog', 'player.assets'],
  settings: ['catalog', 'player.identity', 'player.assets', 'player.stats'],
};

export function preloadPage(tab: TabId) {
  return pagePreloaders[tab]();
}

const AuctionPage = lazy(() => import('./AuctionPage').then((module) => ({ default: module.AuctionPage })));
const BankPage = lazy(() => import('./BankPage').then((module) => ({ default: module.BankPage })));
const ContractPage = lazy(() => import('./ContractPage').then((module) => ({ default: module.ContractPage })));
const LeaderboardPage = lazy(() => import('./LeaderboardPage').then((module) => ({ default: module.LeaderboardPage })));
const GlobalMarketPage = lazy(() => import('./GlobalMarketPage').then((module) => ({ default: module.GlobalMarketPage })));
const MapPage = lazy(() => import('./MapPage').then((module) => ({ default: module.MapPage })));
const OverviewPage = lazy(() => import('./OverviewPage').then((module) => ({ default: module.OverviewPage })));
const ProvincePage = lazy(() => import('./ProvincePage').then((module) => ({ default: module.ProvincePage })));
const GlobalBuildingsPage = lazy(() => import('./GlobalBuildingsPage').then((module) => ({ default: module.GlobalBuildingsPage })));
const TransportPage = lazy(() => import('./TransportPage').then((module) => ({ default: module.TransportPage })));
const ResearchPage = lazy(() => import('./ResearchPage').then((module) => ({ default: module.ResearchPage })));
const GemShopPage = lazy(() => import('./GemShopPage').then((module) => ({ default: module.GemShopPage })));
const SettingsPage = lazy(() => import('./SettingsPage').then((module) => ({ default: module.SettingsPage })));

function AuthorityPageBoundary({
  model,
  dependencies,
  render,
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  dependencies: readonly StateAuthorityDependency[];
  render: () => ReactNode;
}) {
  useGameAuthorityDependencies(dependencies);
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
    case 'map':
      renderPage = () => <MapPage model={model} />;
      break;
    case 'province':
      renderPage = () => <ProvincePage model={model} />;
      break;
    case 'market':
      renderPage = () => <GlobalMarketPage model={model} />;
      break;
    case 'buildings':
      renderPage = () => (
        <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>
          <GlobalBuildingsPage model={model} />
        </FacilityRecipeProfitMarketsProvider>
      );
      break;
    case 'transport':
      renderPage = () => <TransportPage model={model} />;
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
    <Suspense fallback={<div className="page-content page-loading" role="status">正在加载页面…</div>}>
      <AuthorityPageBoundary
        key={tab}
        model={model}
        dependencies={PAGE_AUTHORITY_DEPENDENCIES[tab]}
        render={renderPage}
      />
    </Suspense>
  );
}
