import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

function replaceOnce(path, oldText, newText, label) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`${path}: ${label} not found`);
  const next = source.replace(oldText, newText);
  if (next === source) throw new Error(`${path}: ${label} made no change`);
  writeFileSync(path, next);
}

function replaceAllInFile(path, oldText, newText, label) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`${path}: ${label} not found`);
  const next = source.split(oldText).join(newText);
  if (next === source) throw new Error(`${path}: ${label} made no change`);
  writeFileSync(path, next);
}

// Single-factory profit follows the same daily official price that the player can execute immediately.
replaceAllInFile(
  'src/utils/recipeProfitAnalysis.ts',
  'lastTradePrice',
  'officialPrice',
  'profit price source field',
);
replaceOnce(
  'src/utils/facilityProfitPresentation.ts',
  '? `缺少${missingPriceLabel}成交价`',
  '? `缺少${missingPriceLabel}当日官方价`',
  'profit missing-price fallback',
);
replaceOnce(
  'src/utils/facilityProfitPresentation.ts',
  '? `${description}；缺少${missingPriceLabel}的最近真实成交价，无法估算`',
  '? `${description}；缺少${missingPriceLabel}的当日官方系统价，无法估算`',
  'profit missing-price detail',
);
replaceOnce(
  'src/utils/facilityProfitPresentation.ts',
  ': `${description}；缺少最近真实成交价，无法估算`',
  ': `${description}；缺少当日官方系统价，无法估算`',
  'profit generic missing-price detail',
);
replaceOnce(
  'src/utils/facilityProfitPresentation.ts',
  ': `${description}；按最近真实成交价和 ${staffingPercent}% 满员率线性估算，已扣除对应有效产能的单座原料成本与周期运营成本，不计玩家库存、挂单深度和交易手续费`;',
  ': `${description}；按当日官方系统价和 ${staffingPercent}% 满员率线性估算，已扣除对应有效产能的单座原料成本与周期运营成本，不计玩家库存、挂单深度和交易手续费`;',
  'profit official-price detail',
);

replaceOnce(
  'tests/browser/runtime-harness.tsx',
  '        lastPrice: 29,\n        lastTradePrice: 28.75,',
  '        lastPrice: 29,\n        officialPrice: 28.75,\n        lastTradePrice: 28.75,',
  'steel official-price fixture',
);
replaceOnce(
  'tests/browser/runtime-harness.tsx',
  '        lastPrice: 76,\n        lastTradePrice: 76.25,',
  '        lastPrice: 76,\n        officialPrice: 76.25,\n        lastTradePrice: 76.25,',
  'machinery official-price fixture',
);
replaceOnce(
  'tests/browser/production-status-summary.spec.ts',
  "test('renders decimal last trade prices in single-factory profit', async ({ page }) => {",
  "test('renders decimal daily official prices in single-factory profit', async ({ page }) => {",
  'profit browser title',
);

replaceOnce(
  'scripts/verify-recipe-profit-analysis.mjs',
  "function market(productId, lastTradePrice, lastPrice = 999) {\n  return { productId, lastPrice, lastTradePrice, priceHistory: [], demand: {} };\n}",
  "function market(productId, officialPrice, lastTradePrice = 998, lastPrice = 999) {\n  return { productId, officialPrice, lastPrice, lastTradePrice, priceHistory: [], demand: {} };\n}",
  'profit verifier market fixture',
);
replaceOnce(
  'scripts/verify-recipe-profit-analysis.mjs',
  "assert.equal(cluster.inputs[0].lastTradePrice, 3, '不得回退到 lastPrice');",
  "assert.equal(cluster.inputs[0].officialPrice, 3, '不得回退到 lastTradePrice 或 lastPrice');",
  'profit verifier source assertion',
);
replaceOnce(
  'scripts/verify-recipe-profit-analysis.mjs',
  "assert.equal(decimalPrices.profitPerMinute, 5, '合法两位小数成交价必须参与工厂产值计算');",
  "assert.equal(decimalPrices.profitPerMinute, 5, '合法两位小数官方价必须参与工厂产值计算');",
  'profit verifier decimal wording',
);
replaceOnce(
  'scripts/verify-recipe-profit-analysis.mjs',
  "assert.equal(minimumPrice.profitPerMinute, 0.01, '0.01 最小合法成交价必须参与工厂产值计算');",
  "assert.equal(minimumPrice.profitPerMinute, 0.01, '0.01 最小合法官方价必须参与工厂产值计算');",
  'profit verifier minimum wording',
);
replaceOnce(
  'scripts/verify-recipe-profit-analysis.mjs',
  "  'lastTradePrice: 28.75',\n  'lastTradePrice: 76.25',",
  "  'officialPrice: 28.75',\n  'officialPrice: 76.25',",
  'profit runtime fixture verifier',
);
replaceOnce(
  'scripts/verify-recipe-profit-analysis.mjs',
  "  'renders decimal last trade prices in single-factory profit',",
  "  'renders decimal daily official prices in single-factory profit',",
  'profit browser verifier title',
);
replaceOnce(
  'scripts/verify-recipe-profit-analysis.mjs',
  "  '最近真实成交价必须使用统一订单簿的价格边界',",
  "  '当日官方系统价必须使用统一两位小数价格边界',",
  'profit design verifier price rule',
);
replaceOnce(
  'scripts/verify-recipe-profit-analysis.mjs',
  "for (const text of [\n  \"import { isValidOrderPrice } from './defaultOrderPrice';\",\n  'isValidOrderPrice(value)',\n]) assert.ok(profitSource.includes(text), `工厂产值计算缺少统一价格边界: ${text}`);",
  "for (const text of [\n  \"import { isValidOrderPrice } from './defaultOrderPrice';\",\n  'isValidOrderPrice(value)',\n  'markets[productId]?.officialPrice',\n]) assert.ok(profitSource.includes(text), `工厂产值计算缺少统一官方价边界: ${text}`);\nassert.equal(profitSource.includes('markets[productId]?.lastTradePrice'), false, '单厂利润不得回退最近成交价');\nassert.ok(presentationSource.includes('按当日官方系统价和'), '单厂利润说明必须使用当日官方系统价');",
  'profit official-price anti-regression verifier',
);
replaceOnce(
  'scripts/verify-recipe-profit-analysis.mjs',
  "  '窄屏利润分析保持紧凑而不删减信息',\n]) assert.equal(designSource.includes(removedText), false, `产业设计不得保留旧利润卡规则: ${removedText}`);",
  "  '窄屏利润分析保持紧凑而不删减信息',\n  '单厂平均利润只读取商品最近一次统一订单簿真实成交价',\n  '最近真实成交价 · 满员率',\n]) assert.equal(designSource.includes(removedText), false, `产业设计不得保留旧利润卡或旧成交价规则: ${removedText}`);",
  'profit obsolete design forbids',
);

// Product/gameplay demand planning keeps substitute/complement mechanics without restoring a player ask book.
replaceOnce(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '工厂交易只转移所有者，不改变世界结构承载；即时建设成功前不存在可计入的工厂，抵押、挂单或拍卖冻结的已建成工厂仍计入结构承载。',
  '工厂拍卖成交只转移所有者，不改变世界结构承载；即时建设成功前不存在可计入的工厂，银行抵押或拍卖冻结的已建成工厂仍计入结构承载。',
  'product factory ownership boundary',
);
replaceOnce(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '商品供需压力是有符号状态，目标限制在 0.75～1.35，并按 70% 上周期与 30% 当前目标平滑。服务缺口继续直接进入压力；玩家主动买卖失衡与公开卖单覆盖只在最近真实成交数量形成证据置信度后生效，权重分别为 0.08 与 0.10，低成交市场不得因少量卖单重复放大通缩。玩家隐藏库存仍不得进入压力计算。',
  '商品供需压力是有符号状态，目标限制在 0.75～1.35，并按 70% 上周期与 30% 当前目标平滑。服务缺口继续直接进入压力；玩家主动买卖失衡与最近 30 分钟真实玩家向官方系统完成的卖出数量形成的供给覆盖，只在真实成交数量形成证据置信度后生效，权重分别为 0.08 与 0.10，低成交市场不得因少量成交重复放大通缩。玩家隐藏库存与历史开放挂单仍不得进入压力计算。',
  'product pressure supply evidence',
);
replaceOnce(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '有效价格 = 50% × 订单簿深度加权报价\n         + 30% × 当前参考价\n         + 20% × 过去 30 分钟真实成交 VWAP',
  '有效价格 = 50% × 同州当日 `officialPrice`\n         + 30% × 当前参考价\n         + 20% × 过去 30 分钟真实成交 VWAP',
  'product effective-price formula',
);
replaceOnce(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '没有真实成交时，VWAP 权重转由参考价承担。订单簿深度报价必须读取满足目标数量所需的加权价格，不得使用一件低价挂单代表整个市场。',
  '没有真实成交时，VWAP 权重转由参考价承担。同州当日 `officialPrice` 是玩家可立即执行的现货价格；可购性只读取最近 30 分钟真实玩家向官方系统完成的卖出数量相对于本次目标数量形成的供给覆盖率，不得扫描玩家开放卖单，也不得把玩家隐藏库存、内部人口／储备订单或历史挂单当作公开供给。',
  'product executable-price and supply coverage',
);
replaceOnce(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '路径计算必须读取配方自身的周期成本，不能使用工厂默认配方覆盖其他路线。路径份额按相对单位成本与输入卖单覆盖率共同计算；理论成本较低但长期没有原料的路线不得压低整个输出商品的成本锚点。',
  '路径计算必须读取配方自身的周期成本，不能使用工厂默认配方覆盖其他路线。路径份额按相对单位成本与输入内部可执行供给覆盖率共同计算；覆盖率来自同州最近 30 分钟真实玩家向官方系统完成的卖出数量，理论成本较低但长期没有真实供给证据的路线不得压低整个输出商品的成本锚点。',
  'product route supply coverage',
);
replaceOnce(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '对每个输入计算有效卖单覆盖率。某项输入的互补门控由其他输入的最低覆盖率决定：',
  '对每个输入计算内部有效供给覆盖率，来源仍是同州最近 30 分钟真实玩家向官方系统完成的卖出数量相对于需求目标的覆盖。某项输入的互补门控由其他输入的最低覆盖率决定：',
  'product complement supply coverage',
);
replaceOnce(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '价格信号只使用过去 30 分钟真实订单簿成交的成交量加权均价。价格观察中玩家之间和玩家与消费需求的成交使用 100% 权重，玩家与普通市场储备的成交使用 50% 权重，玩家与紧急储备卖单的成交使用 25% 权重；预算活跃度只读取玩家之间成交，消费需求和储备成交不得进入预算反馈。系统订单之间禁止成交。未成交挂单、取消订单、合成初始化行情、自成交和拍卖成交不得进入真实成交 VWAP。',
  '价格信号只使用过去 30 分钟已经写入真实成交历史的成交量加权均价。玩家与官方系统价市场的即时成交使用 100% 权重；服务器内部消费／储备模拟只有在形成允许记录的真实成交时才按既有 `signalWeight` 参与，其中普通储备为 50%、紧急储备为 25%。玩家成交活跃度不得扩大人口预算，只能作为供需压力证据；内部消费和储备成交不得进入玩家活跃度。两个 `ownerType = population` 的服务器内部订单仍禁止互相成交。未成交内部订单、取消记录、历史玩家挂单、合成初始化行情、自成交和拍卖成交不得进入真实成交 VWAP。',
  'product price-history source semantics',
);

// Industry design must no longer preserve retired factory orders or player ask-depth semantics.
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '玩家可用库存、冻结库存、库存价值和挂牌价值不得扩大需求总预算，也不得直接提高任何商品份额；只有有效卖单深度可以影响可购性。价格沿正式配方双向、逐边、滞后传导，详细规则以 `PRODUCT_AND_GAMEPLAY_DESIGN.md` 为准。',
  '玩家可用库存、冻结库存、库存价值和挂牌价值不得扩大需求总预算，也不得直接提高任何商品份额；可购性只读取内部可执行供给信号：同州当日 `officialPrice` 作为立即可执行价格，最近 30 分钟真实玩家向官方系统完成的卖出数量相对于目标数量形成供给覆盖率，运行时不得扫描玩家开放卖单。价格沿正式配方双向、逐边、滞后传导，详细规则以 `PRODUCT_AND_GAMEPLAY_DESIGN.md` 为准。',
  'industry executable supply signal',
);
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '结构承载读取 `facilityGroups[].count`。即时建设成功前不存在可计入的工厂；银行抵押、订单簿挂单或拍卖冻结的已建成工厂仍保留结构承载。工厂在玩家间买卖、拍卖成交或抵押处置只改变所有者，不改变世界总结构承载。',
  '结构承载读取 `facilityGroups[].count`。即时建设成功前不存在可计入的工厂；银行抵押或拍卖冻结的已建成工厂仍保留结构承载。工厂拍卖成交或抵押处置只改变所有者，不改变世界总结构承载。',
  'industry retired factory-order capacity language',
);
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '现有玩家迁移不得失去资产或承诺：旧 `unlockedComplexity` 授予对应完整阶段及之前阶段的全部科技；已拥有、施工、公开买单或最高竞拍承诺中的工厂授予该工厂科技及全部前置科技。',
  '现有玩家迁移不得失去资产或承诺：旧 `unlockedComplexity` 授予对应完整阶段及之前阶段的全部科技；已拥有、历史施工承诺或最高竞拍承诺中的工厂授予该工厂科技及全部前置科技。',
  'industry migration retired public factory buy order',
);
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '同一输出商品的生产路线份额同时读取单位生产成本和各输入公开卖单覆盖率；理论便宜但无法获得原料的路线不得主导派生需求。',
  '同一输出商品的生产路线份额同时读取单位生产成本和各输入内部可执行供给覆盖率；覆盖率只来自同州最近 30 分钟真实玩家向官方系统完成的卖出数量，理论便宜但没有真实供给证据的路线不得主导派生需求。',
  'industry route supply coverage',
);
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '施工完成、工厂买单或工厂拍卖成交、订单簿卖单撤销或拍卖取消／流拍解冻发生在运行期间时，服务器先结算动作时间点之前已经完成的完整周期，再立即把新增生产可用数量并入 `participatingCount`。`cycleStartedAt` 保持不变，生产进度不清零。',
  '新建完成、工厂拍卖成交转入或拍卖取消／流拍／结算失败解冻发生在运行期间时，服务器先结算动作时间点之前已经完成的完整周期，再立即把新增生产可用数量并入 `participatingCount`。`cycleStartedAt` 保持不变，生产进度不清零。',
  'industry running expansion retired order paths',
);
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '运行中提交工厂卖单或工厂拍卖立即减少参与数量；撤销、无人出价、未达保留价或结算失败解冻时立即恢复生产资格并执行同一稀释规则。',
  '运行中提交工厂拍卖立即减少参与数量；取消拍卖、无人出价、未达保留价或结算失败解冻时立即恢复生产资格并执行同一稀释规则。',
  'industry retired factory sell order path',
);
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '- 单厂平均利润／分钟继续复用统一展示模型与最近真实成交价，固定按一座工厂计算；它只在工厂信息区出现一次，不参与生产结算、订单撮合、估值、排行榜或市场需求。',
  '- 单厂平均利润／分钟继续复用统一展示模型与同州当日官方系统价，固定按一座工厂计算；它只在工厂信息区出现一次，不参与生产结算、内部订单撮合、估值、排行榜或市场需求。',
  'industry profit summary price source',
);
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '工厂集群选择卡右上角复用该指标及同一配方、成交价、满员率和缺价判断，不得建立第二套利润计算。',
  '工厂集群选择卡右上角复用该指标及同一配方、当日官方系统价、满员率和缺价判断，不得建立第二套利润计算。',
  'industry profit card official price',
);
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '单厂平均利润只读取商品最近一次统一订单簿真实成交价和服务器正式配方。原料与产出均按一座工厂的完整配方数量乘对应商品 `lastTradePrice` 计价；不得读取玩家库存、公开挂单、预计交易手续费或建造费。不得回退到商品基础价、系统参考价、当前挂单价、未成交价格或 `lastPrice`。最近真实成交价必须使用统一订单簿的价格边界：不低于 0.01、最多两位小数；客户端不得要求成交价为整数或不低于 1。',
  '单厂平均利润只读取工厂所在州各商品当日 `officialPrice` 和服务器正式配方。原料与产出均按一座工厂的完整配方数量乘对应商品当日官方系统价计价；不得读取玩家库存、公开挂单、最近成交价、预计交易手续费或建造费。不得回退到商品基础价、需求参考价、内部人口订单价、历史 `lastTradePrice` 或 `lastPrice`。当日官方系统价必须使用统一两位小数价格边界：不低于 0.01、最多两位小数；客户端不得要求官方价为整数或不低于 1。',
  'industry profit source paragraph',
);
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '单厂原料市场成本 = Σ（每项单座输入数量 × 对应商品最近真实成交价）\n单厂产出市场价值 = 单座产出数量 × 产出商品最近真实成交价',
  '单厂原料市场成本 = Σ（每项单座输入数量 × 对应商品当日官方系统价）\n单厂产出市场价值 = 单座产出数量 × 产出商品当日官方系统价',
  'industry profit formula price source',
);
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '任一实际需要的原料或产出商品没有最近真实成交价时，该行右侧必须直接显示缺失商品名称，例如“缺少砂糖、奶成交价”；不得只显示笼统的“暂无成交数据”，也不得使用部分盘口、基础价或其他替代价格补齐。',
  '任一实际需要的原料或产出商品没有有效当日官方系统价时，该行右侧必须直接显示缺失商品名称，例如“缺少砂糖、奶当日官方价”；不得只显示笼统的“暂无成交数据”，也不得使用最近成交价、基础价、内部人口订单价或其他替代价格补齐。',
  'industry profit missing price rule',
);
replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '详情只显示一行“单厂平均利润／分钟”：左侧为指标名称和“当前配方预计／下一周期预计／启动后预计／恢复后预计 · 最近真实成交价 · 满员率 R%”，右侧为按对应周期满员率线性缩放后的数值或内联缺价提示。',
  '详情只显示一行“单厂平均利润／分钟”：左侧为指标名称和“当前配方预计／下一周期预计／启动后预计／恢复后预计 · 当日官方系统价 · 满员率 R%”，右侧为按对应周期满员率线性缩放后的数值或内联缺价提示。',
  'industry profit visible wording',
);

replaceOnce(
  'scripts/verify-staple-crops-demand.mjs',
  "console.log('市场需求验证通过：模型 20 使用工厂承载驱动的实际人口与真实钱包覆盖全部 38 种商品，并按州级 PCE 权重生成本地需求；共享撮合只服务服务器内部人口／储备模拟，玩家商品交易保持每日系统价即时成交。');\n\nconst populationPolicy = read('server/src/population-policy.js');",
  "for (const [path, texts] of [\n  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['订单簿深度加权报价', '输入卖单覆盖率', '有效卖单覆盖率', '玩家主动买卖失衡与公开卖单覆盖']],\n  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['只有有效卖单深度可以影响可购性', '各输入公开卖单覆盖率', '订单簿挂单', '工厂买单', '订单簿卖单撤销', '运行中提交工厂卖单']],\n]) {\n  const source = read(path);\n  for (const text of texts) assert.equal(source.includes(text), false, `${path} 不得保留退役玩家盘口／工厂订单设计: ${text}`);\n}\n\nconsole.log('市场需求验证通过：模型 20 使用工厂承载驱动的实际人口与真实钱包覆盖全部 38 种商品，并按州级 PCE 权重生成本地需求；共享撮合只服务服务器内部人口／储备模拟，玩家商品交易保持每日系统价即时成交。');\n\nconst populationPolicy = read('server/src/population-policy.js');",
  'demand design obsolete-order forbids',
);

for (const temp of ['scripts/codex-fix-daily-market-consistency.mjs']) {
  if (existsSync(temp)) unlinkSync(temp);
}
