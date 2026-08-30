import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createWorld,
  ensurePlayer,
  FACILITY_TYPE_CATALOG,
} from '../server/src/domain.js';
import { createAssetAuctionClientState } from '../server/src/asset-auctions.js';
import { createBankClientState } from '../server/src/banking.js';
import { createProductionContractClientState } from '../server/src/contracts.js';
import { createDailyCheckInSummary, dailyCheckInPeriodFor } from '../server/src/daily-check-in.js';
import { createEconomicCalendarClientState } from '../server/src/economic-events.js';
import {
  createFacilityGroupClientState,
  migrateFacilityGroupWorld,
} from '../server/src/facility-groups.js';
import { createLeaderboardSnapshot } from '../server/src/leaderboards.js';
import {
  inventoryForProvince,
  PROVINCE_CATALOG,
  provinceScopedKey,
} from '../server/src/provinces.js';
import { createResearchClientState, RESEARCH_TECHNOLOGY_CATALOG } from '../server/src/research.js';
import { createWarehouseSummaryReadOnly } from '../server/src/warehouse.js';
import { CURRENT_CLIENT_STATE_VERSION } from '../server/shared/economy-state-version.js';

export const LOCAL_GAME_PREVIEW_GENERATED_AT = Date.UTC(2026, 7, 15, 4, 0, 0);
const DEFAULT_PROVINCE_ID = '110000';
const OUTPUT_PATH = resolve('src/dev/generated/local-game-preview-state.json');

function facilityGroup(facilityTypeId, count, now, overrides = {}) {
  const facility = FACILITY_TYPE_CATALOG.find((candidate) => candidate.id === facilityTypeId);
  if (!facility) throw new Error(`Unknown facility type: ${facilityTypeId}`);
  return {
    facilityTypeId,
    provinceId: DEFAULT_PROVINCE_ID,
    count,
    participatingCount: count,
    enabled: true,
    status: 'running',
    statusReason: undefined,
    activeRecipeId: facility.defaultRecipeId,
    lifetimeOutput: count * 380,
    cycleStartedAt: now - Math.floor(facility.cycleMs / 2),
    staffingRateBps: 9_200,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 0,
    ...overrides,
  };
}

function installInventory(player, entries) {
  for (const [productId, available, frozen = 0] of entries) {
    const inventory = inventoryForProvince(player, productId, DEFAULT_PROVINCE_ID);
    inventory.available = available;
    inventory.frozen = frozen;
  }
}

function installMarketHistory(world, productId, lastPrice, now) {
  const market = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, productId)];
  if (!market) throw new Error(`Missing preview market: ${productId}`);
  market.lastPrice = lastPrice;
  market.lastTradePrice = lastPrice;
  market.priceHistory = Array.from({ length: 12 }, (_, index) => ({
    price: Math.round((lastPrice * (0.94 + index * 0.01)) * 100) / 100,
    quantity: 12 + index * 3,
    createdAt: now - (11 - index) * 2 * 60 * 60_000,
    takerSide: index % 2 === 0 ? 'buy' : 'sell',
  }));
}

function clientState(world, player, checkIn, now) {
  const projected = createFacilityGroupClientState(world, player.userId, now);
  const {
    trades: _serverTrades,
    ledger: _serverLedger,
    assetEvents: _serverAssetEvents,
    ...authoritativeState
  } = projected;
  return {
    ...authoritativeState,
    saveEpoch: 1,
    stats: {
      ...authoritativeState.stats,
      leaderboards: { ...createLeaderboardSnapshot(world, player.userId, now), generatedAt: now },
    },
    gems: player.gems,
    checkIn,
    ...createWarehouseSummaryReadOnly(player),
    ...createAssetAuctionClientState(world, player.userId, now),
    ...createBankClientState(world, player, now),
    ...createResearchClientState(world, player),
    ...createProductionContractClientState(world, player.userId, now),
    economicCalendar: createEconomicCalendarClientState(now),
    version: CURRENT_CLIENT_STATE_VERSION,
  };
}

function compactProvinceState(state) {
  const populatedProvinceIds = new Set(
    Object.entries(state.provinceAssetSummaries)
      .filter(([, summary]) => summary.storedQuantity > 0 || summary.facilityCount > 0 || summary.openOrderCount > 0)
      .map(([provinceId]) => provinceId),
  );
  populatedProvinceIds.add(state.defaultProvinceId);

  state.provinceInventories = Object.fromEntries(
    state.provinces.map((province) => [
      province.id,
      populatedProvinceIds.has(province.id) ? state.provinceInventories[province.id] || {} : {},
    ]),
  );
  state.provinceMarkets = Object.fromEntries(
    [...populatedProvinceIds].map((provinceId) => [provinceId, state.provinceMarkets[provinceId] || {}]),
  );
  state.provinceFacilityMarkets = Object.fromEntries(
    [...populatedProvinceIds].map((provinceId) => [provinceId, state.provinceFacilityMarkets[provinceId] || {}]),
  );
  state.provinceFacilityGroups = Object.fromEntries(
    [...populatedProvinceIds].map((provinceId) => [provinceId, state.provinceFacilityGroups[provinceId] || []]),
  );
  return state;
}

export function buildLocalGamePreviewFixture() {
  const now = LOCAL_GAME_PREVIEW_GENERATED_AT;
  const world = createWorld(now);
  world.orders = [];
  world.facilityListings = [];

  const previewUser = { id: 90_001, email: 'preview@local.invalid', name: '本地预览玩家' };
  const previewPlayer = ensurePlayer(world, previewUser, now);
  previewPlayer.registeredAt = now - 96 * 86_400_000;
  previewPlayer.credits = 128_600;
  previewPlayer.frozenCredits = 1_280;
  previewPlayer.gems = 36;
  previewPlayer.work = {
    cooldownUntil: 0,
    lastWorkedAt: now - 45_000,
    streak: 7,
    totalClicks: 128,
  };
  Object.assign(previewPlayer.stats, {
    producedGoods: 4_820,
    boughtGoods: 1_640,
    soldGoods: 1_290,
    commodityVolume: 86_400,
    facilityVolume: 12_800,
    invitationGemsIssued: 15,
  });
  previewPlayer.facilityGroups = [
    facilityGroup('farm', 12, now),
    facilityGroup('orchard', 6, now),
    facilityGroup('mine', 5, now),
    facilityGroup('mill', 4, now),
    facilityGroup('steelworks', 3, now, {
      participatingCount: 0,
      status: 'error',
      statusReason: 'insufficient_input',
      cycleStartedAt: undefined,
    }),
    facilityGroup('textile-mill', 3, now),
  ];
  installInventory(previewPlayer, [
    ['wheat', 860, 80],
    ['rice', 520, 0],
    ['fruit', 310, 0],
    ['ore', 420, 25],
    ['steel', 160, 0],
    ['flour', 280, 0],
    ['cotton', 190, 0],
    ['textile', 96, 0],
    ['tools', 48, 0],
    ['machinery', 18, 0],
  ]);

  const completedTechnologies = RESEARCH_TECHNOLOGY_CATALOG
    .filter((technology) => technology.initial || technology.rank <= 3)
    .map((technology) => technology.id);
  const activeTechnology = RESEARCH_TECHNOLOGY_CATALOG.find((technology) => (
    technology.rank === 4 && !completedTechnologies.includes(technology.id)
  ));
  previewPlayer.research = {
    unlockedComplexity: 'C3',
    completedTechnologyIds: completedTechnologies,
    completedAtByTechnologyId: Object.fromEntries(
      completedTechnologies.map((technologyId, index) => [technologyId, now - (index + 2) * 86_400_000]),
    ),
    completedAt: now - 2 * 86_400_000,
    active: activeTechnology ? {
      technologyId: activeTechnology.id,
      technologyName: activeTechnology.name,
      targetComplexity: activeTechnology.stage,
      startedAt: now - Math.floor(activeTechnology.durationMs / 2),
      completesAt: now + Math.ceil(activeTechnology.durationMs / 2),
      durationMs: activeTechnology.durationMs,
      cost: activeTechnology.cost,
      employmentReleased: Math.floor(activeTechnology.cost / 2),
    } : null,
  };
  previewPlayer.bankAccount = {
    depositCredits: 28_000,
    dayOpeningDepositCredits: 28_000,
    dayMinimumDepositCredits: 28_000,
    depositInterestCarryMicros: 0,
    totalDepositInterestEarned: 640,
    lastDepositInterestEarned: 24,
    repaidLoanCount: 2,
    lastDefaultAt: null,
    activeLoan: null,
    recentTransactions: [
      { id: 'preview-bank-2', type: 'interest', amount: 24, createdAt: now - 12 * 60 * 60_000, description: '每日存款利息' },
      { id: 'preview-bank-1', type: 'deposit', amount: 8_000, createdAt: now - 3 * 86_400_000, description: '存入资金' },
    ],
  };

  const atlas = ensurePlayer(world, { id: 90_002, email: 'atlas@local.invalid', name: 'Atlas 集团' }, now);
  atlas.credits = 186_000;
  atlas.gems = 12;
  atlas.facilityGroups = [facilityGroup('farm', 24, now)];
  const riversoft = ensurePlayer(world, { id: 90_003, email: 'industry@local.invalid', name: 'Riversoft 实业' }, now);
  riversoft.credits = 82_400;
  riversoft.gems = 8;
  riversoft.facilityGroups = [facilityGroup('orchard', 8, now)];

  migrateFacilityGroupWorld(world, now);
  for (const [productId, price] of [
    ['wheat', 3.4],
    ['rice', 4.2],
    ['ore', 9.8],
    ['steel', 22.6],
    ['textile', 18.4],
  ]) installMarketHistory(world, productId, price, now);

  world.orders = [
    {
      id: 'preview-own-buy-wheat',
      assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', provinceId: DEFAULT_PROVINCE_ID,
      ownerType: 'player', ownerId: previewUser.id, ownerName: previewUser.name,
      side: 'buy', price: 3.25, quantity: 200, remaining: 120, fills: [], status: 'partial', createdAt: now - 38 * 60_000,
    },
    {
      id: 'preview-market-sell-wheat',
      assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', provinceId: DEFAULT_PROVINCE_ID,
      ownerType: 'player', ownerId: atlas.userId, ownerName: atlas.playerName,
      side: 'sell', price: 3.5, quantity: 260, remaining: 260, fills: [], status: 'open', createdAt: now - 22 * 60_000,
    },
    {
      id: 'preview-market-buy-steel',
      assetKind: 'commodity', assetId: 'steel', productId: 'steel', provinceId: DEFAULT_PROVINCE_ID,
      ownerType: 'player', ownerId: riversoft.userId, ownerName: riversoft.playerName,
      side: 'buy', price: 22.1, quantity: 80, remaining: 80, fills: [], status: 'open', createdAt: now - 16 * 60_000,
    },
  ];

  const checkInPeriod = dailyCheckInPeriodFor(now);
  const checkInRows = checkInPeriod.dateKeys.slice(0, 4).map((dateKey) => ({
    date_key: dateKey,
    weekly_bonus_gems: 0,
  }));
  const checkIn = createDailyCheckInSummary(previewPlayer, checkInRows, now);
  const state = compactProvinceState(clientState(world, previewPlayer, checkIn, now));
  return { generatedAt: now, state };
}

export function serializedLocalGamePreviewFixture() {
  return `${JSON.stringify(buildLocalGamePreviewFixture(), null, 2)}\n`;
}

function normalizeProvinceDisplayNames(serialized) {
  const fixture = JSON.parse(serialized);
  if (!Array.isArray(fixture?.state?.provinces)) return serialized;
  const canonicalNameById = new Map(PROVINCE_CATALOG.map((province) => [province.id, province.name]));
  fixture.state.provinces = fixture.state.provinces.map((province) => ({
    ...province,
    name: canonicalNameById.get(province.id) || province.name,
  }));
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

export function verifyLocalGamePreviewFixture() {
  const expected = serializedLocalGamePreviewFixture();
  if (!existsSync(OUTPUT_PATH)) throw new Error(`缺少本地免登录游戏快照：${OUTPUT_PATH}`);
  const actual = readFileSync(OUTPUT_PATH, 'utf8');
  if (normalizeProvinceDisplayNames(actual) !== expected) {
    throw new Error('本地免登录游戏快照已过期，请运行 npm run generate:local-preview');
  }
}

function writeFixture() {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serializedLocalGamePreviewFixture(), 'utf8');
  console.log(`Generated ${OUTPUT_PATH}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) writeFixture();
