from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:120]!r}')
    write(path, content.replace(old, new, 1))


# Shared badge class replaces the former market-only class without changing geometry.
replace_once(
    'src/styles/globals.css',
    '''.sidebar-nav-button small {
  min-width: 22px;
  border-radius: var(--radius-pill);
  padding: 0.12rem 0.35rem;
  color: var(--color-on-primary);
  background: var(--color-success);
  text-align: center;
}''',
    '''.navigation-badge {
  min-width: 22px;
  border-radius: var(--radius-pill);
  padding: 0.12rem 0.35rem;
  color: var(--color-on-primary);
  background: var(--color-success);
  text-align: center;
}''',
)

for old, new in [
    ('.desktop-sidebar .sidebar-nav-count', '.desktop-sidebar .navigation-badge'),
    ('.desktop-sidebar[data-collapsed="true"] .sidebar-nav-button .sidebar-nav-count', '.desktop-sidebar[data-collapsed="true"] .sidebar-nav-button .navigation-badge'),
    ('.desktop-sidebar .sidebar-nav-button .sidebar-nav-count', '.desktop-sidebar .sidebar-nav-button .navigation-badge'),
]:
    content = read('src/styles/desktop-sidebar.css')
    if old not in content:
        raise RuntimeError(f'src/styles/desktop-sidebar.css missing {old}')
    write('src/styles/desktop-sidebar.css', content.replace(old, new))

replace_once(
    'src/styles/mobile-status-navigation.css',
    '.mobile-bottom-navigation .sidebar-nav-button small {',
    '.mobile-bottom-navigation .navigation-badge {',
)

# Runtime harness scenarios cover 99+, merged auction/contract IDs and leaderboard settlement.
replace_once(
    'tests/browser/runtime-harness.tsx',
    '''const view = params.get('view') ?? 'settings';
const scenario = params.get('scenario') ?? 'empty';
const fixedNow = new Date(2026, 6, 17, 22, 30, 0).getTime();''',
    '''const view = params.get('view') ?? 'settings';
const scenario = params.get('scenario') ?? 'empty';
const fixedNow = new Date(2026, 6, 17, 22, 30, 0).getTime();
const navigationBadgeStorageKey = 'economy:navigation-badges:v1:123';
if (scenario === 'badge-merged') {
  window.localStorage.setItem(navigationBadgeStorageKey, JSON.stringify({
    seenAuctionIds: ['auction-outbid'],
    seenContractIds: ['contract-attention'],
    seenLeaderboardPeriodKey: '2026-07-06',
  }));
} else {
  window.localStorage.removeItem(navigationBadgeStorageKey);
}''',
)
replace_once(
    'tests/browser/runtime-harness.tsx',
    '''  const hasManyOrders = scenario === 'many-orders';
  const hasThreeCashEvents = scenario === 'cash-three';''',
    '''  const hasManyOrders = ['many-orders', 'badge-cap'].includes(scenario);
  const hasBadgeCap = scenario === 'badge-cap';
  const hasMergedBadges = scenario === 'badge-merged';
  const hasThreeCashEvents = scenario === 'cash-three';''',
)
replace_once(
    'tests/browser/runtime-harness.tsx',
    '''  const orders = hasManyOrders
    ? Array.from({ length: 6 }, (_, index) => ({''',
    '''  const orders = hasManyOrders
    ? Array.from({ length: hasBadgeCap ? 120 : 6 }, (_, index) => ({''',
)
replace_once(
    'tests/browser/runtime-harness.tsx',
    '''  const derived = {
    ownOpenOrders: orders,''',
    '''  if (hasMergedBadges) {
    Object.assign(game, {
      assetAuctions: [
        {
          id: 'auction-new', items: [], itemSummaries: [], itemCount: 1, isBundle: false,
          assetKind: 'commodity', assetId: 'machinery', quantity: 1,
          asset: { kind: 'commodity', id: 'machinery', name: '机械', subtitle: '商品资产' },
          sellerId: 456, sellerName: '新卖家', startingBid: 40, highestBid: null,
          highestBidderId: null, highestBidderName: null, status: 'open', escrowStatus: 'held',
          createdAt: fixedNow - 5 * 60_000, endsAt: fixedNow + 60 * 60_000, bids: [],
          isSeller: false, isHighestBidder: false, minimumBid: 40,
        },
        {
          id: 'auction-outbid', items: [], itemSummaries: [], itemCount: 1, isBundle: false,
          assetKind: 'commodity', assetId: 'machinery', quantity: 1,
          asset: { kind: 'commodity', id: 'machinery', name: '机械', subtitle: '商品资产' },
          sellerId: 457, sellerName: '竞拍卖家', startingBid: 40, highestBid: 55,
          highestBidderId: 999, highestBidderName: '其他玩家', status: 'open', escrowStatus: 'held',
          createdAt: fixedNow - 30 * 60_000, endsAt: fixedNow + 60 * 60_000,
          bids: [{ bidderId: 123, bidderName: 'MEVIUS', amount: 50, createdAt: fixedNow - 20 * 60_000 }],
          isSeller: false, isHighestBidder: false, minimumBid: 56,
        },
        {
          id: 'auction-overlap', items: [], itemSummaries: [], itemCount: 1, isBundle: false,
          assetKind: 'commodity', assetId: 'machinery', quantity: 1,
          asset: { kind: 'commodity', id: 'machinery', name: '机械', subtitle: '商品资产' },
          sellerId: 458, sellerName: '重合卖家', startingBid: 40, highestBid: 62,
          highestBidderId: 998, highestBidderName: '另一玩家', status: 'open', escrowStatus: 'held',
          createdAt: fixedNow - 2 * 60_000, endsAt: fixedNow + 60 * 60_000,
          bids: [{ bidderId: 123, bidderName: 'MEVIUS', amount: 60, createdAt: fixedNow - 3 * 60_000 }],
          isSeller: false, isHighestBidder: false, minimumBid: 63,
        },
      ],
      productionContracts: [
        {
          id: 'contract-new', publisherId: 456, publisherName: '新合同发布者', publisherRole: 'buyer',
          buyerId: 456, buyerName: '新合同发布者', supplierId: null, supplierName: null,
          productId: 'machinery', quantityPerDelivery: 10, unitPrice: 50, batchGross: 500,
          deliveryIntervalMs: 60 * 60_000, totalDeliveries: 4, completedDeliveries: 0,
          firstDeliveryDelayMs: 60 * 60_000, createdAt: fixedNow - 5 * 60_000,
          offerExpiresAt: fixedNow + 86_400_000, nextDueAt: null, status: 'open', roundStatus: 'preparing',
          buyerEscrowCredits: 0, supplierReservedQuantity: 0, buyerBondCredits: 0, supplierBondCredits: 0,
          buyerAutoFund: false, supplierAutoReserve: false, issue: null,
          isPublisher: false, isBuyer: false, isSupplier: false,
        },
        {
          id: 'contract-attention', publisherId: 457, publisherName: '已读合同方', publisherRole: 'supplier',
          buyerId: 123, buyerName: 'MEVIUS', supplierId: 457, supplierName: '已读合同方',
          productId: 'machinery', quantityPerDelivery: 10, unitPrice: 50, batchGross: 500,
          deliveryIntervalMs: 60 * 60_000, totalDeliveries: 4, completedDeliveries: 1,
          firstDeliveryDelayMs: 60 * 60_000, createdAt: fixedNow - 86_400_000,
          offerExpiresAt: fixedNow + 86_400_000, acceptedAt: fixedNow - 80_000,
          nextDueAt: fixedNow + 30 * 60_000, status: 'active', roundStatus: 'preparing',
          buyerEscrowCredits: 100, supplierReservedQuantity: 10, buyerBondCredits: 100, supplierBondCredits: 100,
          buyerAutoFund: false, supplierAutoReserve: true, issue: '采购方货款不足',
          isPublisher: false, isBuyer: true, isSupplier: false,
        },
        {
          id: 'contract-overlap', publisherId: 458, publisherName: '新履约方', publisherRole: 'supplier',
          buyerId: 123, buyerName: 'MEVIUS', supplierId: 458, supplierName: '新履约方',
          productId: 'machinery', quantityPerDelivery: 10, unitPrice: 50, batchGross: 500,
          deliveryIntervalMs: 60 * 60_000, totalDeliveries: 4, completedDeliveries: 0,
          firstDeliveryDelayMs: 60 * 60_000, createdAt: fixedNow - 10 * 60_000,
          offerExpiresAt: fixedNow + 86_400_000, acceptedAt: fixedNow - 2 * 60_000,
          nextDueAt: fixedNow + 30 * 60_000, status: 'active', roundStatus: 'preparing',
          buyerEscrowCredits: 100, supplierReservedQuantity: 10, buyerBondCredits: 100, supplierBondCredits: 100,
          buyerAutoFund: false, supplierAutoReserve: true, issue: '采购方货款不足',
          isPublisher: false, isBuyer: true, isSupplier: false,
        },
      ],
      productionContractSummary: { active: 2, open: 0, needsAttention: 2, upcomingWithin24Hours: 2 },
    });
    Object.assign(game.stats, {
      leaderboards: {
        period: {
          key: '2026-07-13', startsAt: fixedNow - 4 * 86_400_000, endsAt: fixedNow + 3 * 86_400_000,
          partial: false, rewardEnabled: true, rewards: [30, 20, 10], timeZone: 'Asia/Shanghai',
        },
        boards: {},
      },
    });
  }

  const derived = {
    ownOpenOrders: orders,''',
)

# Package scripts include the new verification in the authoritative build chain.
package_path = ROOT / 'package.json'
package_data = json.loads(package_path.read_text(encoding='utf-8'))
scripts = package_data['scripts']
scripts['verify:navigation-badges'] = 'node scripts/verify-navigation-badges.mjs'
verify_architecture = scripts['verify:architecture']
if 'verify-navigation-badges.mjs' not in verify_architecture:
    scripts['verify:architecture'] = verify_architecture + ' && node scripts/verify-navigation-badges.mjs'
package_path.write_text(json.dumps(package_data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


print('navigation badge code changes applied')
