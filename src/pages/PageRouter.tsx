import { lazy, Suspense } from 'react';
import { FacilityRecipeProfitMarketsProvider } from '../components/facilities/FacilityRecipeProfitContext';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';

const AuctionPage = lazy(() => import('./AuctionPage').then((module) => ({ default: module.AuctionPage })));
const BankPage = lazy(() => import('./BankPage').then((module) => ({ default: module.BankPage })));
const ContractPage = lazy(() => import('./ContractPage').then((module) => ({ default: module.ContractPage })));
const LeaderboardPage = lazy(() => import('./LeaderboardPage').then((module) => ({ default: module.LeaderboardPage })));
const MarketPage = lazy(() => import('./MarketPage').then((module) => ({ default: module.MarketPage })));
const OverviewPage = lazy(() => import('./OverviewPage').then((module) => ({ default: module.OverviewPage })));
const ProductionPage = lazy(() => import('./ProductionPageRoute').then((module) => ({ default: module.ProductionPageRoute })));
const GemShopPage = lazy(() => import('./GemShopPage').then((module) => ({ default: module.GemShopPage })));
const SettingsPage = lazy(() => import('./SettingsPage').then((module) => ({ default: module.SettingsPage })));

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
