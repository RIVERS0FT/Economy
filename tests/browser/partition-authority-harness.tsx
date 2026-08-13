import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import {
  useGameAuthorityPartitions,
  useGameAuthorityState,
} from '../../src/app/gameAuthorityStore';
import { createStateDeliveryCache } from '../../src/app/stateDelivery.js';
import { CURRENT_CLIENT_STATE_VERSION } from '../../server/shared/economy-state-version.js';

const counts = {
  root: 0,
  market: 0,
  auction: 0,
  contract: 0,
  leaderboard: 0,
  status: 0,
};
let revision = 1;
const cache = createStateDeliveryCache();

cache.accept({
  revision,
  unchanged: false,
  serverNow: Date.now(),
  patches: {
    catalog: { version: CURRENT_CLIENT_STATE_VERSION },
    player: { userId: 1, credits: 100 },
    market: { orders: [] },
    auction: { assetAuctions: [] },
    contract: { productionContracts: [] },
    leaderboard: { leaderboard: [] },
  },
});

function RootAuthorityConsumer() {
  useGameAuthorityState();
  counts.root += 1;
  return <output data-testid="root-count">{counts.root}</output>;
}

function MarketConsumer() {
  useGameAuthorityPartitions(['catalog', 'player', 'market']);
  counts.market += 1;
  return <output data-testid="market-count">{counts.market}</output>;
}

function AuctionConsumer() {
  useGameAuthorityPartitions(['catalog', 'player', 'auction']);
  counts.auction += 1;
  return <output data-testid="auction-count">{counts.auction}</output>;
}

function ContractConsumer() {
  useGameAuthorityPartitions(['catalog', 'player', 'market', 'contract']);
  counts.contract += 1;
  return <output data-testid="contract-count">{counts.contract}</output>;
}

function LeaderboardConsumer() {
  useGameAuthorityPartitions(['catalog', 'player', 'leaderboard']);
  counts.leaderboard += 1;
  return <output data-testid="leaderboard-count">{counts.leaderboard}</output>;
}

function StatusConsumer() {
  useGameAuthorityPartitions(['player', 'leaderboard']);
  counts.status += 1;
  return <output data-testid="status-count">{counts.status}</output>;
}

function Harness() {
  return (
    <main>
      <RootAuthorityConsumer />
      <MarketConsumer />
      <AuctionConsumer />
      <ContractConsumer />
      <LeaderboardConsumer />
      <StatusConsumer />
    </main>
  );
}

function patch(name: 'player' | 'market' | 'auction' | 'contract' | 'leaderboard') {
  revision += 1;
  const patches = name === 'player'
    ? { player: { userId: 1, credits: 100 + revision } }
    : name === 'market'
      ? { market: { orders: [{ id: `order-${revision}` }] } }
      : name === 'auction'
        ? { auction: { assetAuctions: [{ id: `auction-${revision}` }] } }
        : name === 'contract'
          ? { contract: { productionContracts: [{ id: `contract-${revision}` }] } }
          : { leaderboard: { leaderboard: [{ rank: revision }] } };
  cache.accept({
    revision,
    unchanged: false,
    serverNow: Date.now(),
    patches,
  });
}

Object.assign(window, {
  __partitionAuthorityHarness: {
    counts: () => ({ ...counts }),
    patch,
  },
});

createRoot(document.getElementById('root') as HTMLElement).render(<Harness />);
