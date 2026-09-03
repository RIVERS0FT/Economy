import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);

function replaceText(path, from, to) {
  if (!existsSync(path)) return false;
  const source = read(path);
  if (!source.includes(from)) return false;
  write(path, source.replace(from, to));
  return true;
}

function replaceRegex(path, pattern, replacement) {
  if (!existsSync(path)) return false;
  const source = read(path);
  if (!pattern.test(source)) return false;
  write(path, source.replace(pattern, replacement));
  return true;
}

const immediateProductRule = '每个州×商品维护唯一官方系统价：玩家商品买卖只提交方向与数量，由服务器按当日 `officialPrice` 即时全量结算；官方系统价在 `Asia/Shanghai` 一个自然日内固定不变，北京时间每日 00:00 根据前一自然日玩家从系统买入量与向系统卖出量的失衡统一调整，单日涨跌绝对值最多 5%，并始终限制在商品基础价 50%～300%。玩家商品交易不创建开放挂单、不冻结等待成交资产、不展示五档盘口，内部人口／储备订单继续仅服务服务器经济模拟。规则细节以 `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` 为准。';
replaceRegex(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  /世界 31 起，每个州×商品维护唯一官方系统价：[^\n]*\n/,
  `${immediateProductRule}\n`,
);

const pageDetailRule = '商品地区详情必须包含今日官方价格、买入／卖出方向、数量、快捷数量、交易总额和即时提交、近 24h 真实成交趋势、今日／24h 成交量、下一北京时间 00:00 调价时间，以及按当前商品过滤的浏览器本地最近成交。玩家不能输入成交价格；页面不得渲染五档盘口、已有订单、撤单、“有我的订单”筛选或挂单／成交切换。卖出方向继续常驻显示按整笔即时成交估算的“预计到账”，服务器按真实成交结算 1% 市场服务费。';
replaceRegex(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  /商品详情必须包含买入／卖出方向、价格、数量、快捷仓位[\s\S]*?详情中的“已有订单”只逐单展示当前资产的 `open`／`partial` 本人订单。/,
  pageDetailRule,
);
replaceText(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '市场无论解锁状态都允许查看商品目录、行情和订单簿',
  '市场无论解锁状态都允许查看商品目录、今日价格和真实成交行情',
);
replaceText(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '商品列表通过“有我的订单”筛选提供发现入口',
  '商品列表不提供“有我的订单”筛选',
);

const warehouseAutoRule = '在线自动经营只在目录、玩家资产、生产、市场官方价或合同相关权威状态变化时重新判断；纯经济事件、银行、签到、研发计时或排行榜变化不得触发自动经营扫描。维护候选只遍历工厂策略派生后实际启用采购／出售的商品。自动采购在当日 `officialPrice` 不高于采购上限时，根据生产预定、合同可用保留、目标自由库存、当前可用库存和可用资金计算即时采购量；自动出售在当日 `officialPrice` 不低于出售下限时，根据当前可用库存、生产预定、合同可用保留和最低自由库存计算即时出售量。两者直接调用服务器权威即时交易，不创建 managed-order ID、不冻结等待成交资产、不撤旧单重挂，也不依赖 `market.orders` 识别托管单或交叉单；离线期间仍不新增后台交易循环。';
replaceRegex(
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  /在线自动经营维护器只在 `catalog`[\s\S]*?不能把在线客户端维护器升级为本地权威交易引擎。/,
  warehouseAutoRule,
);
replaceText(
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  '目标自动买单剩余量 = min(自动采购需求量, 资金可负担数量)',
  '即时自动采购数量 = min(自动采购需求量, 当日官方价下资金可负担数量)',
);

const buildProcurementRule = '建厂一键购料使用建厂地区各缺失材料的当日 `officialPrice` 生成服务器报价与价格保护，不读取玩家卖盘深度，也不创建 FOK 或普通商品挂单。正式执行时服务器重新读取当日价、数量、资金和总价保护；任一材料超过保护值或资金不足时整个事务失败，全部校验通过后所有缺失材料在同一事务内按官方价即时买入并继续建厂，不留下待成交订单。';
replaceRegex(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  /[^\n]*建厂一键购料[^\n]*(?:\n(?!\n)[^\n]*)*/,
  buildProcurementRule,
);

replaceText(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '商品订单写动作在真实订单簿撮合完成后执行官方系统价实时清算；世界推进在市场需求周期结算后推进每州×商品的官方系统价价格周期，并把 `world.systemMarketAudit` 作为顶层 segment 随事务持久化（该 segment 只用于服务器审计，不进入六分区或普通玩家状态）。',
  '玩家商品写动作不再进入开放订单簿：服务器在事务内读取州×商品当日 `officialPrice` 并即时结算资金与地区库存，兼容成交记录直接为 `filled`。世界截止时间调度器把北京时间每日 00:00 作为官方商品价换日边界，只使用真正前一自然日的玩家↔系统买卖量失衡计算新价；`world.systemMarketAudit` 继续作为顶层 segment 随事务持久化且只用于服务器审计。服务器内部人口／储备订单撮合与玩家即时交易严格分离，普通玩家市场状态不得下发内部订单深度。',
);

const marketPageLayoutVerifier = `import { readFileSync } from 'node:fs';\n\nconst read = (path) => readFileSync(path, 'utf8');\nconst page = read('src/pages/MarketPage.tsx');\nconst style = read('src/styles/market-page-polish.css');\nconst design = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');\nconst required = [\n  'function MarketImmediateTradeEntry({',\n  'market-immediate-trade',\n  'market-quantity-stepper',\n  'order-quick-fill',\n  '今日成交价',\n  '今日成交量',\n  '下次调价',\n  '立即买入',\n  '立即卖出',\n  'market-account-panel',\n];\nfor (const text of required) { if (!page.includes(text)) throw new Error('即时市场页面缺少: ' + text); }\nfor (const text of ['market-order-book-title', 'orderBook.bids', 'orderBook.asks', 'market-order-price', '已有订单', '实时五档', 'market-compact-view-switch']) {\n  if (page.includes(text)) throw new Error('即时市场页面不得恢复: ' + text);\n}\nfor (const text of ['.market-page-surface .market-stepper__button {', '.market-submit-order']) { if (!style.includes(text)) throw new Error('市场样式缺少: ' + text); }\nfor (const text of ['玩家商品页面永久移除：价格输入框', '地区商品详情只展示当前商品身份、今日价格']) { if (!design.includes(text)) throw new Error('市场设计缺少: ' + text); }\nconsole.log('市场页面布局验证通过：地区商品详情只保留当日价即时交易、数量控件、行情与最近成交，禁止恢复五档和自定义价格。');\n`;
write('scripts/verify-market-page-layout.mjs', marketPageLayoutVerifier);

const hierarchyVerifier = `import { readFileSync } from 'node:fs';\nconst read = (path) => readFileSync(path, 'utf8');\nconst globalPage = read('src/pages/GlobalMarketPage.tsx');\nconst regionalPage = read('src/pages/MarketPage.tsx');\nconst row = read('src/components/market/MarketCommodityRow.tsx');\nconst design = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');\nfor (const text of ['商品目录 → 商品全局详情 → 地区商品详情', '商品地区详情必须包含今日官方价格']) { if (!design.includes(text)) throw new Error('页面层级设计缺少: ' + text); }\nfor (const text of [\"{ label: '今日价格', sortKey: 'price' }\", \"{ label: '24h成交量', sortKey: 'volume24h' }\", \"{ label: '24h价格变化', sortKey: 'trend' }\"]) { if (!row.includes(text)) throw new Error('商品目录列缺少: ' + text); }\nfor (const text of [\"{ label: '24h成交量', sortKey: 'volume24h'\", \"{ label: '今日价格', sortKey: 'market-price'\", \"{ label: '24h价格变化', sortKey: 'price-change24h'\"]) { if (!globalPage.includes(text)) throw new Error('全局商品目录列缺少: ' + text); }\nfor (const text of ['sellVolume', 'buyVolume', 'ownOpenOrderCount', '有我的订单']) { if (globalPage.includes(text)) throw new Error('全局商品目录不得恢复挂单字段: ' + text); }\nfor (const text of ['即时交易', '今日成交价', '最近成交']) { if (!regionalPage.includes(text)) throw new Error('地区商品详情缺少: ' + text); }\nconsole.log('市场信息层级验证通过：全局和地区目录只展示今日价格与真实成交信息，地区详情进入即时交易。');\n`;
write('scripts/verify-market-information-hierarchy.mjs', hierarchyVerifier);

const integerVerifier = `import { readFileSync } from 'node:fs';\nconst read = (path) => readFileSync(path, 'utf8');\nconst page = read('src/pages/MarketPage.tsx');\nconst domain = read('server/src/domain.js');\nconst system = read('server/src/system-market.js');\nfor (const text of ['parseIntegerDraft(quantityDraft, { min: 1 })', 'id=\"market-trade-quantity\"', 'quantity: parsedQuantity']) { if (!page.includes(text)) throw new Error('即时交易整数数量控件缺少: ' + text); }\nfor (const text of ['normalizePositiveInteger(payload.quantity)', 'settleImmediatePlayerTrade']) { if (!domain.includes(text)) throw new Error('服务器整数数量校验缺少: ' + text); }\nif (!system.includes('Math.floor(Number(order.remaining || 0))')) throw new Error('系统即时结算必须使用整数数量');\nfor (const text of ['MoneyInput', 'market-order-price']) { if (page.includes(text)) throw new Error('玩家市场不得恢复价格输入: ' + text); }\nconsole.log('商品即时交易整数数量验证通过。');\n`;
write('scripts/verify-integer-market-order.mjs', integerVerifier);

const desktopVerifier = `import { readFileSync } from 'node:fs';\nconst page = readFileSync('src/pages/MarketPage.tsx', 'utf8');\nconst design = readFileSync('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'utf8');\nfor (const text of ['market-immediate-trade-card', 'market-account-panel', '最近成交', '今日成交价']) { if (!page.includes(text)) throw new Error('桌面即时市场缺少: ' + text); }\nfor (const text of ['market-compact-view-switch', 'market-order-book-title', '实时五档', '已有订单', '挂单／成交', 'market-order-price']) { if (page.includes(text)) throw new Error('桌面市场不得恢复挂单 UI: ' + text); }\nif (!design.includes('玩家商品页面永久移除：价格输入框')) throw new Error('设计必须锁定挂单 UI 退役');\nconsole.log('市场桌面清理验证通过：即时交易与最近成交同时显示，挂单/盘口控件永久退役。');\n`;
write('scripts/verify-market-desktop-cleanup.mjs', desktopVerifier);

if (existsSync('scripts/verify-market-mobile-book.mjs')) {
  const mobileVerifier = `import { readFileSync } from 'node:fs';\nconst page = readFileSync('src/pages/MarketPage.tsx', 'utf8');\nconst style = readFileSync('src/styles/market-page-polish.css', 'utf8');\nfor (const text of ['market-quantity-stepper', 'order-quick-fill', 'market-submit-order']) { if (!page.includes(text)) throw new Error('移动即时交易缺少: ' + text); }\nfor (const text of ['orderBook.bids', 'orderBook.asks', 'market-order-price', 'market-compact-view-switch']) { if (page.includes(text)) throw new Error('移动市场不得恢复: ' + text); }\nif (!style.includes('@media') && !style.includes('@container')) throw new Error('市场必须保留响应式样式');\nconsole.log('移动市场验证通过：窄屏保留数量即时交易，不恢复五档盘口。');\n`;
  write('scripts/verify-market-mobile-book.mjs', mobileVerifier);
}

const summaryLeakVerifier = `import { readFileSync } from 'node:fs';\nconst delivery = readFileSync('server/src/market-state-delivery.js', 'utf8');\nconst design = readFileSync('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'utf8');\nfor (const text of ['const EMPTY_PUBLIC_ORDER_BOOK', 'buyVolume: 0', 'sellVolume: 0', 'bestBid: null', 'bestAsk: null']) { if (!delivery.includes(text)) throw new Error('公开商品状态未清空内部盘口: ' + text); }\nif (!delivery.includes(\"assetKind === 'commodity' ? [] : publicDepth\")) throw new Error('商品详情必须返回空公开深度');\nfor (const text of ['普通玩家页面不得展示内部订单所有者', '不得为了公开行情再次对完整 \\`world.orders\\` 做逐请求过滤排序']) { if (!design.includes(text)) throw new Error('内部订单公开边界缺少: ' + text); }\nconsole.log('商品市场公开摘要验证通过：内部人口/储备订单不得形成玩家可见盘口或最优价。');\n`;
write('scripts/verify-market-summary-no-system-order-leak.mjs', summaryLeakVerifier);

const procurementVerifier = `import { readFileSync } from 'node:fs';\nconst source = readFileSync('server/src/facility-auto-procure.js', 'utf8');\nconst design = readFileSync('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'utf8');\nfor (const text of ['quoteMissingAtDailyPrice', 'commoditySystemPriceFor', 'validateProtectedQuote', 'applyImmediateCommodityBuy', 'ensureBuildAndProcurementFunds', '建造材料已按今日系统价一次购齐']) { if (!source.includes(text)) throw new Error('建厂即时购料缺少: ' + text); }\nfor (const text of ['getOrderBookDepth', \"execution: 'fill-or-kill'\", '继续挂在市场']) { if (source.includes(text)) throw new Error('建厂购料不得恢复订单簿/FOK: ' + text); }\nfor (const text of ['建厂一键购料不再读取真实卖盘深度', '原有事务边界继续保证“全部购齐或全部回滚”']) { if (!design.includes(text)) throw new Error('建厂购料设计缺少: ' + text); }\nconsole.log('建厂购料验证通过：缺失材料按当日系统价事务内即时购齐，不创建挂单。');\n`;
write('scripts/verify-facility-auto-procure.mjs', procurementVerifier);

for (const path of [
  'scripts/codex-daily-market-finalize.mjs',
  '.github/workflows/codex-daily-market-finalize.yml',
]) {
  if (existsSync(path)) unlinkSync(path);
}
