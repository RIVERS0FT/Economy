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
  const path = 'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md';
  let content = read(path);
  content = replaceOnce(
    content,
    '- 增长榜、生产榜、交易榜按 `Asia/Taipei` 每周一 00:00 结算。',
    '- 增长榜、生产榜、交易榜按北京时间 `Asia/Shanghai` 每周一 00:00 结算。',
    'Beijing weekly leaderboard period',
  );
  content = replaceRegex(
    content,
    /### 7\.4 交易榜[\s\S]*?\n### 7\.5 结算与审计/,
    `### 7.4 交易榜\n\n交易榜只统计卖方在当前更新周期内通过统一订单簿完成的实际卖出成交额，买方不重复获得同一笔成交成绩：\n\n\`\`\`text\n实际卖出成交额 += 成交记录数量 × 成交记录单价\n\`\`\`\n\n商品订单和工厂订单均按服务器成交记录 \`fill\` 统计；玩家卖给玩家和玩家卖给市场需求均计入。成绩采用手续费扣除前的实际成交总额，统一订单簿卖出手续费仍正常扣除。未成交挂单不计入，撤单的未成交剩余数量不计入；订单撤销前已经生成的真实成交记录仍正常计入。买入成交额、合成行情、参考价格和拍卖成交均不计入交易榜。\n\n服务器按成交记录 ID 去重，同一成交不得因买卖双方各保存一份记录、轮询、重启或重复处理而重复计入。交易榜不再按商品基础价、工厂系统价值或交易对手设置积分上限。次级指标依次为实际成交笔数和不同玩家买家数量；市场需求成交不增加玩家买家数量。成绩单位为普通货币。\n\n权威周期状态保存 \`tradingRuleVersion\`。由旧封顶积分规则升级时，保留增长榜、生产榜、周期边界和历史结算，只清空当前周期旧交易成绩、旧成交去重集合与旧交易对手上限状态，并使用服务器仍保存的当前周期卖单真实成交记录重新计算。迁移只改变排行榜统计，不得改变玩家资产、订单成交结果或手续费；升级完成后同一成交只能计入一次。\n\n### 7.5 结算与审计`,
    'transaction leaderboard rules',
  );
  content = replaceOnce(
    content,
    '服务器另外维护生产积分、有效卖出积分、有效成交笔数、市场需求发行总额、系统回收、商店兑换货币累计值和排行榜奖励宝石累计值，用于周榜与审计。',
    '服务器另外维护生产积分、实际卖出成交额、实际成交笔数、市场需求发行总额、系统回收、商店兑换货币累计值和排行榜奖励宝石累计值，用于周榜与审计。',
    'transaction audit statistics',
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

{
  const path = 'scripts/verify-leaderboards.mjs';
  let content = read(path);
  content = replaceOnce(
    content,
    "const leaderboardDesign = read('docs/LEADERBOARD_DESIGN.md');",
    "const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');",
    'canonical leaderboard design source',
  );
  content = content.replaceAll('leaderboardDesign.includes', 'productDesign.includes');
  content = content.replaceAll('leaderboard design must', 'product design must');
  write(path, content);
}

console.log('Merged leaderboard rules into canonical product design.');
