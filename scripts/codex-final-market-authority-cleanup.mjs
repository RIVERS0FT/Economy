import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
}

function write(path, content) {
  writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);
}

function replaceOne(path, from, to) {
  const source = read(path);
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`${path}: missing replacement source: ${from.slice(0, 120)}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`${path}: replacement source is not unique: ${from.slice(0, 120)}`);
  write(path, source.replace(from, to));
}

function replaceRegexOne(path, pattern, to, label) {
  const source = read(path);
  const matches = [...source.matchAll(new RegExp(pattern.source, `${pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`}`))];
  if (matches.length !== 1) throw new Error(`${path}: expected exactly one ${label}, found ${matches.length}`);
  write(path, source.replace(pattern, to));
}

const pageDesign = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
replaceRegexOne(
  pageDesign,
  /起始州选择固定复用唯一常驻战略地图。[\s\S]*?避免第二套州选择状态源。\n\n/,
  '起始州选择已永久移除。登录后连续 48 州直接进入普通经营状态；地图不得根据 `startingProvinceChosen`、`chooseStartingProvince` 或任何候选州状态切换专用选点流程、隐藏正常导航或展示起始州概览。兼容字段只允许用于服务器旧存档迁移，不得重新成为玩家入口。\n\n',
  'legacy starting-province paragraph',
);
replaceRegexOne(
  pageDesign,
  /鼠标双击或触摸双触地图空白恢复默认相机，州面上的双击／双触不重置。[\s\S]*?一级全局市场通过商品全局详情中的地区行、一级建筑通过工厂类型下的地区工厂行钻取既有地区工作区，但不得恢复地区下拉框、按钮组、第二张地图或第二套地区状态。\n\n/,
  '鼠标双击或触摸双触地图空白恢复默认相机，州面上的双击／双触不重置。一旦一轮触摸出现双指，从多点手势开始到最后触点释放后的 `420ms` 内，必须抑制合成 click、州面误选和空白双触重置；该抑制只负责输入仲裁，不改变相机，窗口结束后的正常单指点击立即恢复。每个州面支持鼠标、触摸和键盘选择；单击后设置经营州并打开隐藏 `province` 上下文页，该页期间显示唯一州面高亮。连续 48 州不得按访问资格灰显、标注“未解锁”或展示解锁面板；所有州面使用同一经营交互。关闭州级页或进入其他页面后立即清除视觉高亮，但保留经营州供地区写操作使用。一级全局市场通过商品全局详情中的地区行、一级建筑通过工厂类型下的地区工厂行钻取既有地区工作区，但不得恢复地区下拉框、按钮组、第二张地图或第二套地区状态。\n\n',
  'legacy map access paragraph',
);
replaceOne(
  pageDesign,
  '不大于 `720px` 时镜头栏和地图 Tooltip 必须隐藏，普通经营状态触摸州面直接进入地区页，起始州选点模式则只更新候选；地图继续保持缩放和平移手势。',
  '不大于 `720px` 时镜头栏和地图 Tooltip 必须隐藏，触摸州面直接进入地区页；地图继续保持缩放和平移手势。',
);
replaceRegexOne(
  pageDesign,
  /`ProvincePage` 是地图州面的隐藏上下文页，[\s\S]*?并保持至少 `44px` 触控高度。\n\n/,
  '`ProvincePage` 是地图州面的隐藏上下文页，不进入桌面侧栏或移动底栏，也不改变十二个正式页面状态与十一项可见导航的产品边界。页面标题只显示当前州全称，外层必须复用概览、市场和建筑相同的 `building` 战略容器与共享 `PageLayout`，不得创建平行抽屉、弹窗或第二张页面外壳。连续 48 州统一使用“概览｜市场｜建筑｜仓库”四个互斥切换按钮；不存在未解锁州、解锁费用、解锁按钮或市场只读分支，地区写操作只受资金、库存、研发、合同、运输等对应业务自身正式约束。控件使用完整 `tablist`／`tab`／`tabpanel` 语义、方向键与 Home／End 键盘导航，并保持至少 `44px` 触控高度。\n\n',
  'legacy province unlock paragraph',
);
replaceOne(
  pageDesign,
  '概览只展示当前州库存、工厂、运行／异常与挂单摘要；',
  '概览只展示当前州库存、工厂、运行／异常与经营摘要；',
);
replaceOne(
  pageDesign,
  '商品和工厂按最近一次订单簿真实成交价估值，从未真实成交时显示 0。',
  '商品按各州当日官方系统价估值；工厂按最近一次真实产权成交价估值，从未发生真实产权成交时工厂估值显示 0。',
);

const pageVerifier = 'scripts/verify-page-content.mjs';
{
  let source = read(pageVerifier);
  const marker = '\nif (failures.length > 0) {';
  if (!source.includes(marker)) throw new Error(`${pageVerifier}: missing final failure marker`);
  if (!source.includes("'起始州选择已永久移除'")) {
    const guard = `\nfor (const text of [\n  '起始州选择已永久移除',\n  '连续 48 州不得按访问资格灰显',\n  '不存在未解锁州、解锁费用、解锁按钮或市场只读分支',\n  '概览只展示当前州库存、工厂、运行／异常与经营摘要',\n]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);\nfor (const text of [\n  '起始州选择固定复用唯一常驻战略地图',\n  '起始州选点模式则只更新候选',\n  '未解锁州灰显',\n  '新玩家首次进入游戏必须先按 3.1 的地图选点流程选择起始州',\n  '市场保持只读',\n  '州解锁按钮点击后',\n  '距永久起始州距离',\n  '概览只展示当前州库存、工厂、运行／异常与挂单摘要',\n]) forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);\n`;
    source = source.replace(marker, `${guard}${marker}`);
  }
  write(pageVerifier, source);
}

const chartVerifier = 'scripts/verify-market-chart.mjs';
replaceRegexOne(
  chartVerifier,
  /for \(const text of \[\n  '市场页的商品行情统一统计当前资产最近 24h',[\s\S]*?\]\) assert\.ok\(design\.includes\(text\), `页面设计文档缺少: \$\{text\}`\);/,
  `for (const text of [\n  '商品地区详情必须包含今日官方价格',\n  '近 24h 真实成交趋势',\n  '24h 成交量',\n  '浏览器本地最近成交',\n]) assert.ok(design.includes(text), \`页面设计文档缺少: \${text}\`);`,
  'legacy page-owned chart semantics block',
);

replaceOne(
  'scripts/verify-market-order-entry-compact.mjs',
  'console.log(\'市场即时交易数量控件验证通过：商品成交价只读取服务器当日价，玩家仅调整数量，快捷数量、交易总额、预计到账和只读州边界保持，价格输入与五档盘口不得恢复。\');',
  'console.log(\'市场即时交易数量控件验证通过：商品成交价只读取服务器当日价，连续 48 州均可交易，玩家仅调整数量，价格输入与五档盘口不得恢复。\');',
);

replaceOne(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '工厂估值 = Σ(总持有数量 × 最近一次订单簿真实成交价)',
  '工厂估值 = Σ(总持有数量 × 所在州最近一次真实产权成交价)',
);
replaceOne(
  'src/components/assets/AssetOverviewPanel.tsx',
  '商品和工厂按最近一次订单簿真实成交价估值',
  '商品按当日官方价、工厂按最近产权成交价估值',
);
replaceOne(
  'src/pages/LeaderboardPage.tsx',
  '按最近一次订单簿真实成交价计算资产毛值并扣除贷款负债后的实时净资产',
  '商品按当日官方价、工厂按最近产权成交价计算资产毛值并扣除贷款负债后的实时净资产',
);
replaceOne(
  'src/components/AdminPlayerStatistics.tsx',
  '商品与工厂只按最近一次订单簿真实成交价估值',
  '商品按当日官方价、工厂按最近产权成交价估值',
);
replaceOne(
  'src/components/AdminPlayerStatistics.tsx',
  '名玩家持有尚无真实成交估值的商品或工厂。',
  '名玩家持有尚无真实产权成交估值的工厂。',
);

const adminStats = 'server/src/player-admin-statistics.js';
replaceOne(
  adminStats,
  "function valuationPrice(world, kind, assetId, provinceId = DEFAULT_PROVINCE_ID) {\n  const marketKey = provinceScopedKey(provinceId, assetId);\n  const market = kind === 'facility' ? world?.facilityMarkets?.[marketKey] : world?.markets?.[marketKey];\n  return safeNonNegativeMoney(market?.lastTradePrice);\n}",
  "function valuationPrice(world, kind, assetId, provinceId = DEFAULT_PROVINCE_ID) {\n  const marketKey = provinceScopedKey(provinceId, assetId);\n  const market = kind === 'facility' ? world?.facilityMarkets?.[marketKey] : world?.markets?.[marketKey];\n  if (kind === 'commodity') return safeNonNegativeMoney(market?.officialPrice);\n  return safeNonNegativeMoney(market?.lastTradePrice);\n}",
);
replaceOne(
  adminStats,
  'const frozenQuantity = safeNonNegativeInteger(inventory?.frozen);\n    commodities += (availableQuantity + frozenQuantity) * price;',
  'const frozenQuantity = safeNonNegativeInteger(inventory?.frozen);\n    const inTransitQuantity = safeNonNegativeInteger(inventory?.inTransit);\n    commodities += (availableQuantity + frozenQuantity + inTransitQuantity) * price;',
);
replaceOne(adminStats, "['current-trade', '本周有订单簿成交', counts.currentTrade]", "['current-trade', '本周有市场成交', counts.currentTrade]");
replaceOne(adminStats, "{ id: 'active-no-trade', label: '7 日活跃但本周无订单簿成交', count: activeNoTrade, tone: 'neutral' }", "{ id: 'active-no-trade', label: '7 日活跃但本周无市场成交', count: activeNoTrade, tone: 'neutral' }");

const assetsVerifier = 'scripts/verify-assets-page.mjs';
{
  let source = read(assetsVerifier);
  const insertAfter = "  '冻结资产和抵押工厂仍归当前玩家所有并计入资产毛值；贷款负债从资产毛值中扣除形成净资产。',\n]) requireText(componentPath, text);";
  if (!source.includes(insertAfter)) throw new Error(`${assetsVerifier}: missing component requirement block`);
  source = source.replace(
    insertAfter,
    "  '冻结资产和抵押工厂仍归当前玩家所有并计入资产毛值；贷款负债从资产毛值中扣除形成净资产。',\n  '商品按当日官方价、工厂按最近产权成交价估值',\n]) requireText(componentPath, text);\nforbidText(componentPath, '商品和工厂按最近一次订单簿真实成交价估值');",
  );
  const designBlock = "  '不得恢复独立资产页',\n]) requireText(designPath, text);";
  if (!source.includes(designBlock)) throw new Error(`${assetsVerifier}: missing design requirement block`);
  source = source.replace(
    designBlock,
    "  '不得恢复独立资产页',\n  '商品按各州当日官方系统价估值；工厂按最近一次真实产权成交价估值',\n]) requireText(designPath, text);",
  );
  write(assetsVerifier, source);
}

const leaderboardVerifier = 'scripts/verify-leaderboards.mjs';
{
  let source = read(leaderboardVerifier);
  const pageMarker = "check(page.includes(\"const BOARD_ORDER: LeaderboardBoardId[] = ['wealth', 'growth', 'production', 'trading']\"), 'four boards must keep the approved order');";
  if (!source.includes(pageMarker)) throw new Error(`${leaderboardVerifier}: missing page marker`);
  source = source.replace(
    pageMarker,
    `${pageMarker}\ncheck(page.includes('商品按当日官方价、工厂按最近产权成交价计算资产毛值并扣除贷款负债后的实时净资产'), 'wealth fallback copy must match authoritative commodity and facility valuation');\ncheck(!page.includes('按最近一次订单簿真实成交价计算资产毛值'), 'wealth fallback copy must not restore commodity order-book valuation');`,
  );
  const productMarker = "check(productDesign.includes('即时交易没有未成交挂单或撤单剩余量'), 'product design must record that player commodity trading has no unfilled remainder');";
  if (!source.includes(productMarker)) throw new Error(`${leaderboardVerifier}: missing product marker`);
  source = source.replace(
    productMarker,
    `${productMarker}\ncheck(productDesign.includes('商品估值 = Σ((可用数量 + 冻结数量) × 所在州当日官方系统价)'), 'product design must value commodities at the current regional official price');\ncheck(productDesign.includes('工厂估值 = Σ(总持有数量 × 所在州最近一次真实产权成交价)'), 'product design must keep facility valuation separate from commodity official prices');`,
  );
  write(leaderboardVerifier, source);
}

const adminVerifier = 'scripts/verify-admin-player-statistics.mjs';
{
  let source = read(adminVerifier);
  const serverMarker = "  'wealthAssetsFor',\n  'lastEconomicActivityAt',";
  if (!source.includes(serverMarker)) throw new Error(`${adminVerifier}: missing server requirement marker`);
  source = source.replace(
    serverMarker,
    "  'wealthAssetsFor',\n  \"if (kind === 'commodity') return safeNonNegativeMoney(market?.officialPrice);\",\n  'const inTransitQuantity = safeNonNegativeInteger(inventory?.inTransit);',\n  'lastEconomicActivityAt',",
  );
  const componentMarker = "  '财富分布',\n  '需要关注的玩家群体',";
  if (!source.includes(componentMarker)) throw new Error(`${adminVerifier}: missing component requirement marker`);
  source = source.replace(
    componentMarker,
    "  '财富分布',\n  '商品按当日官方价、工厂按最近产权成交价估值',\n  '需要关注的玩家群体',",
  );
  const forbidMarker = "forbidText('src/components/AdminPlayerStatistics.tsx', ['function RatioBar', 'admin-player-statistics__trend-bars']);";
  if (!source.includes(forbidMarker)) throw new Error(`${adminVerifier}: missing component forbid marker`);
  source = source.replace(
    forbidMarker,
    "forbidText('src/components/AdminPlayerStatistics.tsx', ['function RatioBar', 'admin-player-statistics__trend-bars', '商品与工厂只按最近一次订单簿真实成交价估值']);",
  );
  write(adminVerifier, source);
}

for (const temp of [
  'scripts/codex-final-market-authority-cleanup.mjs',
  '.github/workflows/codex-final-market-authority-cleanup.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
