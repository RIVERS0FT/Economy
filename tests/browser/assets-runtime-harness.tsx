import { createRoot } from 'react-dom/client';
import type { LoadedGameViewModel } from '../../src/app/gameViewModel';
import { AssetsPage } from '../../src/pages/AssetsPage';
import '../../src/styles/globals.css';
import '../../src/styles/card-system.css';
import '../../src/styles/icon-system.css';
import '../../src/styles/market-funds.css';
import '../../src/styles/assets.css';
import '../../src/styles/virtual-list.css';
import '../../src/styles/design-system.css';

const fixedNow = new Date(2026, 6, 19, 18, 0, 0).getTime();
document.documentElement.dataset.appSurface = 'game';

const model = {
  game: {
    credits: 1_200,
    frozenCredits: 300,
    inventories: {
      wheat: { available: 5, frozen: 2 },
    },
    facilityGroups: [{
      facilityTypeId: 'farm',
      count: 4,
      frozenCount: 1,
    }],
    assetSummary: {
      cashValue: 1_500,
      commodityValue: 2_500,
      facilityValue: 3_200,
      totalAssets: 7_200,
      availableAssetValue: 6_200,
      frozenAssetValue: 1_000,
      availableCommodityValue: 2_000,
      frozenCommodityValue: 500,
      availableFacilityValue: 3_000,
      frozenFacilityValue: 200,
    },
    products: [{
      id: 'wheat',
      name: '小麦',
      category: 'raw',
      basePrice: 2,
    }],
  },
  derived: {
    cashValue: 1_500,
    commodityValue: 2_500,
    facilityValue: 3_200,
    totalAssets: 7_200,
  },
  localAssetEvents: [],
  clearLocalActivity: () => {},
  cashShare: 21,
  commodityShare: 35,
  facilityShare: 44,
  allocationStyle: {
    background: 'conic-gradient(var(--color-success) 0 21%, var(--color-warning) 21% 56%, var(--color-info) 56% 100%)',
  },
  now: fixedNow,
} as unknown as LoadedGameViewModel;

createRoot(document.getElementById('root') as HTMLElement).render(<AssetsPage model={model} />);
