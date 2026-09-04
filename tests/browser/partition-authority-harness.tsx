import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import {
  useGameAuthorityDependencies,
  useGameAuthorityState,
} from '../../src/app/gameAuthorityStore';
import { createStateDeliveryCache } from '../../src/app/stateDelivery.js';
import { CURRENT_CLIENT_STATE_VERSION } from '../../server/shared/economy-state-version.js';

const counts = {
  root: 0,
  market: 0,
  production: 0,
  bank: 0,
  status: 0,
  orders: 0,
  quotes: 0,
  calendar: 0,
  auction: 0,
  contract: 0,
  leaderboard: 0,
};
let revision = 1;
const cache = createStateDeliveryCache();
const sliceRevisions: Record<string, string> = {
  'player.identity': 'player-identity-0001',
  'player.assets': 'player-assets-0001',
  'player.production': 'player-production-0001',
  'player.progression': 'player-progress-0001',
  'player.bank': 'player-bank-0001',
  'player.stats': 'player-stats-0001',
  'player.misc': 'player-misc-0001',
  'market.orders': 'market-orders-0001',
  'market.quotes': 'market-quotes-0001',
  'market.calendar': 'market-calendar-0001',
  'market.misc': 'market-misc-0001',
};
let rootAuthorityState: ReturnType<typeof useGameAuthorityState> = null;

cache.accept({
  revision,
  unchanged: false,
  serverNow: Date.now(),
  sliceRevisions: { ...sliceRevisions },
  patches: {
    catalog: {
      version: CURRENT_CLIENT_STATE_VERSION,
      products: [{ id: 'wheat', name: '小麦', category: 'raw', basePrice: 1 }],
      facilityTypes: [{
        id: 'farm',
        name: '农场',
        category: 'raw',
        complexity: 'C1',
        buildCost: 100,
        buildTimeMs: 0,
        cycleMs: 1_000,
        operatingCost: 1,
        inputs: [],
        output: { productId: 'wheat', quantity: 1 },
        defaultRecipeId: 'farm-standard',
        recipes: [{
          id: 'farm-standard',
          name: '标准',
          cycleMs: 1_000,
          operatingCost: 1,
          inputs: [],
          output: { productId: 'wheat', quantity: 1 },
        }],
        systemValue: 100,
      }],
      commercialBuildingTypes: [{ id: 'convenience-store', name: '便利店' }],
      researchLevels: [{ id: 'C1', rank: 1, cost: 0, durationMs: 0 }],
      provinces: [{
        id: '110000',
        name: '加利福尼亚州',
        shortName: 'CA',
        mapName: 'California',
        longitude: -119.4179,
        latitude: 36.7783,
      }],
      defaultProvinceId: '110000',
    },
    player: {
      userId: 1,
      playerName: 'Slice Tester',
      credits: 100,
      facilityGroups: [],
      bankAccount: {},
    },
    market: { orders: [], markets: {}, economicCalendar: { version: 2, events: [] } },
    auction: { assetAuctions: [] },
    contract: { productionContracts: [] },
    leaderboard: { leaderboard: [] },
  },
});

function RootAuthorityConsumer() {
  rootAuthorityState = useGameAuthorityState();
  counts.root += 1;
  return <output data-testid="root-count">{counts.root}</output>;
}

function MarketConsumer() {
  useGameAuthorityDependencies(['catalog', 'player.assets', 'player.production', 'market.orders', 'market.quotes']);
  counts.market += 1;
  return <output>{counts.market}</output>;
}

function ProductionConsumer() {
  useGameAuthorityDependencies(['catalog', 'player.assets', 'player.production', 'market.orders', 'market.quotes', 'contract']);
  counts.production += 1;
  return <output>{counts.production}</output>;
}

function BankConsumer() {
  useGameAuthorityDependencies(['catalog', 'player.assets', 'player.production', 'player.bank']);
  counts.bank += 1;
  return <output>{counts.bank}</output>;
}

function StatusConsumer() {
  useGameAuthorityDependencies(['player.identity', 'player.assets', 'leaderboard']);
  counts.status += 1;
  return <output>{counts.status}</output>;
}

function OrderConsumer() {
  useGameAuthorityDependencies(['market.orders']);
  counts.orders += 1;
  return <output>{counts.orders}</output>;
}

function QuoteConsumer() {
  useGameAuthorityDependencies(['market.quotes']);
  counts.quotes += 1;
  return <output>{counts.quotes}</output>;
}

function CalendarConsumer() {
  useGameAuthorityDependencies(['market.calendar']);
  counts.calendar += 1;
  return <output>{counts.calendar}</output>;
}

function AuctionConsumer() {
  useGameAuthorityDependencies(['auction']);
  counts.auction += 1;
  return <output>{counts.auction}</output>;
}

function ContractConsumer() {
  useGameAuthorityDependencies(['contract']);
  counts.contract += 1;
  return <output>{counts.contract}</output>;
}

function LeaderboardConsumer() {
  useGameAuthorityDependencies(['leaderboard']);
  counts.leaderboard += 1;
  return <output>{counts.leaderboard}</output>;
}

function Harness() {
  return (
    <main>
      <RootAuthorityConsumer />
      <MarketConsumer />
      <ProductionConsumer />
      <BankConsumer />
      <StatusConsumer />
      <OrderConsumer />
      <QuoteConsumer />
      <CalendarConsumer />
      <AuctionConsumer />
      <ContractConsumer />
      <LeaderboardConsumer />
    </main>
  );
}

type PatchName =
  | 'playerAssets'
  | 'playerBank'
  | 'playerProduction'
  | 'marketOrders'
  | 'marketQuotes'
  | 'marketCalendar'
  | 'auction'
  | 'contract'
  | 'leaderboard';

function bumpSlice(name: string) {
  sliceRevisions[name] = `${name.replace('.', '-')}-${String(revision).padStart(4, '0')}`;
}

function patch(name: PatchName) {
  revision += 1;
  let patches: any;
  if (name === 'playerAssets') {
    bumpSlice('player.assets');
    patches = { player: { credits: 100 + revision } };
  } else if (name === 'playerBank') {
    bumpSlice('player.bank');
    patches = { player: { bankAccount: { revision } } };
  } else if (name === 'playerProduction') {
    bumpSlice('player.production');
    patches = { player: { facilityGroups: [{ facilityTypeId: 'farm', count: revision }] } };
  } else if (name === 'marketOrders') {
    bumpSlice('market.orders');
    patches = { market: { orders: [{ id: `order-${revision}` }] } };
  } else if (name === 'marketQuotes') {
    bumpSlice('market.quotes');
    patches = { market: { markets: { wheat: { lastPrice: revision } } } };
  } else if (name === 'marketCalendar') {
    bumpSlice('market.calendar');
    patches = { market: { economicCalendar: { version: 2, events: [{ id: `event-${revision}` }] } } };
  } else if (name === 'auction') {
    patches = { auction: { assetAuctions: [{ id: `auction-${revision}` }] } };
  } else if (name === 'contract') {
    patches = { contract: { productionContracts: [{ id: `contract-${revision}` }] } };
  } else {
    patches = { leaderboard: { leaderboard: [{ rank: revision }] } };
  }
  cache.accept({
    revision,
    unchanged: false,
    serverNow: Date.now(),
    sliceRevisions: { ...sliceRevisions },
    patches,
  });
}

function capturedRootSnapshotSurvivesReset() {
  const captured = rootAuthorityState;
  if (!captured) return false;
  cache.reset();
  return Array.isArray(captured.provinces)
    && captured.provinces.some((province) => province.id === '110000');
}

Object.assign(window, {
  __partitionAuthorityHarness: {
    counts: () => ({ ...counts }),
    patch,
    capturedRootSnapshotSurvivesReset,
  },
});

createRoot(document.getElementById('root') as HTMLElement).render(<Harness />);
