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
const domain = read('server/src/domain-core.js');
const storage = read('server/src/storage.js');
const runtimeStore = read('server/src/runtime-store.js');
const page = read('src/pages/LeaderboardPage.tsx');
const styles = read('src/styles/leaderboards.css');
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const navigationDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const publicEntrySource = server.slice(
  server.indexOf('function publicEntry'),
  server.indexOf('function boardDefinition'),
);

for (const board of ['wealth', 'growth', 'production', 'trading']) {
  check(server.includes(`'${board}'`), `server leaderboard engine must include ${board}`);
  check(page.includes(`'${board}'`), `leaderboard page must include ${board}`);
}
check(!server.includes("'industry'"), 'industry leaderboard must not return');
check(server.includes("LEADERBOARD_TIME_ZONE = 'Asia/Shanghai'"), 'weekly period must use Beijing time');
check(server.includes('Object.freeze([50, 30, 20])'), 'weekly gem rewards must be 50 / 30 / 20');
check(server.includes('const PRODUCTION_RULE_VERSION = 2'), 'production quantity rule migration must be versioned');
check(server.includes('productionRuleVersion: PRODUCTION_RULE_VERSION'), 'period state must persist production rule version');
check(server.includes('sortRuleVersion: LEADERBOARD_SORT_RULE_VERSION'), 'period state must persist leaderboard sort rule version');
check(server.includes('function compareLeaderboardRows(left, right)'), 'leaderboards must share one comparator');
check(server.includes('right.activityAt - left.activityAt'), 'score ties must prefer the latest economic activity');
check(!server.includes('right.secondary - left.secondary'), 'secondary metrics must not affect ranking');
check(!server.includes('right.tertiary - left.tertiary'), 'tertiary metrics must not affect ranking');
check(!server.includes('delta * safeNonNegativeInteger(product?.basePrice)'), 'production board must not price-weight output');
check(server.includes("description: '本周服务器确认完成的商品产出总数量'"), 'production board copy must describe weekly quantity');
check(server.includes("unit: 'quantity'"), 'production board must expose a quantity unit');
check(server.includes('tieBreakActivityAt: entry.activityAt'), 'weekly history must audit the tie-break timestamp');
check(!publicEntrySource.includes('activityAt'), 'public leaderboard entries must not expose activity timestamps');
check(domain.includes('lastEconomicActivityAt: now'), 'new players must receive an activity baseline');
check(domain.includes(': player.registeredAt;'), 'legacy players must fall back to registration time');
check(storage.includes('!isDeepStrictEqual(activePlayer, playerBeforeAction)'), 'no-op ordinary actions must not refresh activity');
check(runtimeStore.includes('const actionChanged = activePlayer'), 'contract actions must verify a real state change before refreshing activity');
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
check(page.includes("board.unit === 'quantity'"), 'leaderboard page must format production as a quantity');
check(page.includes('50 / 30 / 20 宝石'), 'leaderboard page must show the authoritative rewards');
check(page.includes('最后有效经济活动时间越近者排名越高'), 'leaderboard page must explain the tie-break rule');
check(styles.includes('grid-template-columns: repeat(4, minmax(280px, 1fr))'), 'desktop leaderboard must remain a four-column grid');
check(styles.includes('overflow-x: auto'), 'narrow viewports must preserve four columns with horizontal scrolling');
check(productDesign.includes('50 / 30 / 20'), 'product design must record gem rewards');
check(productDesign.includes('本周生产数量 += 实际产出数量'), 'product design must record quantity-only production ranking');
check(productDesign.includes('最后一次有效经济活动时间降序'), 'product design must record the shared tie-break rule');
check(productDesign.includes('榜单次级统计不得参与排名'), 'product design must exclude secondary metrics from ranking');
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
