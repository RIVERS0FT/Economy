import { readFileSync, writeFileSync } from 'node:fs';

const path = 'server/src/domain.js';
let source = readFileSync(path, 'utf8');
function replace(before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  source = source.replace(before, after);
}

replace(
`export function ensurePlayer(world, user, now = Date.now()) {
  const player = core.ensurePlayer(world, user, now);
  ensurePopulationEconomy(world, now);
  marketDemand.normalizeWorld(world, now);
  return player;
}

export function processWorld(world, now = Date.now()) {
  if (processedWorldAt.get(world) === now) return world;
  migrateWorld(world, now);
  ensurePopulationEconomy(world, now);
  core.processWorld(world, now);
  marketDemand.process(world, now);
  processedWorldAt.set(world, now);
  return world;
}`,
`export function ensurePlayer(world, user, now = Date.now(), { migrate = true } = {}) {
  const player = core.ensurePlayer(world, user, now, { migrate });
  if (migrate) {
    ensurePopulationEconomy(world, now);
    marketDemand.normalizeWorld(world, now);
  }
  return player;
}

export function processWorld(world, now = Date.now(), { migrate = true } = {}) {
  if (processedWorldAt.get(world) === now) return world;
  if (migrate) {
    migrateWorld(world, now);
    ensurePopulationEconomy(world, now);
  }
  core.processWorld(world, now, { migrate: false });
  marketDemand.process(world, now);
  processedWorldAt.set(world, now);
  return world;
}`,
'domain player/world wrappers');

replace(
`  const player = core.ensurePlayer(world, user, now);`,
`  const player = core.ensurePlayer(world, user, now, { migrate: false });`,
'commodity order player ensure');

replace(
`export function applyAction(world, user, action, payload = {}, now = Date.now()) {
  migrateWorld(world, now);
  if (processedWorldAt.get(world) !== now) processWorld(world, now);
  const result = action === 'placeOrder' && payload.assetKind !== 'facility'
    ? applyCommodityOrder(world, user, payload, now)
    : core.applyAction(world, user, action, payload, now);
  processedWorldAt.delete(world);
  return result;
}`,
`export function applyAction(
  world,
  user,
  action,
  payload = {},
  now = Date.now(),
  { migrate = true, process = true } = {},
) {
  if (migrate) migrateWorld(world, now);
  if (process && processedWorldAt.get(world) !== now) processWorld(world, now, { migrate: false });
  const result = action === 'placeOrder' && payload.assetKind !== 'facility'
    ? applyCommodityOrder(world, user, payload, now)
    : core.applyAction(world, user, action, payload, now, { migrate: false, process: false });
  if (process) processedWorldAt.delete(world);
  return result;
}`,
'domain action wrapper');

writeFileSync(path, source);
console.log('Updated domain facade to preserve cold/runtime migration boundary.');
