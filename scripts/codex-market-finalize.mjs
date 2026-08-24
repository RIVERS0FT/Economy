import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceExact(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) throw new Error(`${path}: missing exact source\n${before.slice(0, 180)}`);
  write(path, source.replace(before, after));
}
function replaceSection(path, startMarker, endMarker, replacement) {
  const source = read(path);
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`${path}: section markers missing: ${startMarker} -> ${endMarker}`);
  write(path, source.slice(0, start) + replacement + source.slice(end));
}
function replaceTest(path, testName, nextTestName, replacement) {
  const source = read(path);
  const startMarker = `test('${testName}'`;
  const start = source.indexOf(startMarker);
  const end = nextTestName ? source.indexOf(`test('${nextTestName}'`, start + startMarker.length) : source.length;
  if (start < 0 || end < 0) throw new Error(`${path}: test markers missing: ${testName}`);
  write(path, source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end));
}

// PAGE_CONTENT_AND_NAVIGATION_DESIGN.md: replace the old parallel region/product market paths with one product-first global path.
replaceExact('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '> 更新时间：2026-08-23', '> 更新时间：2026-08-24');
replaceExact(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '| 市场 | `market` | `GlobalMarketPage` | 全部已解锁州的市场总览、跨州商品真实成交价范围与地区市场入口；实际盘口、下单和自动交易继续由地区 `MarketPage` 执行 |',
  '| 市场 | `market` | `GlobalMarketPage` | 全部已解锁州的商品目录、商品跨州行情详情与地区商品交易钻取；实际盘口、下单和自动交易继续由地区 `MarketPage` 执行 |',
);
replaceExact(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '一级导航中的“市场”和“建筑”固定进入全局视图，不得根据地图当前经营州直接退回地区 `MarketPage` 或 `BuildingsPage`。全局页默认读取完整权威状态中的全部已解锁州摘要；玩家从全局页点击某州卡后才进入该州地区工作区，并显式把该州设为后续写操作的经营州。该地区钻取只复用现有地区页面，不创建第二套订单簿、生产状态或地区选择下拉框；`ProvincePage` 内的市场与建筑分区仍始终是地图所打开当前州的本地视图。',
  '一级导航中的“市场”和“建筑”固定进入全局视图，不得根据地图当前经营州直接退回地区 `MarketPage` 或 `BuildingsPage`。全局页默认读取完整权威状态中的全部已解锁州摘要。市场固定采用“商品目录 → 商品全局详情 → 地区商品详情”的商品优先钻取，不再提供独立“地区市场”面板；只有在商品全局详情点击某地区时才显式把该州设为后续写操作的经营州并复用现有 `MarketPage` 商品详情。建筑仍按工厂与地区入口钻取。两者都不得创建第二套订单簿、生产状态或地区选择下拉框；`ProvincePage` 内的市场与建筑分区仍始终是地图所打开当前州的本地视图。',
);
replaceSection(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '## 4. 市场',
  '卖单量与买单量只来自公开订单簿',
  `## 4. 市场\n\n一级路由 \`market\` 使用 \`GlobalMarketPage\`，页面主标题固定为“市场”。一级市场固定采用“商品目录 → 商品全局详情 → 地区商品详情”三级信息层级；商品全局详情只是同一 \`market\` 页面内部钻取，不新增 \`TabId\`、正式路由或第二套交易页面。默认商品目录按正式商品顺序展示商品、真实成交覆盖、真实成交价范围和需求未满足覆盖；筛选默认折叠且不提供商品名称搜索框。多个州的订单簿、库存、需求和成交价始终保持州级隔离：全局页不得把各州买卖单合并成一个全国订单簿，也不得用平均价、基础价或任意聚合值伪造“全局市场价”。一级市场不再提供独立“地区市场”面板；地区优先入口唯一保留在地图打开的 \`ProvincePage\`。\n\n点击商品进入商品全局详情，固定列出全部已解锁地区并复用共享商品数据行。每个地区行固定显示商品、卖单量、买单量、市场价和 24h 变化：卖单量与买单量只聚合该 \`provinceId + commodity + productId\` 下 \`open\`／\`partial\` 公开订单的当前 \`remaining\`；市场价读取该地区服务器 \`officialPrice\`；24h 变化只由该地区近 24 小时真实成交生成。商品全局详情的地区状态筛选和排序同样默认折叠且不提供搜索框；默认按正式地区目录顺序稳定排列，当前经营州只做轻量标记而不自动置顶。客户端可从已经加载的完整公开订单快照保留只读的跨地区投影供该列表聚合，但不得新增服务器接口、轮询、状态分区或跨地区撮合。点击地区行后显式更新当前经营州，并复用现有嵌入式 \`MarketPage\` 打开该地区商品详情；从该详情返回必须回到同一商品全局详情。\n\n地区 \`MarketPage\` 的目录态语义标题为“{州级地区全称}市场”；商品详情使用共享地区实体标题，第一行显示商品名称，第二行显示州级地区全称。\`ProvincePage\` 的市场分区继续直接嵌入当前地图州的同一个 \`MarketPage\`，从地图州上下文进入时仍按“地区商品目录 → 地区商品详情”短路径导航，不强制绕过商品全局详情。嵌入父级时不得再套第二层 \`PageLayout\`。地区市场不显示州级下拉框；商品目录只展示商品，不再提供商品／工厂资产类型切换；工厂资产的五档盘口、下单、本人订单与成交只作为建筑详情中的从属交易视图打开。商品行情、在线自动交易策略、五档盘口、未完成订单和本地成交记录都只展示当前地区；切换地区必须重新投影同一完整权威状态，不得沿用上一地区的盘口、库存、价格、策略或成交记录。下单请求必须携带当前 \`provinceId\`。\n\n地区市场目录只承担商品发现与进入详情：筛选与排序使用默认折叠的 disclosure，不提供商品名称搜索框，商品列表直接排列在页面正文，不再套“商品列表”一级卡片，也不显示“市场行情／自动交易”工作区切换或四张挂单状态汇总卡。筛选保留四类正式商品分类以及有真实成交、有买盘、有卖盘、消费需求未满足和有我的订单等市场状态；排序保留目录顺序、名称、市场价、24h 变化、买单量和卖单量。目录与商品全局详情统一使用共享 \`MarketCommodityRow\`，每行只显示商品、卖单量、买单量、市场价和 24h 变化，不显示挂单差额、基准偏离或挂单状态；这些分析信息只在具体地区商品详情中保留。桌面、中窄与移动端都保持同一横向单行数据结构，通过缩小图片、间距、内边距和字号适配，包括 320px 视口；不得把核心指标隐藏、改成多行摘要卡或制造页面横向主滚动。点击商品进入当前地区商品详情；详情固定承载当前地区真实价格与近 24 小时真实成交量／趋势、统一五档订单簿与手动下单、本人订单／本地成交，以及锁定当前 \`provinceId + productId\` 的在线自动采购／自动出售设置。\n\n`,
);
replaceSection(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '### 4.1 市场页桌面布局与反馈',
  '同一价格或数量输入错误只允许在对应字段下显示一次',
  `### 4.1 市场页桌面布局与反馈\n\n市场商品目录和商品全局详情的地区行情都使用页面卡片内部单一纵向列表，并统一复用 \`MarketCommodityRow\`。桌面与移动端均保持“商品身份｜卖单量｜买单量｜市场价｜24h｜箭头”的单行结构；移动端通过紧凑图片与字号收缩，禁止恢复两列／多行摘要卡或横向主滚动。筛选与排序默认折叠；地区目录为三项筛选布局，商品全局详情只保留地区状态和排序，不显示搜索输入。详情交易区继续按实际内容宽度使用响应式布局：交易卡内部同时显示下单与五档盘口，商品基本面、生产消费关系、行情卡和当前资产订单／成交按单一页面滚动区排列。完整行情图由组件按自身宽度、根字号、成交量最低可读高度与底部安全区计算动态高度；桌面仅以接近 \`16:9\` 为基础，业务 CSS 不得强制固定比例，也不能使用基于浏览器 \`vw\` 的固定高度。\n\n共享商品行桌面身份插画槽使用紧凑 \`42px\`，商品插画为 \`34px\`；不大于 620px 时收紧为 \`34px / 29px\`，极窄屏继续缩小但保持所有四项核心指标可见。具体地区商品详情身份槽仍为桌面 \`76px\`／插画 \`58px\`，移动端 \`64px\`／插画 \`50px\`。建筑从属资产详情继续使用桌面 \`68px\`、移动 \`58px\` 的 \`FacilityIcon\`。所有插画不得拉伸或重复。商品数据行整行是唯一详情入口并使用统一 hover／active／focus 反馈，移动端不产生 hover 状态。下单禁用必须说明资金或可售资产不足的具体原因；玩家商品和工厂合计未完成订单达到当前商品类型数与工厂类型数之和的 10 倍时，也必须在提交区说明动态上限并禁用提交。本地成交表必须显示成交总额以及卖方“手续费／实收”，买方对应位置显示无手续费，不得新增来源或对手列。行情聚合仍使用最近 24h 与 240 个六分钟分段的同一时间窗口，但行情卡不得显示行情图下方统计栏；ECharts Tooltip 只能显示当前分段时间、价格、总量和方向汇总。稀疏订单簿按内容自然高度显示。\n\n`,
);

// UI design: register the shared row and replace the former seven-field/two-row catalog rule.
replaceExact('docs/UI_DESIGN_SYSTEM.md', '> 更新时间：2026-08-23', '> 更新时间：2026-08-24');
replaceExact(
  'docs/UI_DESIGN_SYSTEM.md',
  '| `src/styles/unified-market-admin.css` | 统一市场与管理员页面布局 |',
  '| `src/styles/unified-market-admin.css` | 统一市场与管理员页面布局 |\n| `src/styles/market-commodity-row.css` | 全局商品详情与地区市场共享的紧凑商品数据行、默认折叠筛选 disclosure 和移动单行收缩规则 |',
);
replaceExact(
  'docs/UI_DESIGN_SYSTEM.md',
  '- `CurrencyAmount`\n- `CurrencyText`',
  '- `CurrencyAmount`\n- `MarketCommodityRow`\n- `CurrencyText`',
);
replaceExact(
  'docs/UI_DESIGN_SYSTEM.md',
  '- 市场目录只展示商品，筛选栏和商品行直接位于正文，不提供“市场行情／自动交易”工作区、四张目录汇总统计卡或商品列表外层一级卡片；自动交易只在当前地区商品详情显示并锁定当前商品。工厂资产交易只从建筑详情打开从属交易视图，不得恢复市场工厂目录、第二个一级市场页面、双列买卖盘或工厂固定价格卡。',
  '- 一级市场采用“商品目录 → 商品全局详情 → 地区商品详情”，地区州上下文采用“地区商品目录 → 地区商品详情”；两条路径最终都复用同一个地区商品详情、订单簿、下单和自动交易实现。一级市场不显示独立地区市场面板，地区目录不提供“市场行情／自动交易”工作区、四张目录汇总统计卡或商品列表外层一级卡片；工厂资产交易只从建筑详情打开从属交易视图。全局与地区市场筛选均使用原生 disclosure，默认折叠且不提供商品名称搜索框。',
);
replaceExact(
  'docs/UI_DESIGN_SYSTEM.md',
  '- 商品列表整行是唯一详情入口。身份槽使用 `64px` 正方形主视觉，调用 `ProductArtwork` 并固定为 `48px`。卖单量、买单量、挂单差额、市场价、基准偏离、24h 变化和挂单状态使用独立数据列；中窄与移动布局必须自然换为两列卡片摘要，不得隐藏字段或产生横向主滚动。列表行使用 `var(--radius-control)`、统一强边框和共享交互表面；桌面鼠标悬停不得位移，移动端只允许点击、选中和未选中反馈。商品详情头部复用对应主视觉；建筑从属交易详情调用按正式 ID 映射的 `FacilityIcon` 并保持居中 `cover`。',
  '- `MarketCommodityRow` 是商品全局详情地区行和地区市场目录的唯一共享商品数据行。整行固定为“商品身份｜卖单量｜买单量｜市场价｜24h｜箭头”，不显示挂单差额、基准偏离或挂单状态；这些分析指标只在具体地区商品详情保留。桌面身份槽使用 `42px`、商品插画 `34px`；不大于 620px 时收紧为 `34px / 29px`，极窄屏继续缩小。移动端仍保持单行，不得恢复两列／多行摘要卡、隐藏四项核心指标或产生横向主滚动。列表行使用 `var(--radius-control)`、统一边框和共享交互表面；桌面鼠标悬停不得位移。商品详情头部继续复用对应主视觉；建筑从属交易详情调用按正式 ID 映射的 `FacilityIcon` 并保持居中 `cover`。',
);

// Order book authority: the global list may inspect every region but never merges books.
replaceExact('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '> 更新时间：2026-08-16', '> 更新时间：2026-08-24');
replaceExact(
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  '当前市场使用“可筛选商品列表 → 商品详情”两级视图，不使用工厂固定价格挂牌卡，也不提供工厂目录。建筑资产订单簿只允许从建筑详情打开从属资产交易视图，返回时恢复原建筑详情；商品与工厂继续共享同一订单簿内核，但不得因此混入同一个可见目录。',
  '一级市场使用“商品目录 → 商品全局详情 → 地区商品详情”三级钻取；地图州上下文仍使用“地区商品目录 → 地区商品详情”短路径。商品全局详情只读取完整公开订单快照并按 `provinceId + assetKind + assetId` 分组展示各地区卖单量与买单量，绝不形成全国订单簿、全国深度或全国撮合。建筑资产订单簿只允许从建筑详情打开从属资产交易视图，返回时恢复原建筑详情；商品与工厂继续共享同一订单簿内核，但不得因此混入同一个可见目录。',
);
replaceExact(
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  '商品列表的市场价、基准偏离和 24h 变化以官方系统价 `officialPrice` 为准；`lastTradePrice` 仍用于最近成交摘要和订单簿微观信息，`lastPrice` 与商品基础价只可用于详情行情曲线内部填补空分段和对照。建筑从属资产详情继续显示对应工厂订单簿的真实成交与行情。',
  '地区商品目录和商品全局详情的地区行使用该地区官方系统价 `officialPrice` 与真实 24h 成交变化；基准偏离不在列表展示，只在具体地区商品详情计算。一级商品目录的跨州价格范围只能由各地区 `lastTradePrice` 形成，不得用 `officialPrice` 平均值、基础价或回退价制造全国市场价。`lastPrice` 与商品基础价只可用于详情行情曲线内部填补空分段和对照。建筑从属资产详情继续显示对应工厂订单簿的真实成交与行情。',
);

// Chart authority no longer owns a cross-state coverage bar; it keeps regional imbalance visualization only.
replaceSection(
  'docs/MARKET_CHART_LAYOUT_DESIGN.md',
  '### 7.1 市场数据可视化配套规则',
  '## 8. 浏览器回归',
  `### 7.1 市场数据可视化配套规则\n\n\`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md\` 继续负责全局市场、地区市场和商品详情的页面职责与州级经济隔离；本节只锁定市场信息层级中容易被误解的数据可视化语义。\n\n- 全局市场默认页不显示顶部统计摘要条或独立地区市场面板；商品标题、默认折叠筛选和商品目录直接作为 \`GlobalMarketPage\` 正文内容。点击商品后进入同页商品全局详情，再从地区行情行进入既有地区商品详情。\n- 全局市场商品行、筛选和商品全局详情地区行的响应式收敛必须依据 \`GlobalMarketPage\` 正文承载宽度而不是浏览器 viewport；列表轨道允许 \`minmax(0, 1fr)\` 收缩，不得制造横向主滚动。\n- 全局市场商品目录不再承载跨州覆盖条。商品全局详情的地区行情行只显示该地区商品的卖单量、买单量、官方市场价和真实 24h 变化；不得把不同地区订单簿合并为全国买卖盘，也不得从最低／最高成交价推导全国市场价。\n- 地区商品详情的 \`Balance Bar\` 只能使用当前 \`provinceId\` 的公开订单簿。中线表示买卖挂单量相等，左侧表示买单相对更多，右侧表示卖单相对更多；长度表示 \`|卖单量 − 买单量| / (卖单量 + 买单量)\` 的失衡程度，颜色只表示方向，不把任一方向解释为利好或利空。列表层不显示该失衡条。\n- 商品详情必须先给出市场基本面、生产者／消费者关系和近 24h 行情图，再显示手动下单与五档盘口。行情承担“当前事实与原因”的上下文，交易卡承担后续动作；不得为了把操作按钮抬高而重新把交易卡放到行情图之前。\n- 中窄与移动布局的共享商品数据行仍必须保留商品、卖单量、买单量、市场价和 24h 变化，并保持单行；不得恢复挂单差额、基准偏离、挂单状态等列表字段，也不得通过横向滚动维持桌面列宽。\n\n`,
);

// Page-content wrapper accepts only the legacy base checks that this final rule intentionally supersedes, then locks the replacement.
replaceExact(
  'scripts/verify-page-content.mjs',
  "const obsoleteBaseFailures = new Set([\n  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: | 建筑 | `buildings` | `BuildingsPage` |',",
  "const obsoleteBaseFailures = new Set([\n  'src/pages/MarketPage.tsx 缺少: market-catalog-row',\n  'src/pages/MarketPage.tsx 缺少: <ProductArtwork productId={entry.id} />',\n  'src/pages/MarketPage.tsx 缺少: <small>卖单量</small>',\n  'src/pages/MarketPage.tsx 缺少: <small>买单量</small>',\n  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: | 建筑 | `buildings` | `BuildingsPage` |',",
);
replaceExact(
  'scripts/verify-page-content.mjs',
  "  'src/pages/MarketPage.tsx',\n  'src/pages/BuildingsPage.tsx',",
  "  'src/pages/MarketPage.tsx',\n  'src/components/market/MarketCommodityRow.tsx',\n  'src/styles/market-commodity-row.css',\n  'src/pages/BuildingsPage.tsx',",
);
replaceExact(
  'scripts/verify-page-content.mjs',
  "    'data-global-scope=\"market\"',\n    'model.setSelectedProvinceId(provinceId);',\n    '<EmbeddedMarketPage model={model} embedded />',",
  "    'data-global-scope=\"market\"',\n    '<WidgetHeading title=\"商品\"',\n    'global-market-filter-disclosure',\n    'selectedGlobalProductId',\n    'global-market-product-detail-panel',\n    '<MarketCommodityRow',\n    'model.setSelectedProvinceId(provinceId);',\n    '<EmbeddedMarketPage model={model} embedded />',",
);
replaceExact(
  'scripts/verify-page-content.mjs',
  "for (const text of [\n  '<MetricCard',\n  'global-operation-metrics',",
  "for (const text of [\n  '<MetricCard',\n  'global-operation-metrics',",
); // no-op assertion keeps the anchor explicit
replaceExact(
  'scripts/verify-page-content.mjs',
  "for (const text of [\n  '<MetricCard',\n  'global-operation-metrics',\n  'global-current-scope-summary',",
  "for (const text of [\n  '<MetricCard',\n  'global-operation-metrics',\n  'global-current-scope-summary',",
); // retain building guard
const pageContentSource = read('scripts/verify-page-content.mjs');
const marketGuardAnchor = "for (const text of [\n  '<MetricCard',\n  'global-operation-metrics',";
const marketGuardInsert = `for (const text of [\n  'global-market-provinces-panel',\n  'global-market-province-row',\n  'MarketCoverageBar',\n]) forbidText('src/pages/GlobalMarketPage.tsx', text);\nfor (const text of [\n  '卖单量',\n  '买单量',\n  '市场价',\n  '24h',\n]) requireText('src/components/market/MarketCommodityRow.tsx', text);\nfor (const text of ['挂单差额', '基准偏离', '挂单状态']) forbidText('src/components/market/MarketCommodityRow.tsx', text);\nrequireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '商品目录 → 商品全局详情 → 地区商品详情');\nrequireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '筛选默认折叠且不提供商品名称搜索框');\n\n`;
if (!pageContentSource.includes(marketGuardInsert)) {
  const anchorIndex = pageContentSource.indexOf(marketGuardAnchor);
  if (anchorIndex < 0) throw new Error('scripts/verify-page-content.mjs: market guard anchor missing');
  write('scripts/verify-page-content.mjs', pageContentSource.slice(0, anchorIndex) + marketGuardInsert + pageContentSource.slice(anchorIndex));
}

// Browser regression: update catalog expectations from seven-field cards/search to folded filters and one compact row.
replaceTest(
  'tests/browser/market-runtime.spec.ts',
  'market commodity catalog exposes order-book metrics and opens a focused detail',
  'market commodity detail owns fixed auto-trade and catalog has no workspace switch',
  `test('market commodity catalog keeps compact core metrics and opens a focused detail', async ({ page }) => {\n  const pageErrors = await capturePageErrors(page);\n  await page.setViewportSize({ width: 1400, height: 900 });\n  await page.goto('market-runtime-test.html?scenario=active&view=catalog');\n\n  await expect(page.getByRole('heading', { name: '加利福尼亚州市场', exact: true })).toBeVisible();\n  await expect(page.getByRole('searchbox')).toHaveCount(0);\n  const filters = page.locator('.market-catalog-filter-disclosure');\n  expect(await filters.getAttribute('open')).toBeNull();\n  await filters.locator('summary').click();\n  await selectRichOption(page, '分类', '原材料');\n  await selectRichOption(page, '市场状态', '有真实成交');\n\n  const wheatRow = page.getByRole('button', { name: '查看小麦详情' });\n  await expect(wheatRow).toBeVisible();\n  await expect(wheatRow.locator('.product-artwork')).toHaveAttribute('data-product-artwork', 'wheat');\n  await expect(wheatRow.locator('.market-commodity-row__name strong')).toHaveText('小麦');\n  await expect(wheatRow.locator('.market-commodity-row__name small')).toHaveText('原材料');\n  for (const label of ['卖单量', '买单量', '市场价', '24h']) {\n    await expect(wheatRow.getByText(label, { exact: true })).toBeVisible();\n  }\n  for (const label of ['挂单差额', '基准偏离', '挂单状态']) {\n    await expect(wheatRow.getByText(label, { exact: true })).toHaveCount(0);\n  }\n  await wheatRow.click();\n\n  await expect(page.locator('.regional-entity-title__name')).toHaveText('小麦');\n  await expect(page.locator('.regional-entity-title__region')).toHaveText('加利福尼亚州');\n  await expect(page.getByRole('heading', { name: '商品基本面', exact: true })).toBeVisible();\n  await expect(page.getByText('基准偏离', { exact: true }).first()).toBeVisible();\n  await expect(page.getByText('挂单差额', { exact: true })).toBeVisible();\n  await expect(page.locator('.market-trade-card')).toBeVisible();\n  expect(pageErrors).toEqual([]);\n});`,
);
replaceTest(
  'tests/browser/market-runtime.spec.ts',
  'market detail back action restores the filtered catalog',
  'mobile market catalog uses summary rows without horizontal overflow',
  `test('market detail back action restores the filtered catalog', async ({ page }) => {\n  const pageErrors = await capturePageErrors(page);\n  await page.setViewportSize({ width: 1400, height: 900 });\n  await page.goto('market-runtime-test.html?scenario=active&view=catalog');\n\n  const filters = page.locator('.market-catalog-filter-disclosure');\n  expect(await filters.getAttribute('open')).toBeNull();\n  await filters.locator('summary').click();\n  await selectRichOption(page, '分类', '原材料');\n  await selectRichOption(page, '市场状态', '有真实成交');\n  await selectRichOption(page, '排序', '市场价');\n  await page.getByRole('button', { name: '查看小麦详情' }).click();\n  await page.getByRole('button', { name: '返回商品列表' }).click();\n\n  await filters.locator('summary').click();\n  await expect(page.getByRole('combobox', { name: '分类' })).toContainText('原材料');\n  await expect(page.getByRole('combobox', { name: '市场状态' })).toContainText('有真实成交');\n  await expect(page.getByRole('combobox', { name: '排序' })).toContainText('市场价');\n  await expect(page.getByRole('button', { name: '查看小麦详情' })).toBeVisible();\n  await expect(page.getByRole('searchbox')).toHaveCount(0);\n  expect(pageErrors).toEqual([]);\n});`,
);
replaceTest(
  'tests/browser/market-runtime.spec.ts',
  'mobile market catalog uses summary rows without horizontal overflow',
  'market order book keeps sell five to buy five sequence and fills price without submitting',
  `test('mobile market catalog keeps one compact row without horizontal overflow', async ({ page }) => {\n  const pageErrors = await capturePageErrors(page);\n  await page.setViewportSize({ width: 390, height: 844 });\n  await page.goto('market-runtime-test.html?scenario=active&view=catalog');\n\n  const wheatRow = page.getByRole('button', { name: '查看小麦详情' });\n  await expect(wheatRow).toBeVisible();\n  const inspect = () => page.locator('.market-catalog-surface').evaluate((panel) => {\n    const row = panel.querySelector<HTMLElement>('.market-commodity-row');\n    const identity = row?.querySelector<HTMLElement>('.market-commodity-row__identity');\n    const metrics = row ? [...row.querySelectorAll<HTMLElement>('.market-commodity-row__metric')] : [];\n    if (!row || !identity || metrics.length !== 4) throw new Error('mobile market catalog fixture is incomplete');\n    const identityRect = identity.getBoundingClientRect();\n    return {\n      panelClientWidth: panel.clientWidth,\n      panelScrollWidth: panel.scrollWidth,\n      rowClientWidth: row.clientWidth,\n      rowScrollWidth: row.scrollWidth,\n      rowColumns: getComputedStyle(row).gridTemplateColumns.split(' ').filter(Boolean).length,\n      identityCenter: identityRect.top + identityRect.height / 2,\n      metricCenters: metrics.map((metric) => {\n        const rect = metric.getBoundingClientRect();\n        return rect.top + rect.height / 2;\n      }),\n    };\n  });\n  let layout = await inspect();\n  expect(layout.panelScrollWidth).toBeLessThanOrEqual(layout.panelClientWidth + 1);\n  expect(layout.rowScrollWidth).toBeLessThanOrEqual(layout.rowClientWidth + 1);\n  expect(layout.rowColumns).toBe(6);\n  for (const center of layout.metricCenters) expect(Math.abs(center - layout.identityCenter)).toBeLessThan(6);\n  for (const label of ['卖单量', '买单量', '市场价', '24h']) await expect(wheatRow.getByText(label, { exact: true })).toBeVisible();\n  for (const label of ['挂单差额', '基准偏离', '挂单状态']) await expect(wheatRow.getByText(label, { exact: true })).toHaveCount(0);\n\n  await page.setViewportSize({ width: 320, height: 720 });\n  layout = await inspect();\n  expect(layout.panelScrollWidth).toBeLessThanOrEqual(layout.panelClientWidth + 1);\n  expect(layout.rowScrollWidth).toBeLessThanOrEqual(layout.rowClientWidth + 1);\n  expect(layout.rowColumns).toBe(6);\n  expect(pageErrors).toEqual([]);\n});`,
);
replaceTest(
  'tests/browser/market-runtime.spec.ts',
  'market product artwork keeps fixed catalog and detail slots without stretching',
  null,
  `test('market product artwork keeps compact catalog and detail slots without stretching', async ({ page }) => {\n  const pageErrors = await capturePageErrors(page);\n  await page.setViewportSize({ width: 1400, height: 900 });\n  await page.goto('market-runtime-test.html?scenario=active&view=catalog');\n\n  const wheatRow = page.getByRole('button', { name: '查看小麦详情' });\n  const catalogMetrics = await wheatRow.evaluate((element) => {\n    const slot = element.querySelector<HTMLElement>('.market-commodity-row__artwork');\n    const artwork = slot?.querySelector<HTMLElement>('.product-artwork');\n    if (!slot || !artwork) throw new Error('market product catalog artwork is missing');\n    return {\n      slot: [Math.round(slot.getBoundingClientRect().width), Math.round(slot.getBoundingClientRect().height)],\n      artwork: [Math.round(artwork.getBoundingClientRect().width), Math.round(artwork.getBoundingClientRect().height)],\n      backgroundSize: getComputedStyle(artwork).backgroundSize,\n    };\n  });\n  expect(catalogMetrics).toEqual({ slot: [42, 42], artwork: [34, 34], backgroundSize: 'contain' });\n\n  await wheatRow.click();\n  const detailMetrics = await page.locator('.market-detail-hero__artwork').evaluate((slot) => {\n    const artwork = slot.querySelector<HTMLElement>('.product-artwork');\n    if (!artwork) throw new Error('market product detail artwork is missing');\n    return {\n      slot: [Math.round(slot.getBoundingClientRect().width), Math.round(slot.getBoundingClientRect().height)],\n      artwork: [Math.round(artwork.getBoundingClientRect().width), Math.round(artwork.getBoundingClientRect().height)],\n    };\n  });\n  expect(detailMetrics).toEqual({ slot: [76, 76], artwork: [58, 58] });\n\n  await page.getByRole('button', { name: '返回商品列表' }).click();\n  await page.setViewportSize({ width: 390, height: 844 });\n  await expect.poll(() => wheatRow.evaluate((element) => {\n    const slot = element.querySelector<HTMLElement>('.market-commodity-row__artwork');\n    const artwork = slot?.querySelector<HTMLElement>('.product-artwork');\n    if (!slot || !artwork) throw new Error('mobile market product catalog artwork is missing');\n    return [Math.round(slot.getBoundingClientRect().width), Math.round(artwork.getBoundingClientRect().width)];\n  })).toEqual([34, 29]);\n  await wheatRow.click();\n  await expect.poll(() => page.locator('.market-detail-hero__artwork > .product-artwork').evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(50);\n  expect(pageErrors).toEqual([]);\n});`,
);

// Add one end-to-end global-market drilldown regression to the account-free full shell.
const previewPath = 'tests/browser/all-pages-preview.spec.ts';
let preview = read(previewPath);
const globalTestName = "global market drills from commodity to regional quotes and existing trade detail";
if (!preview.includes(globalTestName)) {
  const insertBefore = "test('player page heading keeps SVG back, centered title, and SVG close in that order'";
  const index = preview.indexOf(insertBefore);
  if (index < 0) throw new Error('all-pages-preview: insertion anchor missing');
  const testSource = `test('${globalTestName}', async ({ page }) => {\n  await page.setViewportSize({ width: 1440, height: 900 });\n  await page.goto('?preview=game');\n  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();\n\n  const catalogFilters = page.locator('.global-market-filter-disclosure').first();\n  expect(await catalogFilters.getAttribute('open')).toBeNull();\n  await expect(page.getByRole('searchbox')).toHaveCount(0);\n  await page.getByRole('button', { name: '打开小麦全局详情' }).click();\n  await expect(page.getByRole('heading', { level: 1, name: '小麦' })).toBeVisible();\n  await expect(page.locator('.global-market-product-detail-panel')).toBeVisible();\n\n  const regionalRow = page.getByRole('button', { name: '打开加利福尼亚州小麦详情' });\n  await expect(regionalRow).toBeVisible();\n  for (const label of ['卖单量', '买单量', '市场价', '24h']) await expect(regionalRow.getByText(label, { exact: true })).toBeVisible();\n  for (const label of ['挂单差额', '基准偏离', '挂单状态']) await expect(regionalRow.getByText(label, { exact: true })).toHaveCount(0);\n  const geometry = await regionalRow.evaluate((row) => ({ clientWidth: row.clientWidth, scrollWidth: row.scrollWidth }));\n  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);\n\n  await regionalRow.click();\n  await expect(page.locator('.regional-entity-title__name')).toHaveText('小麦');\n  await expect(page.locator('.regional-entity-title__region')).toHaveText('加利福尼亚州');\n  await expect(page.locator('.market-trade-card')).toBeVisible();\n  await page.getByRole('button', { name: '返回商品全局详情' }).click();\n  await expect(page.locator('.global-market-product-detail-panel')).toBeVisible();\n});\n\n`;
  preview = preview.slice(0, index) + testSource + preview.slice(index);
  write(previewPath, preview);
}

console.log('One-time market finalization applied.');
