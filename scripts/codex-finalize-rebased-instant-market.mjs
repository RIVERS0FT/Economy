import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);

function mutate(path, transform) {
  const before = read(path);
  const after = transform(before);
  if (after === before) throw new Error(`未修改目标文件: ${path}`);
  write(path, after);
}

function replaceExact(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`缺少待替换文本 ${label}`);
  return source.replace(from, to);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`缺少待替换模式 ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

// 1) 48 州全部直接经营：全局市场不得再读取历史解锁字段。
mutate('src/pages/GlobalMarketPage.tsx', (source) => replaceRegex(
  source,
  /function operationalProvinces\(model: OnlineAutoTradeAwareGameViewModel\) \{[\s\S]*?\n\}\n\nfunction average/,
  'function operationalProvinces(model: OnlineAutoTradeAwareGameViewModel) {\n  return model.game.provinces;\n}\n\nfunction average',
  'GlobalMarketPage operationalProvinces',
));

// 2) 地区市场只允许当日价即时交易；保留 readOnly 属性类型兼容既有调用，但不再渲染锁定态。
mutate('src/pages/MarketPage.tsx', (source) => {
  let next = source.replace('  readOnly = false,\n', '');
  const start = next.indexOf('            {readOnly ? (');
  if (start < 0) throw new Error('MarketPage 缺少旧 readOnly 交易分支');
  const immediateStart = next.indexOf('              <MarketImmediateTradeEntry', start);
  const immediateEndToken = '              />';
  const immediateEnd = next.indexOf(immediateEndToken, immediateStart);
  if (immediateStart < 0 || immediateEnd < 0) throw new Error('MarketPage 缺少即时交易组件');
  const block = next.slice(immediateStart, immediateEnd + immediateEndToken.length)
    .replace(/^              /gm, '            ');
  const branchEndToken = '\n            )}';
  const branchEnd = next.indexOf(branchEndToken, immediateEnd);
  if (branchEnd < 0) throw new Error('MarketPage 无法定位旧 readOnly 分支结束');
  next = next.slice(0, start) + block + next.slice(branchEnd + branchEndToken.length);
  return next;
});

// 3) 设计索引：商品市场 owner 改为即时交易与内部订单边界。
mutate('docs/README.md', (source) => {
  let next = replaceExact(
    source,
    '| `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` | 市场订单、冻结、撮合、成交与市场资产交易语义 | 市场页面布局、行情图几何、服务器容量与存储实现 |',
    '| `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` | 商品即时交易、每日官方系统价、服务器内部消费／储备订单边界与历史玩家挂单迁移 | 市场页面布局、行情图几何、服务器容量与存储实现 |',
    'docs index market owner',
  );
  next = replaceExact(
    next,
    '| 市场订单、冻结、撮合、成交 | `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` |',
    '| 商品即时交易、每日官方系统价、内部人口／储备订单边界、历史挂单迁移 | `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` |',
    'docs index market route',
  );
  return next;
});

// 4) 产品规则：只替换玩家商品交易语义，保留人口/储备内部订单模型与 48 州直达规则。
mutate('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', (source) => {
  let next = source;
  next = replaceExact(next,
    '→ 合同覆盖的需求按权威条款准备、托管、履约和结算，未覆盖的缺口与剩余产出继续进入同州统一订单簿',
    '→ 合同覆盖的需求按权威条款准备、托管、履约和结算，未覆盖的缺口与剩余产出按同州当日官方系统价即时交易',
    'product core loop',
  );
  next = next.replace('现货市场负责即时价格发现与即时成交', '现货市场负责按每日官方系统价处理即时成交');
  next = replaceRegex(next,
    /缺料时的“一键购齐并建造”仍属于即时建设，[^\n]*既有玩家历史库存不因材料包退役而回收或改写。/,
    '缺料时的“一键购齐并建造”仍属于即时建设；服务器在同一事务按建造州各缺失材料的当日官方系统价即时购入并消耗，继续执行逐材料最高接受价、采购总额上限、资金校验和全有或全无回滚，不留下商品挂单。既有玩家历史库存不因材料包退役而回收或改写。',
    'product build procurement',
  );
  next = replaceExact(next,
    '商品库存、商品行情、工厂集群、工厂行情和订单簿按州级地区隔离：商品只进入成交或生产发生地的本地仓库；同资产、同价格但地区不同的订单永远不能撮合；工厂交易或拍卖后仍留在原地区。',
    '商品库存、商品行情、工厂集群和服务器内部市场状态按州级地区隔离：玩家商品即时交易只改变成交州的本地资金与库存；人口／储备内部订单只能在同州模拟市场内撮合；工厂交易或拍卖后仍留在原地区。',
    'product province market isolation',
  );
  next = replaceExact(next,
    '迁移必须保留数量、冻结、资金、订单优先级和历史，不复制资产、不取消玩家订单。',
    '迁移必须保留数量、资金和真实历史；旧玩家商品开放订单一次性释放剩余冻结资金或库存并关闭，不复制资产，服务器内部人口／储备订单按各自模型继续兼容。',
    'product legacy order migration',
  );
  next = replaceRegex(next,
    /- 统一订单簿玩家卖出手续费：[^\n]+/,
    '- 商品即时卖出市场服务费：按实际成交额精确收取 1%，不设最低手续费，固定按基础人口 20%、技术人口 60%、专业人口 20% 分配。',
    'product sell fee',
  );
  next = replaceRegex(next,
    /世界 31 起，每个州×商品维护唯一官方系统价：[^\n]+规则细节以 `UNIFIED_ASSET_ORDER_BOOK_DESIGN\.md` 为准。/,
    '每个州×商品维护唯一官方系统价：玩家商品买卖只提交方向与数量，由服务器按当日 `officialPrice` 即时全量结算；官方系统价在 `Asia/Shanghai` 一个自然日内固定不变，北京时间每日 00:00 根据前一自然日玩家从系统买入量与向系统卖出量的失衡统一调整，单日涨跌绝对值最多 5%，并始终限制在商品基础价 50%～300%。玩家商品交易不创建开放挂单、不冻结等待成交资产、不展示五档盘口，内部人口／储备订单继续仅服务服务器经济模拟。规则细节以 `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` 为准。',
    'product daily official price',
  );
  next = next.replace(
    '商品估值 = Σ((可用数量 + 冻结数量) × 最近一次订单簿真实成交价)',
    '商品估值 = Σ((可用数量 + 冻结数量 + 在途数量) × 对应州当日官方系统价)',
  );
  next = next.replace(
    '财富榜使用服务器最近订单簿真实成交价计算资产毛值并扣除贷款负债后实时排序，不发放宝石奖励。',
    '财富榜使用商品所在州当日官方系统价与工厂最近真实产权成交价计算资产毛值，并扣除贷款负债后实时排序，不发放宝石奖励。',
  );
  next = next.replace(
    '交易榜只统计卖方在当前更新周期内通过统一订单簿完成的实际卖出成交额，买方不重复获得同一笔成交成绩：',
    '交易榜只统计卖方在当前更新周期内由服务器确认完成的实际卖出成交额；商品即时卖出与仍保留的正式产权成交均按成交记录计入，买方不重复获得同一笔成交成绩：',
  );
  next = next.replace(
    '商品订单和工厂订单均按服务器成交记录 `fill` 统计；玩家卖给玩家和玩家卖给市场需求均计入。成绩采用手续费扣除前的实际成交总额，统一订单簿卖出手续费仍正常扣除。未成交挂单不计入，撤单的未成交剩余数量不计入；订单撤销前已经生成的真实成交记录仍正常计入。',
    '商品即时卖出和兼容工厂成交均按服务器成交记录 `fill` 统计。成绩采用手续费扣除前的实际成交总额，商品即时卖出 1% 市场服务费仍正常扣除。历史未成交挂单及撤销剩余数量不计入；迁移前已经生成的真实成交记录仍正常计入。',
  );
  return next;
});

// 5) 页面职责：连续 48 州全部可交易，但玩家商品不再有盘口/挂单/撤单。
mutate('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', (source) => {
  let next = source;
  next = replaceExact(next,
    '| 市场 | `market` | `GlobalMarketPage` | 连续 48 州的商品目录、商品跨州行情详情与地区商品交易钻取；实际盘口与手动下单继续由地区 `MarketPage` 执行；自动经营策略与玩家可见执行解释唯一归地区 `BuildingsPage` 工厂详情 |',
    '| 市场 | `market` | `GlobalMarketPage` | 连续 48 州的商品目录、商品跨州行情详情与地区商品交易钻取；地区 `MarketPage` 按当日官方系统价执行即时买卖；自动经营策略与玩家可见执行解释唯一归地区 `BuildingsPage` 工厂详情 |',
    'page market owner row',
  );
  next = next.replace(
    '市场按正常市场规则提供目录、行情、订单簿和写操作',
    '市场提供商品目录、今日官方价格、真实成交行情和即时写操作',
  );
  next = next.replace(
    '商品行情、五档盘口、未完成订单和本地成交记录都只展示当前地区；',
    '商品今日官方价格、真实成交行情和本地成交记录都只展示当前地区；',
  );
  next = replaceRegex(next,
    /商品详情必须包含买入／卖出方向、价格、数量、快捷仓位[\s\S]*?详情中的“已有订单”只逐单展示当前资产的 `open`／`partial` 本人订单。/,
    '商品地区详情必须包含今日官方价格、买入／卖出方向、数量、快捷数量、交易总额和即时提交、近 24h 真实成交趋势、今日／24h 成交量、下一北京时间 00:00 调价时间，以及按当前商品过滤的浏览器本地最近成交。玩家不能输入成交价格；页面不得渲染五档盘口、已有订单、撤单、“有我的订单”筛选或挂单／成交切换。卖出方向继续常驻显示按整笔即时成交估算的“预计到账”，服务器按真实成交结算 1% 市场服务费。',
    'page product detail immediate rule',
  );
  next = next.replace('`marketAssetKind`、`marketAssetId` 及订单草稿', '`marketAssetKind`、`marketAssetId` 及交易方向／数量草稿');
  next = next.replace(
    '数量和价格继续按统一市场资产切换的订单草稿初始化规则处理（当前数量重置为 `1`，并按当前方向与目标资产初始化默认价格），不得自动提交订单；',
    '数量继续按统一市场资产切换的交易草稿初始化规则处理（当前数量重置为 `1`）；成交价格始终由服务器当日 `officialPrice` 决定，不得自动提交交易；',
  );
  next = replaceRegex(next,
    /全部缺料可在真实卖盘中购齐时显示“一键购齐并建造”[\s\S]*?不新增采购组轮询或服务器第二状态。/,
    '存在缺料时，建造报价直接读取建造州各缺失材料的当日官方系统价并显示“一键购齐并建造”；客户端继续提交 `autoProcure=true`、逐材料最高接受价和采购总额上限。服务器执行时重新读取当日价、库存和资金，任一材料超过价格保护、总额保护或资金不足时整个事务失败；全部校验通过后所有缺失材料按官方价即时购入并在同一事务继续建造，不创建 FOK、普通商品挂单、采购组或等待成交状态。',
    'page build procurement immediate rule',
  );
  next = next.replace('生产摘要、资产与银行和当前挂单三张核心经营卡', '生产摘要、资产与银行两张核心经营卡');
  next = next.replace(
    '主列第二排固定为生产摘要、资产与银行和当前挂单。主列内容宽度大于 `1050px` 时三卡同排并统一约 `320px` 高；不足时改为两列且挂单卡跨两列，不大于 `580px` 时全部单列并恢复自然高度。',
    '主列第二排固定为生产摘要和资产与银行。内容宽度大于 `580px` 时两卡等宽同排，不大于 `580px` 时改为单列并恢复自然高度。',
  );
  next = next.replace(
    '资产与银行卡只显示现金、商品估值、工厂估值、冻结资金，以及服务器权威的可支配资产、冻结资产和贷款负债；不得恢复当前浏览器本地资金变化，也不得重复状态栏已经显示的净资产和排名。当前挂单只显示一次买卖统计、冻结资金和订单列表；列表在固定卡片内滚动，概览不提供撤单按钮。生产摘要优先显示正在运行、生产受阻、主动停工和理论日产量，不以总工厂数掩盖异常。',
    '资产与银行卡只显示现金、商品估值、工厂估值、冻结资金，以及服务器权威的可支配资产、冻结资产和贷款负债；不得恢复当前浏览器本地资金变化，也不得重复状态栏已经显示的净资产和排名。生产摘要优先显示正在运行、生产受阻、主动停工和理论日产量，不以总工厂数掩盖异常。概览不得恢复“当前挂单”“管理订单”或本人开放商品订单列表。',
  );
  next = next.replace('生产异常、主动停工与本人未完成挂单统一由通知中心派生', '生产异常与主动停工统一由通知中心派生');
  return next;
});

// 6) 服务器权威设计只改市场边界，保留合同/运输等最新主线规则。
mutate('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', (source) => {
  let next = source;
  next = next.replace(
    '- 按地区＋工厂类型保存的自动经营策略、由当前工厂状态派生的商品自动采购／出售执行策略，以及仅当前玩家可见的托管买单／卖单私有关联；',
    '- 按地区＋工厂类型保存的自动经营策略，以及由当前工厂状态派生并按当日官方价即时执行的商品自动采购／出售策略；',
  );
  next = next.replace(
    '- 商品与工厂统一订单、成交和估值价格；',
    '- 商品每日官方系统价、玩家商品即时成交记录、服务器内部人口／储备订单，以及工厂正式估值状态；',
  );
  next = next.replace(
    '商品订单写动作在真实订单簿撮合完成后执行官方系统价实时清算；世界推进在市场需求周期结算后推进每州×商品的官方系统价价格周期，并把 `world.systemMarketAudit` 作为顶层 segment 随事务持久化（该 segment 只用于服务器审计，不进入六分区或普通玩家状态）。',
    '玩家商品写动作不再进入开放订单簿：服务器在事务内读取州×商品当日 `officialPrice` 并即时结算资金与地区库存，兼容成交记录直接为 `filled`。世界截止时间调度器把北京时间每日 00:00 作为官方商品价换日边界，只使用真正前一自然日的玩家↔系统买卖量失衡计算新价；`world.systemMarketAudit` 继续作为顶层 segment 随事务持久化且只用于服务器审计。服务器内部人口／储备订单撮合与玩家即时交易严格分离，普通玩家市场状态不得下发内部订单深度。',
  );
  return next;
});

// 7) 仓库/自动经营设计恢复最新 48 州无解锁语义。
mutate('docs/WAREHOUSE_EXPANSION_DESIGN.md', (source) => {
  let next = source;
  next = next.replace('；仅已解锁州显示本地库存内容。', '；连续 48 州均直接显示本地库存内容，不存在仓库地区解锁门禁。');
  next = next.replace('玩家可以在已解锁州之间保存有序多站点运输路线。', '玩家可以在连续 48 州之间保存有序多站点运输路线。');
  next = next.replace('路线全部站点必须已解锁', '路线全部站点必须是连续 48 州内有效地区');
  return next;
});

// 8) 概览永久删除“当前挂单”卡及订单切片依赖。
mutate('src/pages/OverviewPage.tsx', (source) => {
  let next = source;
  for (const line of [
    "import { orderStatusNames } from '../app/gameViewModel';\n",
    "import { FactoryIcon } from '../components/icons/GameIcons';\n",
    "import { ProductIconLabel } from '../components/icons/ProductIcons';\n",
    "import { formatCurrency, formatNumber, formatTime } from '../utils/formatters';\n",
    "import { orderAssetId, orderKind } from '../utils/orderIdentity';\n",
  ]) next = next.replace(line, '');
  next = next.replace('  EmptyState,\n', '');
  next = next.replace('  StatusTag,\n', '');
  next = next.replace("import { formatCurrency } from '../utils/formatters';\n", "import { formatCurrency } from '../utils/formatters';\n");
  if (!next.includes("import { formatCurrency } from '../utils/formatters';")) {
    next = next.replace("import { CurrencyAmount } from '../components/ui/CurrencyAmount';\n", "import { CurrencyAmount } from '../components/ui/CurrencyAmount';\nimport { formatCurrency } from '../utils/formatters';\n");
  }
  next = replaceRegex(next,
    /  const ownOpenOrders = [\s\S]*?  const theoreticalDailyOutput =/,
    '  const theoreticalDailyOutput =',
    'overview order derivations',
  );
  next = replaceRegex(next,
    /  const openOrdersListClassName = [\s\S]*?\n\n  return \(/,
    '  return (',
    'overview open-order list class',
  );
  next = replaceRegex(next,
    /\n          <Panel className="widget overview-summary-card overview-open-orders-card">[\s\S]*?\n          <\/Panel>/,
    '',
    'overview open-order card',
  );
  return next;
});

mutate('src/pages/PageRouter.tsx', (source) => source.replace("    'market.orders',\n    'market.quotes',\n    'market.calendar',", "    'market.quotes',\n    'market.calendar',"));

mutate('src/styles/overview.css', (source) => {
  let next = source.replace('grid-template-columns: repeat(3, minmax(0, 1fr));', 'grid-template-columns: repeat(2, minmax(0, 1fr));');
  next = next.replace(/\n\.overview-order-summary \{[\s\S]*?\n\.overview-facility-label strong \{[\s\S]*?\n\}/, '');
  next = next.replace(/\n  \.overview-open-orders-card \{[\s\S]*?\n  \}/g, '');
  next = next.replace(/,\n  \.overview-open-orders-list/g, '');
  next = next.replace(/\n  \.overview-open-orders-list,[\s\S]*?padding-right: 0;\n  \}/g, '');
  return next;
});

mutate('src/styles/overview-polish.css', (source) => {
  let next = source.replace('.overview-asset-events,\n.overview-open-orders-list {', '.overview-asset-events {');
  next = next.replace(/\n\.overview-open-orders-list--scrollable \{[\s\S]*?\n\}/, '');
  next = next.replace(',\n.overview-open-order {', ' {');
  next = next.replace(',\n.overview-open-order-identity small,\n.overview-open-order-values small', '');
  return next;
});

mutate('docs/OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md', (source) => {
  let next = source.replace('签到、生产摘要、资产与银行、当前挂单', '签到、生产摘要、资产与银行');
  next = next.replace('工作区左侧：概览 PageLayout → 本周签到 → 三张经营摘要', '工作区左侧：概览 PageLayout → 本周签到 → 两张经营摘要');
  next = next.replace('- 概览真实内容宽度大于 `1050px` 时三张摘要卡同排；\n- 不大于 `1050px` 时摘要两列，当前挂单跨两列；\n- 不大于 `580px` 时摘要全部单列并恢复自然高度；', '- 概览真实内容宽度大于 `580px` 时生产摘要与资产银行两张摘要卡等宽同排；\n- 不大于 `580px` 时摘要改为单列并恢复自然高度；');
  next = next.replace('- 当前挂单只有超过三条时使用 `overview-open-orders-list--scrollable`；\n', '');
  next = next.replace('- “当前挂单”只显示本人未完成订单摘要和列表，不提供概览撤单。\n', '- 概览不得恢复“当前挂单”“管理订单”或本人开放商品订单列表。\n');
  next = next.replace('7. 签到七格、短挂单和长挂单滚动语义；', '7. 签到七格以及两张经营摘要在宽屏/窄屏下的两列与单列语义；');
  next = next.replace('签到、经营摘要和挂单；不得持有教程或公开事件', '签到与经营摘要；不得持有教程、公开事件或玩家商品订单列表');
  return next;
});

mutate('docs/UI_DESIGN_SYSTEM.md', (source) => {
  let next = source.replace('- 概览页“当前挂单”卡：`OverviewPage.tsx` / `overview-polish.css` 的 `.overview-open-orders-list--scrollable`。\n', '');
  next = next.replace('主列第二排固定为生产摘要、资产构成和当前挂单。主列内容宽度大于 `1050px` 时三列同排并统一约 `320px` 高；不足时改为两列且挂单卡跨两列；不大于 `580px` 时全部单列并恢复自然高度。', '主列第二排固定为生产摘要和资产构成。主列内容宽度大于 `580px` 时两列同排，不大于 `580px` 时改为单列并恢复自然高度。');
  next = next.replace('当前挂单列表在卡片内部滚动，概览不提供撤单按钮。', '概览不得渲染玩家开放商品挂单列表或订单管理入口。');
  return next;
});

// 9) 最新主线中的旧市场 verifier 改成“禁止恢复挂单”的正向门禁。
mutate('scripts/verify-page-content.mjs', (source) => {
  let next = source.replace('市场按正常市场规则提供目录、行情、订单簿和写操作', '市场提供商品目录、今日官方价格、真实成交行情和即时写操作');
  next = replaceRegex(next,
    /for \(const text of \[\n  'readOnly = false',[\s\S]*?\n\]\) requireText\('src\/pages\/MarketPage\.tsx', text\);/,
    "for (const text of [\n  '即时交易',\n  '今日成交价',\n  '下次调价',\n  'id=\"market-trade-quantity\"',\n  'market-submit-order',\n]) requireText('src/pages/MarketPage.tsx', text);\nfor (const text of ['该地区尚未解锁，市场仅供查看。', 'market-trade-readonly', '实时五档', 'orderBook.bids', 'orderBook.asks', 'market-order-price']) forbidText('src/pages/MarketPage.tsx', text);",
    'page-content MarketPage assertions',
  );
  next = replaceRegex(next,
    /for \(const text of \[\n  'market-commodity-row-header',[\s\S]*?\n\]\) requireText\('src\/components\/market\/MarketCommodityRow\.tsx', text\);/,
    "for (const text of [\n  'market-commodity-row-header',\n  '今日价格',\n  '24h成交量',\n  '24h价格变化',\n]) requireText('src/components/market/MarketCommodityRow.tsx', text);\nfor (const text of ['卖单量', '买单量', '挂单差额', '基准偏离', '挂单状态']) forbidText('src/components/market/MarketCommodityRow.tsx', text);",
    'page-content commodity columns',
  );
  return next;
});

const marketPageLayoutVerifier = [
  "import { readFileSync } from 'node:fs';",
  "const read = (path) => readFileSync(path, 'utf8');",
  "const globalPage = read('src/pages/GlobalMarketPage.tsx');",
  "const page = read('src/pages/MarketPage.tsx');",
  "const province = read('src/pages/ProvincePage.tsx');",
  "const design = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');",
  "for (const text of ['商品目录 → 商品全局详情 → 地区商品详情', '连续 48 州均为完整经营上下文', '商品地区详情必须包含今日官方价格']) if (!design.includes(text)) throw new Error('市场页面设计缺少: ' + text);",
  "for (const text of ['return model.game.provinces;', 'selectedGlobalProductId', '<EmbeddedMarketPage model={model} embedded />']) if (!globalPage.includes(text)) throw new Error('全局即时市场缺少: ' + text);",
  "for (const text of ['MarketImmediateTradeEntry', '今日成交价', 'market-trade-quantity', '立即买入', '立即卖出', '最近成交']) if (!page.includes(text)) throw new Error('地区即时市场缺少: ' + text);",
  "for (const text of ['MoneyInput', 'market-order-price', 'orderBook.bids', 'orderBook.asks', '实时五档', '已有订单', 'market-trade-readonly']) if (page.includes(text)) throw new Error('玩家商品市场不得恢复: ' + text);",
  "if (!province.includes('<EmbeddedMarketPage model={model} embedded readOnly={false} />')) throw new Error('州级上下文必须继续复用地区 MarketPage');",
  "console.log('市场页验证通过：连续 48 州商品详情统一按服务器当日价即时交易，禁止恢复玩家挂单、五档和自定义价格。');",
].join('\n');
write('scripts/verify-market-page-layout.mjs', marketPageLayoutVerifier);

mutate('scripts/verify-market-page-layout-regional.mjs', (source) => {
  let next = source.replace("for (const token of ['24h成交量', '市场价', '24h价格变化'])", "for (const token of ['24h成交量', '今日价格', '24h价格变化'])");
  next = next.replace("--entity-list-columns: minmax(8rem, 1.45fr) repeat(3, minmax(4.4rem, .78fr)) var(--entity-list-chevron-column, .8rem);", "--entity-list-columns: minmax(8rem, 1.55fr) repeat(3, minmax(4.5rem, .72fr)) var(--entity-list-chevron-column, .8rem);");
  next = next.replace("requireText(marketPage, 'market-trade-readonly', '未开放交易的地区视图必须保留只读态。');\nrequireText(marketPage, '该地区尚未解锁，市场仅供查看。', '只读态必须解释无法交易。');", "forbidText(marketPage, 'market-trade-readonly', '连续 48 州市场不得恢复地区只读锁。');\nforbidText(marketPage, '该地区尚未解锁，市场仅供查看。', '连续 48 州市场不得恢复解锁提示。');");
  return next;
});

const hierarchyVerifier = [
  "import { readFileSync } from 'node:fs';",
  "const read = (path) => readFileSync(path, 'utf8');",
  "const globalPage = read('src/pages/GlobalMarketPage.tsx');",
  "const regionalPage = read('src/pages/MarketPage.tsx');",
  "const row = read('src/components/market/MarketCommodityRow.tsx');",
  "const css = read('src/styles/market-commodity-row.css');",
  "const design = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');",
  "for (const text of ['商品目录 → 商品全局详情 → 地区商品详情', '连续 48 州均为完整经营上下文', '商品地区详情必须包含今日官方价格']) if (!design.includes(text)) throw new Error('市场层级设计缺少: ' + text);",
  "for (const text of [\"type GlobalMarketSortKey = 'name' | 'volume24h' | 'market-price' | 'price-change24h';\", \"type RegionalProductStatus = 'all' | 'traded' | 'no-trade';\", 'return model.game.provinces;', 'tradeVolume24h', 'marketPrice: average(officialPrices)', 'selectedGlobalProductId', '<EmbeddedMarketPage model={model} embedded />']) if (!globalPage.includes(text)) throw new Error('全局市场层级缺少: ' + text);",
  "for (const text of ['sell-volume', 'buy-volume', 'own-order', 'allProvinceOrders', '有我的订单']) if (globalPage.includes(text)) throw new Error('全局市场不得恢复挂单层级: ' + text);",
  "for (const text of ['今日价格', '24h成交量', '24h价格变化', '<EntityListHeader', '<CompactNumber value={tradeVolume24h} />']) if (!row.includes(text)) throw new Error('共享商品行缺少: ' + text);",
  "for (const text of ['卖单量', '买单量']) if (row.includes(text)) throw new Error('共享商品行不得恢复盘口列: ' + text);",
  "if (!css.includes('repeat(3, minmax(4.5rem, .72fr))')) throw new Error('商品行必须只保留三项即时市场指标');",
  "for (const text of ['MarketImmediateTradeEntry', '今日成交价', '今日成交量', '最近成交']) if (!regionalPage.includes(text)) throw new Error('地区即时市场缺少: ' + text);",
  "for (const text of ['orderBook.bids', 'orderBook.asks', 'market-order-price', '实时五档', '已有订单']) if (regionalPage.includes(text)) throw new Error('地区市场不得恢复: ' + text);",
  "console.log('市场信息层级验证通过：全局/地区目录只展示今日价与真实成交，地区详情使用数量型即时交易。');",
].join('\n');
write('scripts/verify-market-information-hierarchy.mjs', hierarchyVerifier);

const desktopVerifier = [
  "import { readFileSync } from 'node:fs';",
  "const page = readFileSync('src/pages/MarketPage.tsx', 'utf8');",
  "const design = readFileSync('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'utf8');",
  "const browser = readFileSync('tests/browser/market-desktop-cleanup.spec.ts', 'utf8');",
  "for (const text of ['market-immediate-trade-card', 'market-account-panel', '最近成交', '今日成交价']) if (!page.includes(text)) throw new Error('桌面即时市场缺少: ' + text);",
  "for (const text of ['order-book single-order-book', '实时五档', 'market-order-price', '已有订单', 'market-account-view-switch']) if (page.includes(text)) throw new Error('桌面市场不得恢复挂单 UI: ' + text);",
  "if (!design.includes('玩家商品页面永久移除：价格输入框')) throw new Error('设计必须锁定挂单 UI 退役');",
  "if (!browser.includes('instant market')) throw new Error('浏览器回归必须覆盖即时市场');",
  "console.log('市场桌面清理验证通过：即时交易与最近成交同时显示，挂单/盘口控件永久退役。');",
].join('\n');
write('scripts/verify-market-desktop-cleanup.mjs', desktopVerifier);

// 10) 概览 verifier 与浏览器回归改为确认挂单卡永久不存在。
mutate('scripts/verify-overview-content.mjs', (source) => {
  let next = source.replace("    'market.orders',\n", '');
  next = next.replace("  'overview-open-orders-list--scrollable',\n", '');
  next = next.replace("  'title=\"当前挂单\"',\n", '');
  next = next.replace("  '--overview-summary-card-height: 330px;',\n  '.overview-open-orders-list--scrollable {',\n  'overflow-y: auto;',", "  '--overview-summary-card-height: 330px;',");
  next = next.replace("  '/ 7 天',\n]);", "  '/ 7 天',\n  'title=\"当前挂单\"',\n  'overview-open-orders-list',\n  '管理订单',\n]);");
  return next;
});

mutate('tests/browser/runtime.spec.ts', (source) => {
  let next = replaceRegex(source,
    /\ntest\('overview only scrolls the order list after the visible capacity is exceeded'[\s\S]*?\n\}\);\n/,
    '\n',
    'runtime overview order-scroll test',
  );
  next = replaceRegex(next,
    /\n  const nestedOverflowModes = await page\.locator\('\.overview-open-orders-list'\)[\s\S]*?expect\(nestedOverflowModes\)\.toEqual\(\['visible'\]\);/,
    "\n  await expect(page.getByRole('heading', { name: '当前挂单', exact: true })).toHaveCount(0);",
    'runtime overview nested order assertion',
  );
  return next;
});

mutate('tests/browser/province-locked-access.spec.ts', (source) => source.replace(
  "  await expect(page.getByText('实时五档 · 点击填价', { exact: true })).toHaveCount(1);",
  "  await expect(page.getByText('实时五档 · 点击填价', { exact: true })).toHaveCount(0);\n  await expect(page.locator('.market-immediate-trade')).toBeVisible();",
));

// 市场浏览器专项由旧盘口断言切换为即时交易反回退。
const desktopBrowser = [
  "import { expect, test } from '@playwright/test';",
  "test('desktop instant market removes the resting order book', async ({ page }) => {",
  "  await page.setViewportSize({ width: 1280, height: 900 });",
  "  await page.goto('market-runtime-test.html');",
  "  await expect(page.locator('.market-immediate-trade')).toBeVisible();",
  "  await expect(page.getByText('今日成交价', { exact: true })).toBeVisible();",
  "  await expect(page.locator('#market-trade-quantity')).toBeVisible();",
  "  await expect(page.locator('.order-book')).toHaveCount(0);",
  "  await expect(page.getByText('实时五档', { exact: false })).toHaveCount(0);",
  "  await expect(page.getByText('已有订单', { exact: true })).toHaveCount(0);",
  "});",
  "test('mobile instant market keeps quantity trade controls without a book', async ({ page }) => {",
  "  await page.setViewportSize({ width: 390, height: 844 });",
  "  await page.goto('market-runtime-test.html');",
  "  await expect(page.locator('.market-immediate-trade')).toBeVisible();",
  "  await expect(page.locator('.market-submit-order')).toBeVisible();",
  "  await expect(page.locator('.order-book')).toHaveCount(0);",
  "});",
].join('\n');
write('tests/browser/market-desktop-cleanup.spec.ts', desktopBrowser);

mutate('tests/browser/market-detail-direct-flow.spec.ts', (source) => {
  let next = source;
  next = next.replace(/expect\(visibleHeroMetrics\)\.toEqual\([^;]+;/g, "expect(visibleHeroMetrics).toEqual(['今日价格', '24h 变化', '可用库存']);");
  next = next.replace(/expect\(visibleTradeSummary\)\.toEqual\([^;]+;/g, "expect(visibleTradeSummary).toEqual(['今日价格', '今日成交量', '24h 成交量', '下次调价']);");
  next = next.replace(/await expect\(page\.locator\('\.order-book[^;]+;/g, "await expect(page.locator('.order-book')).toHaveCount(0);");
  return next;
});

// 自删除，不把一次性维护器留在正式分支。
for (const path of [
  'scripts/codex-finalize-rebased-instant-market.mjs',
  '.github/workflows/codex-finalize-rebased-instant-market.yml',
]) {
  if (existsSync(path)) unlinkSync(path);
}
