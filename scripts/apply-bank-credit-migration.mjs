import { readFileSync, writeFileSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, text) { writeFileSync(path, text, 'utf8'); }
function replaceOnce(path, from, to) {
  const text = read(path);
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one exact match, found ${count}: ${from.slice(0, 120)}`);
  write(path, text.replace(from, to));
}
function replaceSection(path, start, next, replacement) {
  const text = read(path);
  const startAt = text.indexOf(start);
  const nextAt = text.indexOf(next, startAt + start.length);
  if (startAt < 0 || nextAt < 0 || nextAt <= startAt) throw new Error(`${path}: section boundary not found: ${start} -> ${next}`);
  write(path, `${text.slice(0, startAt)}${replacement.trimEnd()}\n\n${text.slice(nextAt)}`);
}

replaceOnce(
  'src/api/game.ts',
  "  bankBorrow: (amount: number, collateral: Array<{ provinceId: string; facilityTypeId: string; quantity: number }>, autoRepay = true) => (\n    postAction('/bank/loans', { amount, collateral, autoRepay })\n  ),",
  "  bankBorrow: (amount: number, termHours: number, autoRepay = true) => (\n    postAction('/bank/loans', { amount, termHours, autoRepay })\n  ),",
);
replaceOnce(
  'src/app/gameViewModel.ts',
  "  bankBorrow: (amount: number, collateral: Array<{ provinceId: string; facilityTypeId: string; quantity: number }>, autoRepay?: boolean) => Promise<ActionResult>;",
  "  bankBorrow: (amount: number, termHours: number, autoRepay?: boolean) => Promise<ActionResult>;",
);
replaceOnce(
  'src/app/gameViewModel.ts',
  "    bankBorrow: (amount, collateral, autoRepay = true) => runAction('bankBorrow', () => gameActions.bankBorrow(amount, collateral, autoRepay)),",
  "    bankBorrow: (amount, termHours, autoRepay = true) => runAction('bankBorrow', () => gameActions.bankBorrow(amount, termHours, autoRepay)),",
);
replaceOnce('src/pages/BankPage.tsx', "const CREDIT_TERM_CARRIER_PROVINCE_ID = '__bank_credit_term__';\n", '');
replaceOnce(
  'src/pages/BankPage.tsx',
  "              () => model.bankBorrow(\n                requestedLoan || 0,\n                [{\n                  provinceId: CREDIT_TERM_CARRIER_PROVINCE_ID,\n                  facilityTypeId: `bank-credit-term-${loanTermHours}`,\n                  quantity: 1,\n                }],\n                true,\n              ),",
  "              () => model.bankBorrow(requestedLoan || 0, loanTermHours, true),",
);
replaceOnce(
  'tests/browser/bank-runtime-harness.tsx',
  "  bankBorrow: async (\n    amount: number,\n    carrier: Array<{ provinceId: string; facilityTypeId: string; quantity: number }>,\n  ) => {\n    document.body.dataset.borrowAmount = String(amount);\n    document.body.dataset.borrowTerm = carrier[0]?.facilityTypeId || '';\n    return { ok: true, message: '贷款成功' };\n  },",
  "  bankBorrow: async (amount: number, termHours: number) => {\n    document.body.dataset.borrowAmount = String(amount);\n    document.body.dataset.borrowTerm = String(termHours);\n    return { ok: true, message: '贷款成功' };\n  },",
);
replaceOnce(
  'tests/browser/bank-runtime.spec.ts',
  "  await expect.poll(() => page.locator('body').getAttribute('data-borrow-term')).toBe('bank-credit-term-168');",
  "  await expect.poll(() => page.locator('body').getAttribute('data-borrow-term')).toBe('168');",
);
replaceOnce(
  'scripts/verify-provincial-economy.mjs',
  "const banking = read('server/src/banking.js');\nfor (const text of [\n  'const provinceId = normalizeProvinceId(item?.provinceId);',",
  "const banking = read('server/src/banking-legacy.js');\nfor (const text of [\n  'const provinceId = normalizeProvinceId(item?.provinceId);',",
);
replaceOnce(
  'scripts/verify-banking.mjs',
  "  'bank-credit-term-168',",
  "  \"toBe('168')\",",
);
replaceOnce(
  'scripts/verify-banking.mjs',
  "for (const text of ['bankDeposit', 'bankWithdraw', 'bankBorrow', 'bankRepay', 'bankSetAutoRepay']) {\n  requireText('src/api/game.ts', text);\n  requireText('src/app/gameViewModel.ts', text);\n}",
  "for (const text of ['bankDeposit', 'bankWithdraw', 'bankBorrow', 'bankRepay', 'bankSetAutoRepay']) {\n  requireText('src/api/game.ts', text);\n  requireText('src/app/gameViewModel.ts', text);\n}\nrequireText('src/api/game.ts', \"bankBorrow: (amount: number, termHours: number, autoRepay = true)\");\nrequireText('src/api/game.ts', \"postAction('/bank/loans', { amount, termHours, autoRepay })\");\nrequireText('src/app/gameViewModel.ts', 'bankBorrow: (amount: number, termHours: number, autoRepay?: boolean)');\nforbidText('src/pages/BankPage.tsx', 'CREDIT_TERM_CARRIER_PROVINCE_ID');",
);

replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '资产总览、资金管理、活跃周固定存款利息、周资金结算、工厂冻结融资、额度评估与还款',
  '资产总览、资金管理、活跃周固定存款利息、周资金结算、资产授信贷款、周期与额度评估及还款',
);
replaceSection(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '## 8. 银行',
  '## 9. 排行',
  `## 8. 银行

页面主标题固定为“银行”，使用路由 ID \`bank\` 和 \`BankPage\`。标题区只显示主标题，不提供银行专属副标题。页面顺序固定为“资产总览／资金管理／银行贷款／银行记录”。银行是资产结果和银行操作的唯一归属页面，不得恢复独立资产页。

“资产总览”继续在同一张一级卡片中依次承载：唯一的当前净资产主指标、资产毛值／贷款负债／可支配资产／冻结资产四项次级指标、现金／商品／工厂／商业建筑毛值配置比例，以及资产构成表。净资产、资产毛值、贷款负债、可支配资产和冻结资产合计在页面中各只显示一次；不得恢复平行顶部摘要卡，也不得把“资产配置”和“资产估值明细”拆成两个一级卡片。资产估值唯一读取服务器权威结果，页面不得建立银行专用估值算法。

“资金管理”统一使用余额条加“资金转移／本周资金计划”工作区。余额条只展示可用资金、银行存款和今日计息余额。资金转移只保留一个金额输入，通过“存入／取出”互斥切换选择方向，并提供 25%／50%／最大快捷金额；切换方向时清空上一方向金额草稿。贷款处于宽限或追偿期时取出入口禁用，但存入保持可用。

“本周资金计划”集中展示固定日利率、本周是否由成功经济写操作激活、计息开始时间、下一次北京时间结息时间、昨日与累计利息、预计周末计税资金、预计 10% 周扣除和待完成账单。该区域只整理服务器已经返回的权威状态与估算，不自行推导新的周净收益、税基、扣除、利息池或补贴结果。页面必须说明存款从激活后的下一自然日按每日固定 1% 计息，冻结资金计入周末估算但不会被直接解冻或扣除；普通玩家页面不得展示内部利息池或补贴发行明细。

无贷款时，“银行贷款”只显示资产授信决策，不再出现抵押物或冻结资产选择。主要决策信息固定包括授信资产净值、最高可贷额度、申请金额、授信利用率、剩余授信、贷款周期、额度使用加点、锁定总利率、预计总利息和预计应还总额；“授信依据”只展示基础授信比例、良好还款记录、近期违约和最终授信比例。金额输入提供 25%／50%／75%／最大快捷金额，贷款周期使用 24h／72h／168h 三项共享分段按钮。授信利用率同时显示百分比与 \`progressbar\` 语义。客户端可以即时预览这些结果，但服务器必须在提交时重新计算资产净值、授信比例、额度、周期和利息并拒绝越界金额；预览不得写回权威状态或决定放款资格。

新资产授信贷款进行中时，“银行贷款”改为债务控制台，优先显示总应还、未偿本金、未付利息、授信利用率、锁定总利率、贷款周期和到期／宽限剩余时间，再显示自动还款、部分还款和全部还清。新贷款没有冻结明细，页面必须明确正常贷款期间工厂、商品和商业建筑不因银行贷款失去经营或交易资格。部分还款先付利息再还本金；自动还款说明必须明确先银行存款后可用资金。宽限结束仍未结清时必须说明服务器会依次追偿银行存款、可用资金、可用商品、可用工厂和商业建筑，不得提前预测具体处置数量或在浏览器自行处置。

规则切换前已存在的历史抵押贷款允许继续在同一债务控制台显示“历史抵押贷款”和原冻结工厂摘要，并继续使用原锁定期限、利率与处置条款直到结束；这是只读兼容，不得恢复新贷款抵押物选择、可冻结工厂列表、冻结数量输入、抵押估值或贷款价值比作为新贷款资格。倒计时到零统一只显示“等待服务器结算”，不得在浏览器本地改变贷款、利息、冻结或净资产。

银行记录继续使用服务器返回的最近 50 条权威记录，展示存款、取款、放款、还款、利息、自动还款、宽限和违约处置；页面允许提供“全部／存取／利息／贷款／结算”轻量筛选，筛选只作用于已经返回的最近 50 条数组，不新增服务器查询、浏览器权威流水或第二份记录。银行页面不得提供存款利率管理员输入、玩家间借贷、并行多笔贷款、普通货币购买宝石或银行储备工厂交易。`,
);
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '- 把工厂冻结融资恢复为依赖横向滚动的大表格、移动端逐工厂圆角卡片，或删除连续冻结列表中的可冻结数量、审慎单价、交易冻结和已冻结事实；',
  '- 把银行贷款恢复为新贷款抵押物选择、可冻结工厂列表、冻结数量输入、抵押估值或贷款价值比资格；历史抵押贷款只允许显示兼容冻结摘要；',
);
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '- 删除融资方案的授信利用率、剩余授信或透明“授信依据”，或让这些客户端预览参与服务器放款资格与金额计算；',
  '- 删除银行贷款的授信资产净值、贷款周期、授信利用率、剩余授信、额度使用加点或透明“授信依据”，或让这些客户端预览参与服务器放款资格与金额计算；',
);
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '- 让贷款冻结工厂退出生产、进入内部交易冻结字段 `frozenCount`，或允许冻结数量出售、拍卖或重复冻结；',
  '- 让新银行贷款冻结工厂、商品或商业建筑，或把历史抵押贷款的兼容冻结规则扩展到新贷款；',
);

replaceSection(
  'docs/UI_DESIGN_SYSTEM.md',
  '## 12. 银行页面布局',
  '## 13. 导航颜色与不透明度',
  `## 12. 银行页面布局

银行页使用 \`PageLayout\` 和 \`PagePanel\`，一级顺序固定为资产总览、资金管理、银行贷款、银行记录，标题只显示“银行”。\`src/styles/asset-overview.css\` 只负责资产总览内部几何；\`src/styles/bank.css\` 只负责余额条、资金工作区、贷款决策区、贷款周期选择、授信利用率、历史抵押贷款摘要、还款行、记录筛选和响应式重排。输入、按钮、开关、状态标签、金额、一级面板 inset、hover 和焦点继续由共享组件与令牌收束；普通滚动正文中的一级 \`PagePanel\` 仍按页面分区扁平化。

资金管理宽屏内部使用“资金转移／本周资金计划”双列，窄屏单列。资金转移只使用一个 \`MoneyInput\`，配合“存入／取出”互斥方向、\`25%／50%／最大\` 快捷金额和一个确认按钮，不得恢复两套平行存取表单。本周资金计划只整理服务器返回的计息资格、结息和周结算状态；余额条继续显示可用资金、银行存款和今日计息余额，不建立第二套净资产摘要。

银行贷款不使用抵押选择列表。贷款决策区必须显示授信资产净值、最高额度、申请金额、贷款周期、授信利用率、剩余授信、额度使用加点、锁定总利率、预计利息和应还总额；基础授信比例与还款／违约加减项收纳在“授信依据”中并同时显示文字和正负数值。贷款金额快捷项固定为 25%／50%／75%／最大，周期使用 24h／72h／168h 三项分段按钮；宽屏保持紧凑横排，窄屏可重排但不得引入横向滚动。授信利用率同时使用百分比和 \`progressbar\` 语义，颜色不能作为唯一表达。

当前新贷款优先显示总应还、本金、利息、授信利用率、总利率、贷款周期和剩余时间，再显示自动还款与还款操作；正常期间不展示冻结资产。宽限期必须用文字说明银行存款、可用资金、商品、工厂与商业建筑的追偿顺序。历史抵押贷款可用紧凑摘要展示原冻结工厂与兼容标签，但不得恢复连续冻结列表、抵押数量输入、审慎单价列或面向新贷款的冻结控件。银行记录可用共享分段按钮筛选但仍保持单一分隔记录列表。结息和贷款倒计时复用共享 \`useNow\` 与服务器单调时钟，到零只显示等待服务器确认；存款利率不显示年化值，微单位余数不渲染为普通货币，银行图标复用 \`BankIcon\`。`,
);
replaceOnce(
  'docs/UI_DESIGN_SYSTEM.md',
  '- 工厂详情“冻结中”数量统一合并交易／拍卖冻结、银行贷款冻结与玩家借贷合同冻结；这是展示汇总，不改变内部 `frozenCount` 的交易冻结语义，也不得让贷款冻结工厂退出生产。',
  '- 工厂详情“冻结中”数量统一合并交易／拍卖冻结、历史银行抵押贷款冻结与玩家借贷合同冻结；这是展示汇总，不改变内部 `frozenCount` 的交易冻结语义。新资产授信贷款不产生冻结数量；历史抵押贷款冻结工厂仍继续生产直到旧贷款结束。',
);

replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '- 银行贷款冻结数量继续参与生产，但不得出售、拍卖或重复冻结；贷款冻结与拍卖／交易冻结在内部仍分别保存，普通玩家界面统一归类为“冻结”。 内部 `frozenCount` 仍只表示交易／拍卖冻结；工厂详情的“冻结中”数量由客户端合并交易冻结、银行贷款冻结与玩家借贷合同冻结后展示。',
  '- 只有规则切换前尚未结束的历史银行抵押贷款冻结数量继续参与生产，但不得出售、拍卖或重复冻结；该兼容冻结与拍卖／交易冻结在内部仍分别保存。新资产授信贷款不冻结工厂。内部 `frozenCount` 仍只表示交易／拍卖冻结；工厂详情的“冻结中”数量由客户端合并交易冻结、历史银行抵押贷款冻结与玩家借贷合同冻结后展示。',
);

replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '| POST | `/api/game/bank/loans` | 按 `provinceId + facilityTypeId + quantity` 工厂冻结明细与服务器额度评估发放唯一进行中贷款 |',
  '| POST | `/api/game/bank/loans` | 按贷款金额与贷款周期，由服务器净资产授信评估发放唯一进行中贷款；新贷款不接收抵押资产语义 |',
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '- 工厂集群、当前与待生效配方、统一周期、即时建设结果与银行冻结数量；',
  '- 工厂集群、当前与待生效配方、统一周期、即时建设结果与历史银行抵押冻结数量；',
);
replaceSection(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '### 6.4 银行事务、利息与冻结不变量',
  '### 6.5',
  `### 6.4 银行事务、利息与贷款不变量

\`server/src/banking.js\` 是当前银行状态与结算的唯一权威入口；\`server/src/banking-legacy.js\` 只保存规则切换前历史抵押贷款的兼容实现。存取款、放款、还款、自动还款和违约追偿都通过现有普通游戏动作进入 \`BEGIN IMMEDIATE\`、幂等缓存、世界迁移、动作前推进、动作执行、动作后推进、资产校验与修订写回；相同幂等键不得重复转账、重复放款、重复还本付息、重复违约计数或重复处置资产。玩家冻结借贷合同仍由合同领域负责，其银行担保清算继续复用银行存款、风险准备金和 \`facilityReserves\`，不得与银行资产授信贷款混成一套状态机。

新银行贷款状态使用 \`creditLoan\`，请求业务语义只有贷款金额与贷款周期；服务器接受 24h／72h／168h 三档周期，在事务内重新计算玩家权威净资产、还款记录、近期违约、最终授信比例、最高额度、授信利用率、周期基础利率和额度利用率加点。客户端预览、客户端净资产或客户端计算的额度都不得覆盖服务器结果。放款同时增加玩家可用资金与同额本金负债，并锁定总利息；本金发行和等额负债不得提高净资产。新贷款不创建 \`collateral\`、\`mortgagedCount\` 或任何商品／工厂／商业建筑冻结。

规则切换前已经存在的历史 \`activeLoan\` 继续按旧抵押条款读取、还款、自动还款和违约处置，旧冻结工厂仍由 \`server/src/banking-legacy.js\` 维护直到贷款结束；新请求不得创建新的历史 \`activeLoan\`。状态投影在同一玩家上最多向普通客户端展示一笔当前银行贷款；放款资格必须同时拒绝已有 \`creditLoan\` 或历史 \`activeLoan\` 的玩家，避免两套状态并行借款。

借款人实际支付利息按 70%／20%／10% 精确拆分为存款利息池、人口银行服务就业和风险准备金。银行服务就业沿用既有基础人口 10%／技术人口 60%／专业人口 30% 分配；未付利息不得进入任何池。利息池继续使用百万分之一普通货币整数微单位保存，所有新贷款金额与利息在服务器输入、计算和保存边界收口到正式货币精度。

每日结息按 \`Asia/Shanghai\` 00:00 进入统一截止时间调度。只有成功经济写操作激活的当前自然周具备计息资格；有效计息余额是日初与当日最低存款的较小值，当日新增存款不得参与当日结息，取款、自动还款从存款扣除时必须同步降低最低余额。服务器按每日固定 1% 向下结算到六位微单位并直接计入存款，贷款利息池优先支付，缺口明确计入补贴发行。利息池最多保留按当前总存款和固定日利率计算的 7 日额度，超出部分转入风险准备金。

新资产授信贷款到期时自动还款先扣银行存款再扣可用资金；不足进入 12 小时宽限期并暂停取款。宽限结束仍有负债才开始全资产追偿，顺序为银行存款、可用资金、可用商品、可转让工厂、商业建筑。商品、工厂和商业建筑按正式服务器估值的 80% 形成追偿价值；已经被订单、拍卖、合同或其他权威机制冻结的资产不得重复使用。每类资产只处置覆盖剩余欠款所需的最少数量，先息后本，多余处置价值进入银行存款；工厂进入 \`world.bank.facilityReserves\`。全部当前可追偿资产仍不足时不得使用风险准备金替玩家核销，新贷款剩余本金与利息继续保留为负债，并至少每 6 小时重新尝试追偿；同一违约不得重复增加违约次数。历史 \`activeLoan\` 的抵押违约仍按原兼容条款完成，不套用新全资产追偿。

世界保存前必须满足：存款、利息池、风险准备金、新旧贷款金额和历史冻结数量均为安全非负值；历史抵押冻结数量不超过对应工厂可冻结边界；每名玩家新旧银行贷款合计最多一笔；贷款负债等于全部未偿本金与未付利息之和；玩家净资产按统一资产毛值扣除银行贷款、周结算和合同负债。任何违反都必须回滚整个动作，不得以静默清零、截断资产、重复发行资金或直接核销新贷款欠款修复。`,
);

write('scripts/apply-bank-credit-migration.done', 'bank credit migration applied\n');
console.log('Applied bank credit source and design migration.');
