import type { LoadedGameViewModel } from '../app/gameViewModel';
import { AssetsPage } from './AssetsPage';
import { AuctionPage } from './AuctionPage';
import { CollectionsPage } from './CollectionsPage';
import { LeaderboardPage } from './LeaderboardPage';
import { MarketPage } from './MarketPage';
import { OverviewPage } from './OverviewPage';
import { ProductionPage } from './ProductionPage';
import { SettingsPage } from './SettingsPage';

export function PageRouter({ model }: { model: LoadedGameViewModel }) {
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
    case 'settings':
      return <SettingsPage model={model} />;
    case 'home':
    default:
      return <OverviewPage model={model} />;
  }
}
