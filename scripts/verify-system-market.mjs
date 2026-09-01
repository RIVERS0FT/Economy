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
const index = read('docs/README.md');
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const balancedMarket = read('server/src/balanced-market.js');
const systemMarket = read('server/src/system-market.js');
const domain = read('server/src/domain.js');
const catalog = read('server/src/market-demand/catalog.js');
const storageV2 = read('server/src/world-storage-v2.js');
const types = read('src/types.ts');
const marketPage = read('src/pages/MarketPage.tsx');
const globalMarketPage = read('src/pages/GlobalMarketPage.tsx');
const systemMarketTest = existsSync('server/test/system-market.test.js')
  ? read('server/test/system-market.test.js')
  : '';

requireText(design, '## 官方系统价市场', '订单簿权威设计必须记录官方系统价市场章节。');
requireText(design, '官方系统价 `officialPrice`', '订单簿权威设计必须定义官方系统价。');
requireText(design, '玩家商品买单价格恰好等于官方系统价', '订单簿权威设计必须记录买单实时供给。');
requireText(design, '玩家商品卖单价格恰好等于官方系统价', '订单簿权威设计必须记录卖单实时收购。');
requireText(design, 'cycleBuyQuantity', '订单簿权威设计必须记录系统卖出量计数器。');
requireText(design, 'cycleSellQuantity', '订单簿权威设计必须记录系统买入量计数器。');
requireText(design, 'MAX_CHANGE_BPS = 50', '订单簿权威设计必须固定单周期最大价格变化。');
requireText(design, '玩家间每笔成交同时包含买卖双方，不得计入系统买卖比', '订单簿权威设计必须排除玩家间成交。');
requireText(design, 'world.systemMarketAudit', '订单簿权威设计必须记录系统成交审计。');
requireText(design, '人口消费订单和市场储备订单不是官方系统价的对手方', '订单簿权威设计必须限定系统只与玩家清算。');
requireText(design, '只清算恰好等于新系统价的玩家订单', '订单簿权威设计必须锁定精确相等清算。');
requireText(index, 'scripts/verify-system-market.mjs', '设计索引必须登记系统市场验证脚本。');
requireText(productDesign, '每个州×商品维护唯一官方系统价', '产品设计必须记录官方系统价市场。');
requireText(serverDesign, 'world.systemMarketAudit', '服务器设计必须记录系统成交审计 segment。');

requireText(balancedMarket, 'createSystemMarketRuntime', '平衡市场运行时必须组合官方系统价市场。');
requireText(balancedMarket, 'officialPrice: product.basePrice', '新建市场必须初始化官方系统价。');
requireText(systemMarket, 'settlePlayerOrderWithSystem', '系统市场模块必须提供实时清算。');
requireText(systemMarket, 'processPriceCycles', '系统市场模块必须提供价格周期推进。');
requireText(systemMarket, 'if (Number(order.price) !== price) return 0;', '系统清算必须只接受恰好等于官方系统价的订单。');
requireText(systemMarket, 'SYSTEM_PRICE_K_BPS', '系统价格公式必须读取正式 K 常量。');
requireText(systemMarket, 'SYSTEM_PRICE_MAX_CHANGE_BPS', '系统价格公式必须读取正式变化上限。');
requireText(systemMarket, 'SYSTEM_PRICE_LIQUIDITY_BASELINE', '系统价格公式必须使用虚拟流动性基线。');
requireText(systemMarket, 'world.systemMarketAudit', '系统成交必须写入世界级审计。');
requireText(systemMarket, "import { applyMarketSellFee } from './market-sell-fee.js'", '系统卖单必须复用统一累计卖出手续费。');
requireText(domain, 'settlePlayerOrderWithSystem(world, incoming, now)', '商品订单动作必须实时执行系统清算。');
requireText(domain, 'balancedMarket.processPriceCycles(world, now)', '世界推进必须执行官方系统价价格周期。');
requireText(catalog, 'SYSTEM_PRICE_CYCLE_MS', '系统价格周期常量必须由正式目录提供。');
requireText(catalog, 'SYSTEM_PRICE_K_BPS = 100', '系统价格 K 常量必须锁定。');
requireText(catalog, 'SYSTEM_PRICE_MAX_CHANGE_BPS = 50', '系统价格变化上限必须锁定。');
requireText(storageV2, "'systemMarketAudit'", '系统成交审计必须进入世界顶层 segment 持久化。');
requireText(types, 'officialPrice?: number;', '客户端类型必须声明官方系统价。');
requireText(types, 'cycleSellQuantity?: number;', '客户端类型必须声明周期系统买入量。');

requireText(marketPage, "const marketPrice = typeof market?.officialPrice === 'number' ? market.officialPrice : undefined", '地区商品目录必须使用官方系统价作为市场价。');
requireText(globalMarketPage, "if (typeof market?.officialPrice === 'number') officialPrices.push(market.officialPrice);", '一级市场商品目录必须从已解锁地区官方系统价生成市场价摘要。');
requireText(globalMarketPage, "const marketPrice = typeof market?.officialPrice === 'number' ? market.officialPrice : undefined;", '商品全局详情地区行必须读取该地区官方系统价。');
requireText(globalMarketPage, "{ label: '市场价', sortKey: 'market-price', defaultDirection: 'desc' }", '一级市场商品目录必须展示市场价列。');
requireText(pageDesign, '地区商品详情不再显示“生产者与消费者”关系卡，也不再渲染基本面条。顶部只显示真实 24h 变化和当前可用库存；市场价、基准偏离、需求满足率、参考价与上轮需求不得在地区详情恢复。', '页面设计必须明确官方系统价只保留在目录／地区行，不回到地区商品详情顶部。');
forbidText(marketPage, 'market-detail-hero__market-price', '地区商品详情不得恢复独立市场价指标。');

if (!systemMarketTest.includes('player sell order at exactly the system price is fully bought by the system in real time')) {
  failures.push('系统市场测试必须覆盖卖单实时清算。');
}
if (!systemMarketTest.includes('player buy order at exactly the system price is fully supplied by the system in real time')) {
  failures.push('系统市场测试必须覆盖买单实时供给。');
}
if (!systemMarketTest.includes('price cycle clears every resting player order at the new exact price and not adjacent ticks')) {
  failures.push('系统市场测试必须覆盖调价瞬间精确价格清算。');
}
if (!systemMarketTest.includes('system price stays within the base price 50% to 300% bounds')) {
  failures.push('系统市场测试必须覆盖价格边界。');
}
if (!systemMarketTest.includes('price cycle never clears population consumption orders')) {
  failures.push('系统市场测试必须覆盖人口订单不被系统清算。');
}

if (failures.length > 0) {
  console.error('官方系统价市场验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('官方系统价市场验证通过：实时精确清算、买卖对称供给、五分钟买卖量调价、价格边界与系统成交审计均已锁定；官方系统价继续用于目录市场价，但不回到地区商品详情顶部。');
