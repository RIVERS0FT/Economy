import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, replacements) {
  let source = readFileSync(path, 'utf8');
  for (const [before, after, label] of replacements) {
    if (!source.includes(before)) throw new Error(`Missing ${label} in ${path}`);
    source = source.replace(before, after);
  }
  writeFileSync(path, source);
}

patch('server/src/asset-auctions.js', [
  [
`export function processAssetAuctions(world, now = Date.now()) {
  migrateAssetAuctionWorld(world, now);
  for (const auction of world.assetAuctions) {
    if (auction.status === 'open' && Number(auction.endsAt) <= now) settleAuction(world, auction, now);
  }
  return world;
}`,
`export function processAssetAuctions(world, now = Date.now(), { migrate = true } = {}) {
  if (migrate) migrateAssetAuctionWorld(world, now);
  for (const auction of world.assetAuctions || []) {
    if (auction.status === 'open' && Number(auction.endsAt) <= now) settleAuction(world, auction, now);
  }
  return world;
}`,
'asset auction processor options'],
  [
`export function applyAssetAuctionAction(world, user, action, payload = {}, now = Date.now()) {
  processAssetAuctions(world, now);
  const userId = Number(user.id);`,
`export function applyAssetAuctionAction(
  world,
  user,
  action,
  payload = {},
  now = Date.now(),
  { migrate = true, process = true } = {},
) {
  if (process) processAssetAuctions(world, now, { migrate });
  const userId = Number(user.id);`,
'asset auction action options'],
  [
`export function createMarketReserveAuction(world, payload, now = Date.now()) {
  migrateAssetAuctionWorld(world, now);`,
`export function createMarketReserveAuction(world, payload, now = Date.now(), { migrate = true } = {}) {
  if (migrate) migrateAssetAuctionWorld(world, now);`,
'market reserve auction migration option'],
]);

patch('server/src/runtime-action-executor.js', [[
`      } else if (AUCTION_ACTIONS.has(action)) {
        gameResult = applyAssetAuctionAction(world, user, action, payload, now);`,
`      } else if (AUCTION_ACTIONS.has(action)) {
        gameResult = applyAssetAuctionAction(world, user, action, payload, now, {
          migrate: false,
          process: !store.scheduledProcessing,
        });`,
'runtime auction migration skip',
]]);

patch('server/src/leaderboards.js', [
  [
`  processFacilityGroupWorld(world, now);
  processAssetAuctions(world, now);`,
`  processFacilityGroupWorld(world, now, { migrate: false });
  processAssetAuctions(world, now, { migrate: false });`,
'leaderboard scheduled processors'],
  [
`    processFacilityGroupWorld(world, now);
    processAssetAuctions(world, now);`,
`    processFacilityGroupWorld(world, now, { migrate: false });
    processAssetAuctions(world, now, { migrate: false });`,
'leaderboard initial scheduled processors'],
]);

patch('server/src/market-reserve-operations.js', [[
`  return createMarketReserveAuction(world, {
    groupId: group.id,
    groupName: group.name,
    productId: product.id,
    quantity,
    startingBid,
    reservePrice: Math.max(startingBid, reservePrice),
    durationHours: AUCTION_DURATION_HOURS,
  }, now);`,
`  return createMarketReserveAuction(world, {
    groupId: group.id,
    groupName: group.name,
    productId: product.id,
    quantity,
    startingBid,
    reservePrice: Math.max(startingBid, reservePrice),
    durationHours: AUCTION_DURATION_HOURS,
  }, now, { migrate: false });`,
'market reserve scheduled auction migration skip',
]]);

console.log('Separated auction cold migration from runtime processing.');
