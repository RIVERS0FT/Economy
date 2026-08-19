export * from './leaderboards-core.js';

import { processWorld } from './domain.js';
import { processLeaderboardWorld as processLeaderboardWorldCore } from './leaderboards-core.js';

export function processLeaderboardWorld(world, now = Date.now(), options = {}) {
  processWorld(world, now, { migrate: false });
  return processLeaderboardWorldCore(world, now, options);
}
