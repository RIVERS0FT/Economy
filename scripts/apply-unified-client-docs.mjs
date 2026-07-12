import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content);
function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Missing ${label}`);
  return content.replace(before, after);
}
function appendOnce(path, marker, content) {
  const current = read(path);
  if (!current.includes(marker)) write(path, current.trimEnd() + '\n\n' + content.trim() + '\n');
}

let main = read('src/main.tsx');
main = replaceOnce(main, "import './styles/warehouse-expansion.css';", "import './styles/warehouse-expansion.css';\nimport './styles/unified-market-admin.css';", 'main style import');
write('src/main.tsx', main);

let assets = read('src/pages/AssetsPage.tsx');
assets = assets.replace('按各商品最近成交价和工厂类型数量估值计算', '商品和工厂均按订单簿最高有效买入价估值');
assets = assets.replace('detail={`${totalFacilities} 座，按类型数量与系统估值计算`}', 'detail={`${totalFacilities} 座，按各类型最高有效买价计算`}');
assets = assets.replace("const price = game.markets[product.id]?.lastPrice ?? product.basePrice;", "const price = game.valuationPrices[`commodity:${product.id}`] ?? 0;");
assets = assets.replace('参考价 ¤ {price}', '估值买价 ¤ {price || \'--\'}');
assets = assets.replace(/\n\s*<Panel className="widget">\s*<WidgetHeading title="货币发行与回收" \/>[\s\S]*?<\/Panel>\n/, '\n');
write('src/pages/AssetsPage.tsx', assets);

let activity = read('src/utils/localActivityStore.ts');
activity = activity.replace("  | 'resetPlayer';", "  | 'resetPlayer'\n  | 'redeemGift';");
activity = activity.replace("  resetPlayer: 'system',", "  resetPlayer: 'system',\n  redeemGift: 'system',");
activity = activity.replace('  markets: Record<string, LocalMarketSnapshot>;\n}', '  markets: Record<string, LocalMarketSnapshot>;\n  facilityMarkets: Record<string, LocalMarketSnapshot>;\n}');
activity = activity.replace("    markets: Object.fromEntries(\n      Object.entries(state.markets).map(([productId, market]) => [productId, { lastPrice: market.lastPrice }]),\n    ),", "    markets: Object.fromEntries(\n      Object.entries(state.markets).map(([productId, market]) => [productId, { lastPrice: market.lastPrice }]),\n    ),\n    facilityMarkets: Object.fromEntries(\n      Object.entries(state.facilityMarkets).map(([typeId, market]) => [typeId, { lastPrice: market.lastPrice }]),\n    ),");
const tradeStart = activity.indexOf('function deriveCommodityTrades(');
const inferStart = activity.indexOf('function inferCategory(', tradeStart);
if (tradeStart < 0 || inferStart < 0) throw new Error('Missing local trade derivation block');
const unifiedTrades = `function deriveAssetTrades(\n  before: LocalStateSnapshot,\n  after: LocalStateSnapshot,\n  createdAt: number,\n): TradeRecord[] {\n  const previousById = new Map(before.orders.map((order) => [order.id, order]));\n  const records: TradeRecord[] = [];\n  for (const order of after.orders) {\n    if (order.ownerId !== after.userId) continue;\n    const previousRemaining = previousById.get(order.id)?.remaining ?? order.quantity;\n    const executedQuantity = Math.max(0, previousRemaining - order.remaining);\n    if (!executedQuantity) continue;\n    const kind = order.assetKind === 'facility' || order.facilityTypeId ? 'facility' : 'commodity';\n    const assetId = order.assetId ?? order.facilityTypeId ?? order.productId ?? 'grain';\n    const price = kind === 'facility'\n      ? after.facilityMarkets[assetId]?.lastPrice ?? order.price\n      : after.markets[assetId]?.lastPrice ?? order.price;\n    const name = kind === 'facility' ? facilityName(assetId) : productName(after, assetId);\n    records.push({\n      id: createId('local-trade'),\n      type: kind,\n      productId: kind === 'commodity' ? assetId : undefined,\n      facilityTypeId: kind === 'facility' ? assetId : undefined,\n      side: order.side,\n      quantity: executedQuantity,\n      price,\n      total: executedQuantity * price,\n      counterparty: '订单簿成交',\n      createdAt,\n      description: \`${'${order.side === \'buy\' ? \'买入\' : \'卖出\'}'} ${'${name}'}\`,\n    });\n  }\n  return records;\n}\n\n`;
activity = activity.slice(0, tradeStart) + unifiedTrades + activity.slice(inferStart);
activity = activity.replace("  const trades = [\n    ...deriveCommodityTrades(before, after, createdAt),\n    ...deriveFacilityTrades(before, after, context.action, createdAt),\n  ];", "  const trades = deriveAssetTrades(before, after, createdAt);");
write('src/utils/localActivityStore.ts', activity);

for (const testPath of ['server/test/asset-events.test.js', 'server/test/storage-authority.test.js']) {
  try {
    let testContent = read(testPath);
    testContent = testContent.replaceAll('version 8', 'version 9').replaceAll('state.version, 8', 'state.version, 9').replaceAll('version: 8', 'version: 9');
    write(testPath, testContent);
  } catch { /* optional test */ }
}

const verifier = `import { existsSync, readFileSync } from 'node:fs';\nimport { resolve } from 'node:path';\nconst root = process.cwd();\nconst read = (path) => readFileSync(resolve(root, path), 'utf8');\nconst failures = [];\nconst requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push('缺少文件: ' + path); };\nconst requireText = (path, text) => { if (!read(path).includes(text)) failures.push(path + ' 缺少: ' + text); };\nconst forbidText = (path, text) => { if (read(path).includes(text)) failures.push(path + ' 不应包含: ' + text); };\n[\n  'src/pages/MarketPage.tsx','src/pages/ProductionPage.tsx','src/pages/SettingsPage.tsx','src/app/AdminApp.tsx',\n  'src/api/admin.ts','src/styles/unified-market-admin.css','server/src/facility-groups.js','server/src/storage.js',\n  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md','docs/GIFT_CODE_AND_ADMIN_DESIGN.md'\n].forEach(requireFile);\nfor (const text of ['unified-asset-tabs','placeAssetOrder','single-order-book','order-book-divider','localTrades.map']) requireText('src/pages/MarketPage.tsx', text);\nfor (const text of ['market-stat-strip','工厂数量市场','仅保存在当前浏览器；更换设备或清除网站数据后不会恢复。']) forbidText('src/pages/MarketPage.tsx', text);\nfor (const text of ['facility-power-button','卖单冻结','前往市场交易该工厂']) requireText('src/pages/ProductionPage.tsx', text);\nfor (const text of ['产成品去向','挂牌数量','单座价格','启动全部未挂牌工厂','停止全部']) forbidText('src/pages/ProductionPage.tsx', text);\nfor (const text of ['点击工作次数','生产商品总数','买入商品总数','卖出商品总数','礼品兑换','退出登录','重置经济状态']) requireText('src/pages/SettingsPage.tsx', text);\nfor (const text of ['登录会话','重置服务器经济状态']) forbidText('src/pages/SettingsPage.tsx', text);\nfor (const text of ["label: '仓库剩余'", "id: 'warehouse'"]) requireText('src/app/GameApp.tsx', text);\nfor (const text of ["id: 'inventory'", "id: 'market'", '成交</>)]) forbidText('src/app/GameApp.tsx', text);\nfor (const text of ['assetKind','matchFacilityOrder','reduceRunningGroupForSellOrder','valuationPricesFor','bestBidFor','world.version = 5']) requireText('server/src/facility-groups.js', text);\nfor (const text of ['workCooldownMs: 10_000','workClicks','boughtGoods','soldGoods']) requireText('server/src/domain.js', text);\nfor (const text of ['economy_gift_codes','economy_gift_redemptions','requireAdmin','getAdminSummary']) requireText('server/src/storage.js', text);\nif (failures.length) { console.error('统一资产市场与管理功能验证失败:\\n- ' + failures.join('\\n- ')); process.exit(1); }\nconsole.log('统一资产市场、10 秒工作冷却、玩家统计、礼品兑换和管理员页面验证通过。');\n`;
write('scripts/verify-page-content.mjs', verifier);
write('scripts/verify-ui-architecture.mjs', verifier);
write('scripts/verify-market-assets.mjs', verifier);
write('scripts/verify-facility-groups-market-v3.mjs', verifier);

const orderBookDesign = `# Economy 统一资产订单簿设计\n\n> 状态：商品与工厂交易的当前权威设计  \n> 更新时间：2026-07-12  \n> 客户端状态版本：9  \n> 世界状态版本：5\n\n## 核心规则\n\n商品和工厂都使用同一套限价订单结构、价格优先、同价时间优先、部分成交、禁止自成交和撤单释放冻结资产规则。市场不设置商品／工厂二级切换，也不保留工厂固定价格挂牌卡。资产标签在同一横向目录中连续展示。\n\n工厂运行中允许提交卖单。服务器先结算已经完成的完整周期，再从当前参与数量、待加入数量的顺序冻结工厂；冻结数量立即停止产生商品和运营成本。撤销运行中卖单时，剩余数量进入 pendingJoinCount，从下一周期加入。\n\n商品与工厂估值均使用各自订单簿最高有效买入价，并排除资产所有者自己的买单；没有非本人有效买单时估值为 0。总资产和排行榜必须由服务器统一计算。\n\n订单簿固定显示卖盘最低价前 5 笔、中性分隔线、买盘最高价前 5 笔。市场顶部不得恢复买一、卖一、价差、可用持仓和仓库剩余指标卡。\n`;
write('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', orderBookDesign);

const giftDesign = `# Economy 礼品兑换与管理员设计\n\n> 状态：礼品码和管理员后台的当前权威设计  \n> 更新时间：2026-07-12\n\n## 礼品兑换\n\n设置页提供独立礼品兑换卡。兑换码规范化后只以 SHA-256 哈希保存；同一账号对同一礼品只能兑换一次，并受启用状态、开始时间、过期时间和最大次数限制。兑换与资金增加、giftIssued 统计及兑换记录必须在同一 SQLite 事务内完成。\n\n## 管理员后台\n\n管理员地址固定为 https://game.riversoft.top/economy/admin。普通主导航不显示管理员入口，设置页仅对 role=admin 显示入口。所有 /api/game/admin/ 接口必须由服务器再次校验管理员角色，普通用户返回 403。\n\n首版后台只提供世界概况和礼品码创建、停用、兑换记录，不提供任意修改玩家资金、删除玩家或编辑世界 JSON。管理员写操作必须使用 Idempotency-Key。\n`;
write('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', giftDesign);

const unifiedSection = `## 统一资产订单簿与玩家系统（2026-07-12）\n\n- 商品和工厂共用同一限价订单簿，不再使用工厂固定价格挂牌或商品／工厂二级切换。\n- 商品与工厂估值使用最高非本人有效买入价，服务器统一计算总资产和排行榜。\n- 运行中工厂允许进入卖单，冻结数量立即减少当前参与数量和周期产量。\n- 工作冷却固定为 10 秒，连续工作不再提高冷却。\n- 玩家资料统计固定为点击工作次数、生产商品总数、买入商品总数、卖出商品总数。\n- 状态栏固定显示可用资金、总资产、排行榜和仓库剩余。\n- 设置页玩家资料卡包含统计、退出和重置；侧栏退出按钮保留；设置页增加礼品兑换。\n- 管理员页面固定为 /economy/admin。\n- 详细规则以 docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md 和 docs/GIFT_CODE_AND_ADMIN_DESIGN.md 为准。\n`;
for (const path of [
  'README.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md',
  'docs/WEB_MULTIPLAYER_GAME_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
]) appendOnce(path, '统一资产订单簿与玩家系统（2026-07-12）', unifiedSection);

rmSync('server/.unified-server-trigger', { force: true });
rmSync('scripts/apply-unified-client-docs.mjs');
rmSync('.github/workflows/apply-unified-client-docs.yml');
console.log('Unified client and documentation patches applied.');
