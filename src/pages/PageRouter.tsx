import { lazy, Suspense } from 'react';
import { FacilityRecipeProfitMarketsProvider } from '../components/facilities/FacilityRecipeProfitContext';
import type { TabId } from '../config/navigation';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';

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

export function preloadPage(tab: TabId) {
  return pagePreloaders[tab]();
}

const AuctionPage = lazy(() => loadAuctionPage().then((module) => ({ default: module.AuctionPage })));
const BankPage = lazy(() => loadBankPage().then((module) => ({ default: module.BankPage })));
const ContractPage = lazy(() => loadContractPage().then((module) => ({ default: module.ContractPage })));
const LeaderboardPage = lazy(() => loadLeaderboardPage().then((module) => ({ default: module.LeaderboardPage })));
const MarketPage = lazy(() => loadMarketPage().then((module) => ({ default: module.MarketPage })));
const OverviewPage = lazy(() => loadOverviewPage().then((module) => ({ default: module.OverviewPage })));
const ProductionPage = lazy(() => loadProductionPage().then((module) => ({ default: module.ProductionPage })));
const ResearchPage = lazy(() => loadResearchPage().then((module) => ({ default: module.ResearchPage })));
const GemShopPage = lazy(() => loadGemShopPage().then((module) => ({ default: module.GemShopPage })));
const SettingsPage = lazy(() => loadSettingsPage().then((module) => ({ default: module.SettingsPage })));

export function PageRouter({ model }: { model: TutorialAwareGameViewModel }) {
  let page;
  switch (model.tab) {
    case 'market':
      page = <MarketPage model={model} />;
      break;
    case 'production':
      page = (
        <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>
          <ProductionPage model={model} />
        </FacilityRecipeProfitMarketsProvider>
      );
      break;
    case 'research':
      page = <ResearchPage model={model} />;
      break;
    case 'auction':
      page = <AuctionPage model={model} />;
      break;
    case 'contracts':
      page = <ContractPage model={model} />;
      break;
    case 'bank':
      page = <BankPage model={model} />;
      break;
    case 'leaderboard':
      page = <LeaderboardPage model={model} />;
      break;
    case 'gem-shop':
      page = <GemShopPage model={model} />;
      break;
    case 'settings':
      page = <SettingsPage model={model} />;
      break;
    case 'home':
    default:
      page = <OverviewPage model={model} />;
  }

  return <Suspense fallback={<div className="page-loading" role="status">正在加载页面…</div>}>{page}</Suspense>;
}
