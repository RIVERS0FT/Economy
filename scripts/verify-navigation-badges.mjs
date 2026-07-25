import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildNavigationBadges,
  createNavigationBadgeBaseline,
  formatNavigationBadgeCount,
  markNavigationBadgeTabRead,
} from '../src/navigation/navigationBadges.ts';

function gameFixture() {
  return {
    version: 19,
    userId: 7,
    playerName: '测试玩家',
    registeredAt: 0,
    credits: 100,
    frozenCredits: 0,
    gems: 0,
    inventories: {},
    inventoryCapacity: 100,
    warehouseLevel: 1,
    warehouseUpgradeCost: 100,
    warehouseNextCapacity: 200,
    warehouseNextCapacityIncrease: 100,
    warehouseStoredQuantity: 0,
    warehouseReservedQuantity: 0,
    warehouseUsedCapacity: 0,
    warehouseAvailableCapacity: 100,
    facilityGroups: [],
    products: [],
    facilityTypes: [],
    markets: {},
    facilityMarkets: {},
    orders: [],
    facilityListings: [],
    valuationPrices: {},
    assetSummary: { cashValue: 100, commodityValue: 0, facilityValue: 0, totalAssets: 100 },
    work: { cooldownUntil: 0, lastWorkedAt: 0, streak: 0, totalClicks: 0 },
    stats: {
      workIssued: 0,
      populationIssued: 0,
      systemSinks: 0,
      commodityVolume: 0,
      facilityVolume: 0,
      workClicks: 0,
      producedGoods: 0,
      boughtGoods: 0,
      soldGoods: 0,
      giftIssued: 0,
      gemExchangeCredits: 0,
      populationIncome: 0,
      employmentPayments: 0,
      productionPayroll: 0,
      constructionPayroll: 0,
      warehousePayroll: 0,
      marketServiceFees: 0,
      invitationGemsIssued: 0,
      leaderboards: { period: { key: '2026-07-20' } },
    },
    leaderboard: [],
    lastProcessedAt: 0,
    inventory: 0,
    frozenInventory: 0,
    commodityName: '',
    marketPrice: 0,
    marketPriceHistory: [],
    demand: {
      cycleMs: 0,
      nextDemandAt: 0,
      lastBudget: 0,
      lastQuantity: 0,
      lastPrice: 0,
      satisfaction: 0,
      referencePrice: 0,
      observedPrice: 0,
      costAnchor: null,
      downstreamValueAnchor: null,
      targetPrice: 0,
    },
    assetAuctions: [{
      id: 'auction-seen', status: 'open', isSeller: false, isHighestBidder: true,
      bids: [{ bidderId: 7 }],
    }],
    productionContracts: [{
      id: 'contract-seen', status: 'active', issue: null,
      isPublisher: true, isBuyer: true, isSupplier: false,
    }],
  };
}

const initialGame = gameFixture();
const baseline = createNavigationBadgeBaseline(initialGame);
assert.deepEqual(baseline.seenAuctionIds, ['auction-seen']);
assert.deepEqual(baseline.seenContractIds, ['contract-seen']);
assert.equal(baseline.seenLeaderboardPeriodKey, '2026-07-20');

const changedGame = gameFixture();
changedGame.orders = Array.from({ length: 120 }, (_, index) => ({
  id: `order-${index}`,
  assetKind: 'commodity',
  assetId: 'wheat',
  side: 'buy',
  isOwn: true,
  price: 1,
  quantity: 1,
  remaining: 1,
  status: 'open',
  createdAt: index,
}));
changedGame.facilityGroups = [{ facilityTypeId: 'farm', status: 'error' }];
changedGame.warehouseAvailableCapacity = 10;
changedGame.assetAuctions = [
  {
    id: 'auction-seen', status: 'open', isSeller: false, isHighestBidder: false,
    bids: [{ bidderId: 7 }],
  },
  {
    id: 'auction-new', status: 'open', isSeller: false, isHighestBidder: false,
    bids: [{ bidderId: 7 }],
  },
];
changedGame.productionContracts = [
  {
    id: 'contract-seen', status: 'active', issue: '货款不足',
    isPublisher: true, isBuyer: true, isSupplier: false,
  },
  {
    id: 'contract-new', status: 'open', issue: null,
    isPublisher: false, isBuyer: false, isSupplier: false,
  },
];
changedGame.stats.leaderboards.period.key = '2026-07-27';

const badges = buildNavigationBadges(changedGame, baseline);
assert.equal(badges.market?.count, 120);
assert.equal(formatNavigationBadgeCount(badges.market?.count || 0), '99+');
assert.equal(badges.production?.count, 2);
assert.equal(badges.auction?.count, 2, 'new and outbid auctions must merge by auction id');
assert.equal(badges.contracts?.count, 2, 'new and actionable contracts must merge by contract id');
assert.equal(badges.leaderboard?.count, 1);
assert.equal(badges.home, undefined);
assert.equal(badges.assets, undefined);
assert.equal(badges['gem-shop'], undefined);
assert.equal(badges.settings, undefined);

const auctionRead = markNavigationBadgeTabRead(baseline, 'auction', changedGame);
assert.equal(buildNavigationBadges(changedGame, auctionRead).auction?.count, 2,
  'visiting auction clears unread auctions but preserves both outbid auctions');

changedGame.assetAuctions[1].isHighestBidder = true;
assert.equal(buildNavigationBadges(changedGame, auctionRead).auction?.count, 1,
  'an auction disappears after the player becomes highest bidder again');

const contractRead = markNavigationBadgeTabRead(baseline, 'contracts', changedGame);
assert.equal(buildNavigationBadges(changedGame, contractRead).contracts?.count, 1,
  'visiting contracts clears new contracts but preserves actionable contracts');

const leaderboardRead = markNavigationBadgeTabRead(baseline, 'leaderboard', changedGame);
assert.equal(buildNavigationBadges(changedGame, leaderboardRead).leaderboard, undefined);

const navigationSource = readFileSync(new URL('../src/components/shell/NavigationItems.tsx', import.meta.url), 'utf8');
const globalsCss = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');
const desktopCss = readFileSync(new URL('../src/styles/desktop-sidebar.css', import.meta.url), 'utf8');
const mobileCss = readFileSync(new URL('../src/styles/mobile-status-navigation.css', import.meta.url), 'utf8');
const uiDesign = readFileSync(new URL('../docs/UI_DESIGN_SYSTEM.md', import.meta.url), 'utf8');
const pageDesign = readFileSync(new URL('../docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', import.meta.url), 'utf8');

assert.match(navigationSource, /badges: NavigationBadgeMap/);
assert.doesNotMatch(navigationSource, /id === ['"]market['"]/);
assert.doesNotMatch(navigationSource, /openOrderCount/);
assert.doesNotMatch(`${navigationSource}\n${globalsCss}\n${desktopCss}\n${mobileCss}`, /sidebar-nav-count/);
assert.match(globalsCss, /\.navigation-badge[\s\S]*color: var\(--color-on-primary\)[\s\S]*background: var\(--color-success\)/);
assert.match(desktopCss, /\.desktop-sidebar \.navigation-badge/);
assert.match(mobileCss, /\.mobile-bottom-navigation \.sidebar-nav-button \.navigation-badge/);
assert.match(uiDesign, /统一导航角标/);
assert.match(uiDesign, /99\+/);
assert.match(pageDesign, /拍卖角标/);
assert.match(pageDesign, /合同角标/);
assert.match(pageDesign, /排行榜结算/);

console.log('navigation badge verification passed');
