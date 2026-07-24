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
check(server.includes("LEADERBOARD_TIME_ZONE = 'Asia/Shanghai'"), 'weekly period must use Beijing time');
check(server.includes('Object.freeze([30, 20, 10])'), 'weekly gem rewards must be 30 / 20 / 10');
check(server.includes("REWARDED_BOARD_IDS = Object.freeze(['growth', 'production', 'trading'])"), 'wealth board must not grant gems');
check(server.includes("order?.ownerType !== 'player' || order?.side !== 'sell'"), 'trading board must count seller fills only');
check(server.includes('function tradeGrossFor(fill)'), 'trading board must calculate gross volume from fills');
check(server.includes('return quantity * price;'), 'trading board must use the full actual fill value');
check(!server.includes('PLAYER_PAIR_DAILY_SCORE_LIMIT'), 'trading board must not cap actual sell volume by counterparty');
check(server.includes("description: '本周订单簿实际卖出成交额'"), 'trading board copy must describe actual sell volume');
check(server.includes("unit: 'currency'"), 'trading board must display a currency amount');
check(server.includes('tradingRuleVersion: TRADING_RULE_VERSION'), 'trading rule migration must be versioned');
check(server.includes('delete state.pairDayScores'), 'legacy pair caps must be removed during migration');
check(server.includes('processAssetAuctions'), 'weekly growth must settle auctions at the boundary');
check(page.includes("const BOARD_ORDER: LeaderboardBoardId[] = ['wealth', 'growth', 'production', 'trading']"), 'four boards must keep the approved order');
check(page.includes("timeZone: 'Asia/Shanghai'"), 'leaderboard page must format periods in Beijing time');
check(styles.includes('grid-template-columns: repeat(4, minmax(280px, 1fr))'), 'desktop leaderboard must remain a four-column grid');
check(styles.includes('overflow-x: auto'), 'narrow viewports must preserve four columns with horizontal scrolling');
check(productDesign.includes('30 / 20 / 10'), 'product design must record gem rewards');
check(productDesign.includes('撤单的未成交剩余数量不计入'), 'product design must exclude cancelled remainder');
check(productDesign.includes('Asia/Shanghai'), 'product design must record Beijing leaderboard time');
check(productDesign.includes('实际卖出成交额'), 'product design must record gross sell volume');
check(navigationDesign.includes('四列'), 'navigation design must record the four-column leaderboard page');

if (failures.length > 0) {
  console.error('Leaderboard verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Leaderboard verification passed.');
