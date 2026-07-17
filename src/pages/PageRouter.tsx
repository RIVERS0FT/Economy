import { useEffect, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { AssetsPage } from './AssetsPage';
import { AuctionPage } from './AuctionPage';
import { CollectionsPage } from './CollectionsPage';
import { LeaderboardPage } from './LeaderboardPage';
import { MarketPage } from './MarketPage';
import { OverviewPage } from './OverviewPage';
import { ProductionPage } from './ProductionPage';
import { GemShopPage } from './GemShopPage';
import { SettingsPage } from './SettingsPage';

export function PageRouter({ model }: { model: LoadedGameViewModel }) {
  const [overviewProductId, setOverviewProductId] = useState(() => model.game.products[0]?.id ?? '');

  useEffect(() => {
    if (model.game.products.some((product) => product.id === overviewProductId)) return;
    setOverviewProductId(model.game.products[0]?.id ?? '');
  }, [model.game.products, overviewProductId]);

  switch (model.tab) {
    case 'market':
      return <MarketPage model={model} />;
    case 'production':
      return <ProductionPage model={model} />;
    case 'assets':
      return <AssetsPage model={model} />;
    case 'collections':
      return <CollectionsPage model={model} />;
    case 'auction':
      return <AuctionPage model={model} />;
    case 'leaderboard':
      return <LeaderboardPage model={model} />;
    case 'gem-shop':
      return <GemShopPage model={model} />;
    case 'settings':
      return <SettingsPage model={model} />;
    case 'home':
    default:
      return (
        <OverviewPage
          model={model}
          overviewProductId={overviewProductId}
          onOverviewProductChange={setOverviewProductId}
        />
      );
  }
}
