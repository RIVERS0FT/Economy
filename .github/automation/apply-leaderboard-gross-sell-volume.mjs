import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing replacement target: ${label}`);
  return content.replace(search, replacement);
}

function replaceRegex(content, pattern, replacement, label) {
  if (!pattern.test(content)) throw new Error(`Missing regex target: ${label}`);
  pattern.lastIndex = 0;
  return content.replace(pattern, replacement);
}

{
  const path = 'server/src/leaderboards.js';
  let content = read(path);
  content = replaceOnce(content, "import { orderAssetId, orderKind } from './order-identity.js';\n", '', 'unused order identity import');
  content = replaceOnce(content, "export const LEADERBOARD_TIME_ZONE = 'Asia/Taipei';", "export const LEADERBOARD_TIME_ZONE = 'Asia/Shanghai';", 'leaderboard timezone');
  content = replaceOnce(content, 'export const PLAYER_PAIR_DAILY_SCORE_LIMIT = 10_000;\n', '', 'daily pair cap export');
  content = content.replaceAll('TAIPEI_OFFSET_MS', 'BEIJING_OFFSET_MS');
  content = replaceOnce(
    content,
    'const WEEK_MS = 7 * 24 * 60 * 60 * 1000;\n',
    'const WEEK_MS = 7 * 24 * 60 * 60 * 1000;\nconst TRADING_RULE_VERSION = 2;\n',
    'trading rule version constant',
  );
  content = replaceOnce(content, 'function localDateKey(timestamp) {', 'function beijingDateKey(timestamp) {', 'Beijing date helper');
  content = replaceOnce(content, 'key: localDateKey(startsAt),', 'key: beijingDateKey(startsAt),', 'Beijing period key');
  content = replaceOnce(
    content,
    '    version: 1,\n    periodKey: period.key,',
    '    version: 1,\n    tradingRuleVersion: TRADING_RULE_VERSION,\n    periodKey: period.key,',
    'period trading rule version',
  );
  content = replaceOnce(content, '    pairDayScores: {},\n', '', 'legacy pair scores state');

  const validStateBlock = `function validLeaderboardState(state) {\n  return state\n    && Number(state.version) === 1\n    && typeof state.periodKey === 'string'\n    && Number.isFinite(Number(state.startsAt))\n    && Number.isFinite(Number(state.endsAt))\n    && Number(state.endsAt) > Number(state.startsAt);\n}\n`;
  const migrationBlock = `${validStateBlock}\nfunction migrateTradingRule(world, state) {\n  if (Number(state.tradingRuleVersion) === TRADING_RULE_VERSION) return;\n\n  for (const [userId, trading] of Object.entries(state.trading || {})) {\n    const player = world.players?.[userId];\n    if (!player) continue;\n    const stats = playerStats(player);\n    stats.marketSellScore = Math.max(0, stats.marketSellScore - safeNonNegativeInteger(trading?.score));\n    stats.marketTradeCount = Math.max(0, stats.marketTradeCount - safeNonNegativeInteger(trading?.tradeCount));\n  }\n\n  state.tradingRuleVersion = TRADING_RULE_VERSION;\n  state.trading = {};\n  state.processedFillIds = {};\n  delete state.pairDayScores;\n  ensureAllPlayers(world, state);\n  captureTradingFills(world, state, world.orders || []);\n}\n`;
  content = replaceOnce(content, validStateBlock, migrationBlock, 'trading rule migration');

  content = replaceRegex(
    content,
    /function tradeScoreFor\(order, fill\) \{[\s\S]*?\n\}\n\nfunction counterpartFor/,
    `function tradeGrossFor(fill) {\n  const quantity = safeNonNegativeInteger(fill?.quantity);\n  const price = safeNonNegativeInteger(fill?.price);\n  if (quantity < 1 || price < 1) return 0;\n  return quantity * price;\n}\n\nfunction counterpartFor`,
    'gross trading score function',
  );

  content = replaceRegex(
    content,
    /      const rawScore = tradeScoreFor\(order, fill\);[\s\S]*?      state\.processedFillIds\[fillId\] = createdAt;/,
    `      const grossVolume = tradeGrossFor(fill);\n      const counterpart = counterpartFor(order, fill, orderById);\n      if (counterpart?.ownerType === 'player') {\n        state.trading[userId].buyers[String(counterpart.ownerId || 'unknown')] = true;\n      }\n      if (grossVolume > 0) {\n        state.trading[userId].score += grossVolume;\n        state.trading[userId].tradeCount += 1;\n        const stats = playerStats(seller);\n        stats.marketSellScore += grossVolume;\n        stats.marketTradeCount += 1;\n      }\n      state.processedFillIds[fillId] = createdAt;`,
    'seller gross fill accounting',
  );

  content = replaceOnce(
    content,
    "  return { title: '交易榜', description: '本周有效卖出成交积分', unit: 'points', rewarded: true };",
    "  return { title: '交易榜', description: '本周订单簿实际卖出成交额', unit: 'currency', rewarded: true };",
    'trading board definition',
  );
  content = replaceOnce(
    content,
    '    : initializeLeaderboardState(world, now, true);\n  ensureAllPlayers(world, state);',
    '    : initializeLeaderboardState(world, now, true);\n  migrateTradingRule(world, state);\n  ensureAllPlayers(world, state);',
    'snapshot trading migration',
  );
  content = replaceOnce(
    content,
    '  let state = world.leaderboardState;\n  while (now >= state.endsAt) {',
    '  let state = world.leaderboardState;\n  migrateTradingRule(world, state);\n  while (now >= state.endsAt) {',
    'world trading migration',
  );
  write(path, content);
}

{
  const path = 'server/test/leaderboards.test.js';
  let content = read(path);
  content = replaceOnce(
    content,
    '  captureTradingFills,\n  createLeaderboardSnapshot,',
    '  captureTradingFills,\n  createLeaderboardSnapshot,\n  LEADERBOARD_TIME_ZONE,',
    'timezone test import',
  );
  content = content.replaceAll('MONDAY_TAIPEI', 'MONDAY_BEIJING');
  content = replaceOnce(
    content,
    "test('leaderboard week starts Monday 00:00 in Asia/Taipei', () => {",
    "test('leaderboard week starts Monday 00:00 in Beijing time', () => {",
    'Beijing test name',
  );
  content = replaceOnce(
    content,
    "  assert.equal(sundayPeriod.key, '2026-07-06');\n});",
    "  assert.equal(sundayPeriod.key, '2026-07-06');\n  assert.equal(LEADERBOARD_TIME_ZONE, 'Asia/Shanghai');\n});",
    'Beijing timezone assertion',
  );

  const tradingTests = `test('trading board sums actual seller gross volume, counts completed fills on cancelled orders, and ignores unfilled remainder and auctions', () => {\n  const now = MONDAY_BEIJING + 60_000;\n  const world = createWorld(now);\n  addPlayer(world, 1, now);\n  addPlayer(world, 2, now);\n  addPlayer(world, 3, now);\n  processLeaderboardWorld(world, now);\n  const state = world.leaderboardState;\n\n  const playerFill = { id: 'fill-player', quantity: 1_000, price: 100, total: 100_000, createdAt: now, makerOrderId: 'sell-player', takerOrderId: 'buy-player' };\n  const cancelledFill = { id: 'fill-cancelled', quantity: 35, price: 200, total: 7_000, createdAt: now + 1, makerOrderId: 'sell-cancelled', takerOrderId: 'buy-cancelled' };\n  const populationFill = { id: 'fill-population', quantity: 100, price: 50, total: 5_000, createdAt: now + 2, makerOrderId: 'sell-population', takerOrderId: 'population-buy' };\n  const facilityFill = { id: 'fill-facility', quantity: 2, price: 500, total: 1_000, createdAt: now + 3, makerOrderId: 'sell-facility', takerOrderId: 'buy-facility' };\n  world.orders.push(\n    { id: 'sell-player', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'filled', remaining: 0, fills: [playerFill] },\n    { id: 'buy-player', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: 2, status: 'filled', remaining: 0, fills: [playerFill] },\n    { id: 'sell-cancelled', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'cancelled', quantity: 100, remaining: 65, fills: [cancelledFill] },\n    { id: 'buy-cancelled', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: 2, status: 'partial', remaining: 65, fills: [cancelledFill] },\n    { id: 'sell-unfilled', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'cancelled', quantity: 100, remaining: 100, fills: [] },\n    { id: 'sell-population', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'filled', remaining: 0, fills: [populationFill] },\n    { id: 'population-buy', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'population', ownerName: '食品市场需求', status: 'filled', remaining: 0, fills: [] },\n    { id: 'sell-facility', assetKind: 'facility', assetId: 'farm', facilityTypeId: 'farm', side: 'sell', ownerType: 'player', ownerId: 1, status: 'filled', remaining: 0, fills: [facilityFill] },\n    { id: 'buy-facility', assetKind: 'facility', assetId: 'farm', facilityTypeId: 'farm', side: 'buy', ownerType: 'player', ownerId: 3, status: 'filled', remaining: 0, fills: [facilityFill] },\n  );\n  world.collectibleAuctions = [{ id: 'auction-ignored', sellerId: 1, currentBid: 999_999, status: 'settled' }];\n\n  captureTradingFills(world, state, world.orders);\n\n  assert.equal(state.trading['1'].score, 113_000);\n  assert.equal(state.trading['1'].tradeCount, 4);\n  assert.equal(state.trading['2'].score, 0);\n  assert.equal(Object.keys(state.trading['1'].buyers).length, 2);\n  const snapshot = createLeaderboardSnapshot(world, 1, now + 4);\n  assert.equal(snapshot.boards.trading.unit, 'currency');\n  assert.equal(snapshot.boards.trading.currentPlayer.score, 113_000);\n});\n\ntest('legacy capped trading state is rebuilt once from current-period actual fills', () => {\n  const now = MONDAY_BEIJING + 60_000;\n  const world = createWorld(now);\n  const seller = addPlayer(world, 1, now);\n  addPlayer(world, 2, now);\n  processLeaderboardWorld(world, now);\n  const state = world.leaderboardState;\n  const fill = { id: 'legacy-fill', quantity: 20, price: 100, total: 2_000, createdAt: now, makerOrderId: 'legacy-sell', takerOrderId: 'legacy-buy' };\n  world.orders.push(\n    { id: 'legacy-sell', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: 1, status: 'cancelled', remaining: 5, fills: [fill] },\n    { id: 'legacy-buy', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: 2, status: 'filled', remaining: 0, fills: [fill] },\n  );\n  state.tradingRuleVersion = 1;\n  state.trading['1'] = { score: 300, tradeCount: 1, buyers: { 2: true } };\n  state.processedFillIds = { 'legacy-fill': now };\n  state.pairDayScores = { '1:2:2026-07-13': 300 };\n  seller.stats.marketSellScore = 300;\n  seller.stats.marketTradeCount = 1;\n\n  processLeaderboardWorld(world, now + 1);\n  assert.equal(state.tradingRuleVersion, 2);\n  assert.equal(state.trading['1'].score, 2_000);\n  assert.equal(state.trading['1'].tradeCount, 1);\n  assert.equal(seller.stats.marketSellScore, 2_000);\n  assert.equal(seller.stats.marketTradeCount, 1);\n  assert.equal(state.pairDayScores, undefined);\n\n  processLeaderboardWorld(world, now + 2);\n  assert.equal(state.trading['1'].score, 2_000);\n  assert.equal(seller.stats.marketSellScore, 2_000);\n});\n\n`;
  content = replaceRegex(
    content,
    /test\('trading board counts seller fills,[\s\S]*?\n\}\);\n\ntest\('three weekly boards/,
    `${tradingTests}test('three weekly boards`,
    'trading leaderboard tests',
  );
  write(path, content);
}

{
  const path = 'src/leaderboardTypes.ts';
  let content = read(path);
  content = replaceOnce(content, "timeZone: 'Asia/Taipei';", "timeZone: 'Asia/Shanghai';", 'client timezone type');
  write(path, content);
}

{
  const path = 'src/pages/LeaderboardPage.tsx';
  let content = read(path);
  content = content.replaceAll("timeZone: 'Asia/Taipei'", "timeZone: 'Asia/Shanghai'");
  content = replaceOnce(
    content,
    "    unit: id === 'growth' ? 'currency' : 'points',",
    "    unit: id === 'growth' || id === 'trading' ? 'currency' : 'points',",
    'trading fallback currency unit',
  );
  content = replaceOnce(
    content,
    'description="四榜并列展示；财富榜实时更新，增长榜、生产榜和交易榜按台北时间每周一 00:00 结算。"',
    'description="四榜并列展示；财富榜实时更新，增长榜、生产榜和交易榜按北京时间每周一 00:00 结算。"',
    'Beijing leaderboard page copy',
  );
  write(path, content);
}

{
  const path = 'scripts/verify-leaderboards.mjs';
  let content = read(path);
  content = replaceOnce(
    content,
    `check(server.includes("LEADERBOARD_TIME_ZONE = 'Asia/Taipei'"), 'weekly period must use Asia/Taipei');`,
    `check(server.includes("LEADERBOARD_TIME_ZONE = 'Asia/Shanghai'"), 'weekly period must use Beijing time');`,
    'timezone verifier',
  );
  content = replaceOnce(
    content,
    "check(server.includes('PLAYER_PAIR_DAILY_SCORE_LIMIT = 10_000'), 'player pair daily score cap must remain enabled');",
    "check(server.includes('function tradeGrossFor(fill)'), 'trading board must calculate gross volume from fills');\ncheck(server.includes('return quantity * price;'), 'trading board must use the full actual fill value');\ncheck(!server.includes('PLAYER_PAIR_DAILY_SCORE_LIMIT'), 'trading board must not cap actual sell volume by counterparty');\ncheck(server.includes(\"description: '本周订单簿实际卖出成交额'\"), 'trading board copy must describe actual sell volume');",
    'gross volume verifier',
  );
  content = replaceOnce(
    content,
    "check(productDesign.includes('首个不完整周'), 'product design must record partial-week behavior');",
    "check(productDesign.includes('首个不完整周'), 'product design must record partial-week behavior');\ncheck(productDesign.includes('撤单的未成交剩余数量不计入'), 'product design must exclude cancelled remainder');\ncheck(productDesign.includes('Asia/Shanghai'), 'product design must record Beijing leaderboard time');",
    'design verifier',
  );
  write(path, content);
}

{
  const path = 'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md';
  let content = read(path);
  content = replaceOnce(
    content,
    '- 增长榜、生产榜、交易榜按 `Asia/Taipei` 每周一 00:00 结算。',
    '- 增长榜、生产榜、交易榜按北京时间 `Asia/Shanghai` 每周一 00:00 结算。',
    'Beijing weekly period design',
  );
  content = replaceRegex(
    content,
    /### 7\.4 交易榜[\s\S]*?\n### 7\.5 结算与审计/,
    `### 7.4 交易榜\n\n交易榜只统计卖方在当前更新周期内通过统一订单簿完成的实际成交额，买方不重复获得同一笔成交成绩：\n\n\`\`\`text\n实际卖出成交额 += 成交记录数量 × 成交记录单价\n\`\`\`\n\n商品订单和工厂订单均按成交记录 \`fill\` 统计；玩家卖给玩家和玩家卖给市场需求均计入。成绩采用手续费扣除前的实际成交总额，统一订单簿卖出手续费仍正常扣除。未成交挂单不计入，撤单的未成交剩余数量不计入；订单撤销前已经生成的真实成交记录仍正常计入。买入成交额、合成行情、参考价格和拍卖成交均不计入交易榜。\n\n服务器按成交记录 ID 去重，同一成交不得因买卖双方各保存一份记录、轮询、重启或重复处理而重复计入。交易榜不再按商品基础价、工厂系统价值或交易对手设置积分上限。次级指标依次为实际成交笔数和不同玩家买家数量；市场需求成交不增加玩家买家数量。成绩单位为普通货币。\n\n权威周期状态保存交易榜规则版本。由旧封顶积分规则升级时，保留增长榜、生产榜及周期边界，只清空当前周期旧交易成绩和交易成交去重集合，并使用服务器仍保存的当前周期订单簿真实成交记录重新计算；升级完成后同一成交只能计入一次。\n\n### 7.5 结算与审计`,
    'transaction leaderboard design',
  );
  content = replaceOnce(
    content,
    '服务器另外维护生产积分、有效卖出积分、有效成交笔数、市场需求发行总额、系统回收、商店兑换货币累计值和排行榜奖励宝石累计值，用于周榜与审计。',
    '服务器另外维护生产积分、实际卖出成交额、实际成交笔数、市场需求发行总额、系统回收、商店兑换货币累计值和排行榜奖励宝石累计值，用于周榜与审计。',
    'transaction audit statistic wording',
  );
  write(path, content);
}

{
  const path = 'README.md';
  let content = read(path);
  content = replaceOnce(
    content,
    '- 商品和工厂估值均使用最近一次统一订单簿真实成交价；模拟历史、挂单、基础价、系统价值和拍卖价格不得参与估值，从未真实成交时估值为 0。',
    '- 商品和工厂估值均使用最近一次统一订单簿真实成交价；模拟历史、挂单、基础价、系统价值和拍卖价格不得参与估值，从未真实成交时估值为 0。\n- 增长榜、生产榜和交易榜按北京时间 `Asia/Shanghai` 每周一 00:00 结算；交易榜成绩等于周期内统一订单簿实际卖出成交额，撤单未成交剩余量、买入成交额和拍卖成交均不计入。',
    'README leaderboard rule',
  );
  write(path, content);
}

console.log('Applied Beijing-time gross sell-volume leaderboard changes.');
