import { lazy, Suspense, useEffect, useState } from 'react';
import { FacilityRecipeProfitMarketsProvider } from '../components/facilities/FacilityRecipeProfitContext';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';

const AssetsPage = lazy(() => import('./AssetsPage').then((module) => ({ default: module.AssetsPage })));
const AuctionPage = lazy(() => import('./AuctionPage').then((module) => ({ default: module.AuctionPage })));
const CollectionsPage = lazy(() => import('./CollectionsPage').then((module) => ({ default: module.CollectionsPage })));
const LeaderboardPage = lazy(() => import('./LeaderboardPage').then((module) => ({ default: module.LeaderboardPage })));
const MarketPage = lazy(() => import('./MarketPage').then((module) => ({ default: module.MarketPage })));
const OverviewPage = lazy(() => import('./OverviewPage').then((module) => ({ default: module.OverviewPage })));
const ProductionPage = lazy(() => import('./ProductionPage').then((module) => ({ default: module.ProductionPage })));
const GemShopPage = lazy(() => import('./GemShopPage').then((module) => ({ default: module.GemShopPage })));
const SettingsPage = lazy(() => import('./SettingsPage').then((module) => ({ default: module.SettingsPage })));

export function PageRouter({ model }: { model: TutorialAwareGameViewModel }) {
  const [overviewProductId, setOverviewProductId] = useState(() => model.game.products[0]?.id ?? '');

  useEffect(() => {
    if (model.game.products.some((product) => product.id === overviewProductId)) return;
    setOverviewProductId(model.game.products[0]?.id ?? '');
  }, [model.game.products, overviewProductId]);

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
    case 'assets':
      page = <AssetsPage model={model} />;
      break;
    case 'collections':
      page = <CollectionsPage model={model} />;
      break;
    case 'auction':
      page = <AuctionPage model={model} />;
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
      page = (
        <OverviewPage
          model={model}
          overviewProductId={overviewProductId}
          onOverviewProductChange={setOverviewProductId}
        />
      );
  }

  return <Suspense fallback={<div className="page-loading" role="status">正在加载页面…</div>}>{page}</Suspense>;
}
