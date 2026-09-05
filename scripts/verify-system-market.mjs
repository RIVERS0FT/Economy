import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];
function requireText(source, text, message) {
  if (!source.includes(text)) failures.push(message);
}
function forbidText(source, text, message) {
  if (source.includes(text)) failures.push(message);
}

const design = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
const systemMarket = read('server/src/system-market.js');
const balancedMarket = read('server/src/balanced-market.js');
const domain = read('server/src/domain.js');
const catalog = read('server/src/market-demand/catalog.js');
const autoBuy = read('server/src/online-auto-buy.js');
const autoSell = read('server/src/online-auto-sell.js');
const procurement = read('server/src/facility-auto-procure.js');
const marketPage = read('src/pages/MarketPage.tsx');
const marketRow = read('src/components/market/MarketCommodityRow.tsx');
const systemMarketTest = existsSync('server/test/system-market.test.js')
  ? read('server/test/system-market.test.js')
  : '';

for (const token of [
  '玩家商品交易不得创建 `open`／`partial` 商品订单',
  '北京时间每日 `00:00`',
  'todayBuyQuantity',
  'todaySellQuantity',
  'rawChangeBps = round(imbalance × 1000)',
  'clamp(rawChangeBps, -500, +500)',
  '基础价的 50%～300%',
  '`priceDateKey` 是每日调价幂等键',
  '`world.systemMarketAudit`',
  '不再维护 managed-order ID',
  '建厂一键购料不再读取真实卖盘深度',
  '价格输入框、价格加减按钮、卖 5～卖 1／买 1～买 5',
  '成功回执的 `message` 固定为空字符串',
]) requireText(design, token, `商品即时市场权威设计缺少规则：${token}`);

requireText(systemMarket, "import { dailyCheckInPeriodFor, checkInDateKey } from './daily-check-in.js'", '系统价格必须使用北京时间自然日工具。');
requireText(systemMarket, 'function settleImmediatePlayerTrade', '系统市场必须提供玩家即时结算。');
requireText(systemMarket, 'market.todayBuyQuantity', '系统市场必须累计当日玩家买量。');
requireText(systemMarket, 'market.todaySellQuantity', '系统市场必须累计当日玩家卖量。');
requireText(systemMarket, 'market.priceDateKey === period.todayKey', '每日价格推进必须使用 dateKey 幂等。');
requireText(systemMarket, 'const yesterdayKey = checkInDateKey(period.todayStartsAt - 1);', '离线跨日必须只接受真正昨天的成交计数。');
requireText(systemMarket, 'world.systemMarketAudit', '即时系统成交必须进入世界审计。');
requireText(systemMarket, "import { applyMarketSellFee } from './market-sell-fee.js'", '即时卖出必须复用 1% 市场服务费。');
requireText(balancedMarket, 'priceDateKey: period.todayKey', '新建市场必须绑定北京时间自然日。');
requireText(balancedMarket, 'nextPriceAt: period.nextResetAt', '新建市场下一调价必须是北京时间次日零点。');
requireText(domain, 'migrateLegacyPlayerCommodityOrders(migrated);', '世界迁移必须释放旧玩家商品挂单。');
requireText(domain, 'balancedMarket.settleImmediatePlayerTrade', '玩家商品写动作必须直接调用系统即时结算。');
requireText(domain, "status: 'filled'", '兼容成交记录必须直接落为 filled。');
requireText(domain, "message: ''", '玩家商品即时交易成功回执不得附带冗余成功文案。');
forbidText(domain, '已按今日系统价即时成交', '玩家商品即时交易不得恢复已删除的成功文案。');
forbidText(domain, "return { ok: true, message: '订单已进入订单簿' }", '玩家商品动作不得恢复开放订单返回值。');
requireText(catalog, 'SYSTEM_PRICE_CYCLE_MS = 24 * 60 * 60 * 1000', '系统价格常量必须按日表达。');
requireText(catalog, 'SYSTEM_PRICE_K_BPS = 1000', '每日价格失衡响应必须固定为 1000 bps。');
requireText(catalog, 'SYSTEM_PRICE_MAX_CHANGE_BPS = 500', '每日价格涨跌上限必须固定为 500 bps。');
requireText(read('server/src/cycle-auto-operation.js'), 'applySettledCommodityOrder', '周期采购必须走同一官方价即时结算。');
forbidText(autoBuy, 'managedOrder', '自动采购不得恢复托管挂单。');
requireText(read('server/src/cycle-auto-operation.js'), '.officialPrice', '周期出售必须读取正式官方价。');
forbidText(autoSell, 'managedOrder', '自动出售不得恢复托管挂单。');
requireText(procurement, 'quoteMissingAtDailyPrice', '建厂报价必须按今日系统价生成。');
requireText(procurement, 'applyImmediateCommodityBuy', '建厂缺料必须即时购买。');
forbidText(procurement, '继续挂在市场', '建厂购料不得留下剩余挂单。');

for (const token of [
  'className="order-entry market-trade-entry market-immediate-trade"',
  '今日成交量',
  '立即买入',
  '立即卖出',
  '成交记录',
]) requireText(marketPage, token, `地区市场必须展示即时交易字段：${token}`);
for (const token of ['今日成交价', '下次调价']) forbidText(marketPage, token, `地区市场不得恢复重复行情字段：${token}`);
for (const token of [
  'market-order-price',
  'market-order-book-title',
  '订单簿',
  '已有订单',
  '>撤单<',
  '有我的订单',
  '实时五档',
]) forbidText(marketPage, token, `地区市场不得恢复挂单 UI：${token}`);
requireText(marketRow, "{ label: '今日价格', sortKey: 'price' }", '商品目录必须展示今日价格列。');
forbidText(marketRow, "{ label: '卖单量'", '商品目录不得恢复卖单量列。');
forbidText(marketRow, "{ label: '买单量'", '商品目录不得恢复买单量列。');

for (const testName of [
  'manual sell executes immediately at the server daily price without creating a resting order',
  'manual buy executes immediately at the server daily price and ignores a client supplied price',
  'official price remains fixed during the same Asia Shanghai natural day',
  'Asia Shanghai midnight raises the daily price from yesterday buy pressure and resets daily counters',
  'balanced or zero yesterday volume does not move the next daily price',
  'daily system price is capped to five percent per day and base price 50 to 300 percent bounds',
  'stale volume older than yesterday is not applied after a multi-day offline gap',
  'migration cancels legacy resting player commodity orders and releases frozen assets',
]) {
  if (!systemMarketTest.includes(testName)) failures.push(`系统市场测试缺少：${testName}`);
}
requireText(systemMarketTest, "assert.equal(result.message, '');", '系统市场测试必须锁定即时交易成功文案为空。');

if (failures.length > 0) {
  console.error('每日系统价即时市场验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('每日系统价即时市场验证通过：玩家无挂单、成功回执无冗余文案、北京时间零点调价、±5% 日变动、旧冻结释放、自动经营与建厂购料均使用当日服务器价格。');
