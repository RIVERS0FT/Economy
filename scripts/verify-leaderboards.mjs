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
const runtimeStore = `${read('server/src/runtime-store-core.js')}\n${read('server/src/runtime-store.js')}`;
const statePartitions = read('server/src/state-partitions.js');
const leaderboardTypes = read('src/leaderboardTypes.ts');
const page = read('src/pages/LeaderboardPage.tsx');
const styles = read('src/styles/leaderboards.css');
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const navigationDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const docsIndex = read('docs/README.md');
const previewSpec = read('tests/browser/all-pages-preview.spec.ts');
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
check(server.includes('function updatePersonalBest(player, boardId, score, periodKey)'), 'server must maintain authoritative personal best scores');
check(server.includes('currentIsRecord: !state.partial'), 'current-week record status must ignore partial weeks');
check(server.includes('if (!state.partial)'), 'personal bests must only settle from complete weeks');
check(!publicEntrySource.includes('activityAt'), 'public leaderboard entries must not expose activity timestamps');
check(publicEntrySource.includes('userId: Number(entry.userId)'), 'public leaderboard entries must expose stable player ids for avatar lookup');
check(domain.includes('lastEconomicActivityAt: now'), 'new players must receive an activity baseline');
check(domain.includes(': player.registeredAt;'), 'legacy players must fall back to registration time');
check(storage.includes('!isDeepStrictEqual(activePlayer, playerBeforeAction)'), 'no-op ordinary actions must not refresh activity');
check(runtimeStore.includes('const actionChanged = activePlayer'), 'contract actions must verify a real state change before refreshing activity');
check(runtimeStore.includes('function stableLegacyLeaderboard(entries)'), 'legacy leaderboard delivery must strip request-time timestamps');
check(runtimeStore.includes('function stableRankedLeaderboards(value)'), 'ranked leaderboard delivery must strip request-time timestamps');
check(runtimeStore.includes('delete stats.leaderboards'), 'ranked leaderboards must leave the player stats partition');
check(runtimeStore.includes('stableState.leaderboards = leaderboards'), 'ranked leaderboards must be exposed at the top level');
check(statePartitions.includes("const LEADERBOARD_KEYS = new Set(['leaderboard', 'leaderboards'])"), 'both leaderboard projections must share the leaderboard partition');
check(!leaderboardTypes.includes('generatedAt?: number'), 'ranked leaderboard types must not expose request-generation time');
check(leaderboardTypes.includes('userId?: number;'), 'ranked leaderboard client entries must accept player ids for avatars');
check(leaderboardTypes.includes('game.leaderboards ??'), 'client must read the independent leaderboard partition first');
check(server.includes("REWARDED_BOARD_IDS = Object.freeze(['growth', 'production', 'trading'])"), 'wealth board must not grant gems');
check(server.includes("order?.ownerType !== 'player' || order?.side !== 'sell'"), 'trading board must count seller fills only');
check(server.includes('function tradeGrossFor(fill)'), 'trading board must calculate gross volume from fills');
check(server.includes('return explicitTotal;'), 'trading board must prefer the authoritative fill total');
check(server.includes('const price = safeNonNegativeNumber(fill?.price);'), 'trading board fallback must preserve decimal prices');
check(!server.includes('PLAYER_PAIR_DAILY_SCORE_LIMIT'), 'trading board must not cap actual sell volume by counterparty');
check(server.includes("description: '本周即时市场实际卖出成交额'"), 'trading board copy must describe immediate-market sell volume');
check(server.includes("unit: 'currency'"), 'trading board must display a currency amount');
check(server.includes('tradingRuleVersion: TRADING_RULE_VERSION'), 'trading rule migration must be versioned');
check(server.includes('delete state.pairDayScores'), 'legacy pair caps must be removed during migration');
check(server.includes('processAssetAuctions'), 'weekly growth must settle auctions at the boundary');
check(page.includes("const BOARD_ORDER: LeaderboardBoardId[] = ['wealth', 'growth', 'production', 'trading']"), 'four boards must keep the approved order');
check(page.includes("useState<LeaderboardBoardId>('wealth')"), 'leaderboard page must default to the wealth board');
check(page.includes('className="leaderboard-board-switch ui-segmented"'), 'leaderboard page must use a shared four-button switch');
check(page.includes('aria-pressed={selectedBoardId === boardId}'), 'leaderboard board buttons must expose selected state');
check(page.includes('className="leaderboard-responsive-layout"'), 'leaderboard page must expose a container-responsive layout');
check(page.includes('className="leaderboard-board-grid"'), 'leaderboard page must render the ordered board grid');
check(page.includes('<LeaderboardCard board={leaderboards.boards[boardId]} />'), 'leaderboard page must render all four boards from the approved order');
check(page.includes("timeZone: 'Asia/Shanghai'"), 'leaderboard page must format periods in Beijing time');
check(!page.includes('actions={period.partial'), 'leaderboard title must not render weekly period actions');
check(!page.includes('<StatusTag tone="success">{periodLabel}</StatusTag>'), 'leaderboard title must not render the weekly period as a pill');
check(page.includes('本期 {periodLabel}；'), 'leaderboard period must remain in the footer note');
check(page.includes("board.unit === 'quantity'"), 'leaderboard page must format production as a quantity');
check(page.includes("if (board.unit === 'quantity') return <CompactNumber value={score} />;"), 'production quantity must render as a plain formatted number');
check(page.includes('<span>排名</span><span>玩家</span><span>成绩</span><span>奖励</span>'), 'leaderboard rows must expose the four approved columns');
check(page.includes("import { PlayerAvatar } from '../components/ui/PlayerAvatar';"), 'leaderboard rows must reuse PlayerAvatar');
check(page.includes('<PlayerAvatar userId={userId} playerName={entry.playerName} size={28} className="leaderboard-avatar" />'), 'leaderboard player column must load real player avatars');
check(page.includes('className="leaderboard-avatar"'), 'leaderboard rows must render the avatar-name identity column');
check(page.includes("entry.rewardGems ? <>◆ <CompactNumber value={entry.rewardGems} /></> : '—'"), 'leaderboard reward column must stay present and show a dash when empty');
check(!page.includes('<p>{board.description}</p>'), 'leaderboard board descriptions must not render below titles');
check(!page.includes("period.rewardEnabled ? '前三名奖励' : '测试周'"), 'leaderboard title status pills must not render');
check(!page.includes('`${formatNumber(score)} 个`'), 'production quantity must not append the 个 unit');
check(page.includes('最后有效经济活动时间越近者排名越高'), 'leaderboard page must explain the tie-break rule');
check(!page.includes('首个不完整周不发奖'), 'leaderboard page must not show the partial-week pill');
check(!page.includes('当前为首次上线测试周期，仅记录排名'), 'leaderboard page must not show the initial test-period explanation');
check(page.includes('leaderboard-personal-best'), 'leaderboard page must show personal best scores');
check(page.includes('本周已刷新个人纪录'), 'leaderboard page must identify a current-week record');
check(leaderboardTypes.includes('LeaderboardPersonalBest'), 'leaderboard client types must expose authoritative personal bests');
check(styles.includes('.leaderboard-board-switch'), 'leaderboard styles must define the board switch');
check(styles.includes('.leaderboard-board-switch > .ui-segmented__button'), 'leaderboard switch must constrain each button within its single row');
check(styles.includes('container: leaderboard-layout / inline-size'), 'leaderboard mode must follow its content width');
check(styles.includes('@container leaderboard-layout (min-width: 72rem)'), 'wide leaderboard mode must use the approved content breakpoint');
check((styles.match(/grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/g) || []).length >= 2, 'switch and wide board grid must both use four columns');
check(styles.includes('.leaderboard-board-slot:not(.is-selected)'), 'narrow mode must hide unselected boards');
check(styles.includes('.leaderboard-avatar'), 'leaderboard styles must define the avatar cell');
check(styles.includes('.leaderboard-avatar:not(.player-avatar)'), 'leaderboard fallback avatar must not override shared PlayerAvatar visuals');
check(styles.includes('grid-column: 4;'), 'leaderboard reward must occupy the fourth column');
check(styles.includes('white-space: nowrap;'), 'narrow leaderboard buttons must stay on one line');
check(!styles.includes('.leaderboard-board-switch {\n    grid-template-columns: repeat(2, minmax(0, 1fr))'), 'leaderboard switch must never wrap into two columns');
check(!styles.includes('leaderboard-grid-scroll'), 'leaderboard must not use a horizontal scrolling wrapper');
check(productDesign.includes('50 / 30 / 20'), 'product design must record gem rewards');
check(productDesign.includes('本周生产数量 += 实际产出数量'), 'product design must record quantity-only production ranking');
check(productDesign.includes('最后一次有效经济活动时间降序'), 'product design must record the shared tie-break rule');
check(productDesign.includes('榜单次级统计不得参与排名'), 'product design must exclude secondary metrics from ranking');
check(productDesign.includes('即时交易没有未成交挂单或撤单剩余量'), 'product design must record that player commodity trading has no unfilled remainder');
check(productDesign.includes('Asia/Shanghai'), 'product design must record Beijing leaderboard time');
check(productDesign.includes('实际卖出成交额'), 'product design must record gross sell volume');
check(productDesign.includes('即时卖出数量 × 当日官方系统价'), 'product design must bind commodity trading score to the daily official price');
check(navigationDesign.includes('内容容器宽度不小于 `72rem` 时隐藏切换按钮'), 'navigation design must record the responsive four-board mode');
check(navigationDesign.includes('按钮必须强制保持同一行'), 'navigation design must keep the narrow switch on one row');
check(navigationDesign.includes('不显示“首个不完整周不发奖”胶囊'), 'navigation design must record the removed partial-week copy');
check(navigationDesign.includes('标题栏不得显示周榜起止时间或持续时间胶囊'), 'navigation design must forbid the leaderboard period pill');
check(navigationDesign.includes('榜单表头和玩家数据行固定为“排名｜玩家｜成绩｜奖励”四列'), 'navigation design must record the four-column single-row leaderboard');
check(navigationDesign.includes('排行榜玩家列固定复用 `PlayerAvatar`'), 'navigation design must require real player avatars');
check(navigationDesign.includes('不显示标题下描述或标题右侧“实时／前三名奖励／测试周”等状态胶囊'), 'navigation design must record the simplified board heading');
check(previewSpec.includes("page.locator('.leaderboard-board-card:visible')).toHaveCount(4)"), 'browser preview must render four visible boards at wide width');
check(previewSpec.includes("page.locator('.leaderboard-board-card:visible')).toHaveCount(1)"), 'browser preview must render one visible board at narrow width');
check(previewSpec.includes("toHaveAttribute('aria-label', '选择排行榜')"), 'browser preview must verify the four-button leaderboard switch');
check(previewSpec.includes("leaderboard-board-heading p')).toHaveCount(0)"), 'browser preview must verify descriptions are removed');
check(previewSpec.includes("leaderboard-column-labels span')).toHaveText(['排名', '玩家', '成绩', '奖励'])"), 'browser preview must verify the four leaderboard columns');
check(docsIndex.includes('`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`'), 'design index must route leaderboard page structure to the page DESIGN owner');
check(docsIndex.includes('`PRODUCT_AND_GAMEPLAY_DESIGN.md`'), 'design index must route leaderboard scoring semantics to the product DESIGN owner');

check(page.includes('商品按当日官方价、工厂按最近产权成交价计算资产毛值并扣除贷款负债后的实时净资产'), 'wealth fallback copy must match authoritative commodity and facility valuation');
check(!page.includes('按最近一次订单簿真实成交价计算资产毛值'), 'wealth fallback copy must not restore commodity order-book valuation');
check(productDesign.includes('商品估值 = Σ((可用数量 + 冻结数量) × 所在州当日官方系统价)'), 'product design must value commodities at the current regional official price');
check(productDesign.includes('工厂估值 = Σ(总持有数量 × 所在州最近一次真实产权成交价)'), 'product design must keep facility valuation separate from commodity official prices');

if (failures.length) {
  console.error('Leaderboard verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Leaderboard verification passed.');
