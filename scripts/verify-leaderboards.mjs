import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const server = read('server/src/leaderboards.js');
const page = read('src/pages/LeaderboardPage.tsx');
const styles = read('src/styles/leaderboards.css');
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const navigationDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');

for (const board of ['wealth', 'growth', 'production', 'trading']) {
  check(server.includes(`'${board}'`), `server leaderboard engine must include ${board}`);
  check(page.includes(`'${board}'`), `leaderboard page must include ${board}`);
}
check(!server.includes("'industry'"), 'industry leaderboard must not return');
check(server.includes("LEADERBOARD_TIME_ZONE = 'Asia/Taipei'"), 'weekly period must use Asia/Taipei');
check(server.includes('Object.freeze([30, 20, 10])'), 'weekly gem rewards must be 30 / 20 / 10');
check(server.includes("REWARDED_BOARD_IDS = Object.freeze(['growth', 'production', 'trading'])"), 'wealth board must not grant gems');
check(server.includes("order?.ownerType !== 'player' || order?.side !== 'sell'"), 'trading board must count seller fills only');
check(server.includes('PLAYER_PAIR_DAILY_SCORE_LIMIT = 10_000'), 'player pair daily score cap must remain enabled');
check(server.includes('processCollectibleAuctions'), 'weekly growth must settle auctions at the boundary');
check(page.includes("const BOARD_ORDER: LeaderboardBoardId[] = ['wealth', 'growth', 'production', 'trading']"), 'four boards must keep the approved order');
check(styles.includes('grid-template-columns: repeat(4, minmax(280px, 1fr))'), 'desktop leaderboard must remain a four-column grid');
check(styles.includes('overflow-x: auto'), 'narrow viewports must preserve four columns with horizontal scrolling');
check(productDesign.includes('30 / 20 / 10'), 'product design must record leaderboard gem rewards');
check(productDesign.includes('首个不完整周'), 'product design must record partial-week behavior');
check(navigationDesign.includes('四列'), 'navigation design must record the four-column leaderboard page');

if (failures.length > 0) {
  console.error('Leaderboard verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Leaderboard verification passed.');
