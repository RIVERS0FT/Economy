from pathlib import Path
import re
import subprocess


def sub(path, pattern, replacement, *, flags=re.S, count=1, label=None):
    p = Path(path)
    text = p.read_text()
    next_text, changed = re.subn(pattern, replacement, text, count=count, flags=flags)
    if changed != count:
        raise SystemExit(f'{label or path}: replacement count {changed}, expected {count}')
    p.write_text(next_text)


def replace(path, old, new, label=None):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'{label or path}: missing anchor {old[:120]}')
    p.write_text(text.replace(old, new, 1))


# Preserve the established formal page-module boundary while routing the named ContractPage export to the new workspace.
subprocess.run(['git', 'checkout', 'origin/main', '--', 'src/pages/PageRouter.tsx', 'scripts/verify-runtime-architecture.mjs'], check=True)
p = Path('src/pages/ContractPage.tsx')
text = p.read_text()
if "import { ContractWorkspacePage } from './ContractWorkspacePage';" not in text:
    text = "import { ContractWorkspacePage } from './ContractWorkspacePage';\n" + text
old_export = 'export function ContractPage({ model }: { model: TutorialAwareGameViewModel }) {'
if old_export not in text:
    raise SystemExit('ContractPage legacy export anchor missing')
text = text.replace(old_export, 'export function LegacyContractPage({ model }: { model: TutorialAwareGameViewModel }) {', 1)
if 'return <ContractWorkspacePage model={model} />;' not in text:
    text += "\n\nexport function ContractPage({ model }: { model: TutorialAwareGameViewModel }) {\n  return <ContractWorkspacePage model={model} />;\n}\n"
p.write_text(text)

# Beijing natural-day boundary for quota reset and normal end-of-day termination.
p = Path('server/src/daily-supply-contracts.js')
text = p.read_text()
replace('server/src/daily-supply-contracts.js',
        'export const CONTRACT_DAY_MS = 24 * 60 * 60 * 1000;\nexport const DAILY_SUPPLY_CONTRACT_SCHEMA_VERSION = 11;',
        'export const CONTRACT_DAY_MS = 24 * 60 * 60 * 1000;\nexport const CONTRACT_DAY_OFFSET_MS = 8 * 60 * 60 * 1000;\nexport const DAILY_SUPPLY_CONTRACT_SCHEMA_VERSION = 11;',
        'daily day constants')
replace('server/src/daily-supply-contracts.js',
        'const dayKey = (now) => Math.floor(Math.max(0, Number(now) || 0) / CONTRACT_DAY_MS);\nconst nextDayAt = (now) => (dayKey(now) + 1) * CONTRACT_DAY_MS;',
        'const dayKey = (now) => Math.floor((Math.max(0, Number(now) || 0) + CONTRACT_DAY_OFFSET_MS) / CONTRACT_DAY_MS);\nconst nextDayAt = (now) => (dayKey(now) + 1) * CONTRACT_DAY_MS - CONTRACT_DAY_OFFSET_MS;',
        'daily Beijing day key')

p = Path('server/test/daily-supply-contracts.test.js')
text = p.read_text()
if 'CONTRACT_DAY_OFFSET_MS' not in text:
    text = text.replace('  CONTRACT_DAY_MS,\n', '  CONTRACT_DAY_MS,\n  CONTRACT_DAY_OFFSET_MS,\n', 1)
text = text.replace('currentDayKey: Math.floor(NOW / CONTRACT_DAY_MS)', 'currentDayKey: Math.floor((NOW + CONTRACT_DAY_OFFSET_MS) / CONTRACT_DAY_MS)')
if "daily quota resets at Beijing midnight" not in text:
    text += """

test('daily quota resets at Beijing midnight', () => {
  const beforeMidnight = 2_000 * CONTRACT_DAY_MS - CONTRACT_DAY_OFFSET_MS - 1;
  const afterMidnight = beforeMidnight + 2;
  const state = world(dailyContract({
    acceptedAt: beforeMidnight - 1_000,
    startsAt: beforeMidnight - 1_000,
    endsAt: afterMidnight + 10 * CONTRACT_DAY_MS,
    currentDayKey: Math.floor((beforeMidnight + CONTRACT_DAY_OFFSET_MS) / CONTRACT_DAY_MS),
    dailyUsedQuantity: 10,
  }));
  processDailySupplyContracts(state, afterMidnight);
  assert.equal(state.productionContracts[0].dailyUsedQuantity, 0);
  assert.equal(
    state.productionContracts[0].nextDueAt,
    (Math.floor((afterMidnight + CONTRACT_DAY_OFFSET_MS) / CONTRACT_DAY_MS) + 1) * CONTRACT_DAY_MS - CONTRACT_DAY_OFFSET_MS,
  );
});
"""
p.write_text(text)

# Page authority: replace superseded current batch/renewal rules with daily quota rules; keep old contracts explicitly compatibility-only.
page_current = '''玩家新发布的商品采购／供应合同统一使用地区化每日额度模型，直接承接始终保留并可选结构化议价。条款固定为合同地区、商品、每日最大供应量、固定价格、合同时间（天，留空为长期）和开始延迟（天）；每日最大供应量只表示北京时间自然日内最多可实际使用的数量，未使用额度不补算、不跨日累计。议价只能修改每日最大供应量、固定价格、合同时间和开始延迟，商品、地区、发布方向和发布者固定；每份公开商品合同最多同时存在 3 个议价线程、每名玩家最多一个线程、每线程最多 5 轮，每次报价 24 小时无回应即失效且不得超过公开合同有效期。议价阶段不冻结资产；任一方接受对方最后报价时，服务器重新校验地区权限、参与数量、日额度货款和双方保证金后才原子进入履约。新每日额度商品合同不使用续签：有限合同到期后可重新发布，长期合同可申请当前北京时间自然日结束后正常终止。市场储备采购和已存在的旧商品合同继续按原有限批次／旧长期语义运行，只作为兼容路径，不得重新成为新发布入口；旧玩家商品合同协议中的 `totalDeliveries = null` 继续表示旧长期合同，旧长期合同不会因完成批次数自动结束且不接受续签。'''
sub('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', r'公开商品合作合同支持可选的结构化议价.*?全部通过后才原子进入现有履约状态。', page_current, label='page current contract model')

page_summary = '''合同页顶部只显示进行中的合同、等待我处理、1 天内边界和我的公开合同四项摘要。合同页的四项摘要在宽布局四列同排，宽度不大于 `960px` 时固定为两列；移动端继续保持两列，不能退回四个单列摘要把合同主体推离首屏。待处理判定统一包含服务器返回的合同异常、旧兼容合同宽限／已违约待解除、当前日结束申请和需要本人回应的结构化议价；每日额度合同没有“必须交满每日额度”的违约条件，未使用额度只在北京时间跨日时释放当日货款和商品预留并重置。进行中每日额度商品合同按待处理、下一状态边界和正常履约排序；待处理卡片使用警示色边框与柔和背景，并同时显示文字状态，颜色不得作为唯一表达。每日额度卡必须显示我采购或我供货、合作方、地区、商品、每日上限、今日已使用、今日剩余额度、固定价格、累计交付、当日货款托管和当日商品预留。旧商品合同仍可在兼容卡片中显示原批次字段。'''
sub('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', r'合同页顶部只显示进行中的合同.*?采购方托管货款。', page_summary, label='page summary current')

page_publish = '''发布合同面板必须使用 `PagePanel`。宽度不小于 `1220px` 时采用“左侧合同条款／右侧合同预览”的双列工作台，`721px–1219px` 时改为单列面板并让条款字段保持两列，宽度不大于 `720px` 时字段全部单列。发布面板必须先展示六种类型，移动端六类入口至少两列且不得横向溢出。商品采购／供应固定使用 `SelectInput` 选择合同地区与商品，使用 `IntegerInput`／`MoneyInput` 编辑每日最大供应量、固定价格、合同时间和开始延迟；合同时间留空提交 `durationDays = null` 表示长期，不得恢复总批次、交付周期或首次交付分钟／小时输入。借贷期限与租赁周期、首次生效也统一以天显示和提交；服务器内部兼容毫秒字段不得暴露为新表单单位。预览对商品合同集中展示地区、每日额度、固定价格、合同时间与保证金，不计算不存在的“理论批次总额”。'''
sub('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', r'发布合同面板必须使用 `PagePanel`。.*?不得用无穷大或虚假总额代替。', page_publish, label='page publish current')

page_active = '''进行中每日额度商品合同卡先展示当日额度状态，再展示固定条款。今日已使用、每日上限、今日剩余额度、当日货款托管、当日商品预留、固定价格、地区和下一状态边界属于当前履约事实；供应方自动准备与采购方自动补款继续使用 `ToggleField`／`SwitchControl`，手动准备／补款只处理当日剩余额度。供应方可额外设置“最低当日产量 + 最低合同价格”两个优先供应条件，两个条件同时满足后新增可用库存才自动预留；手动准备不受该自动条件阻断。每日额度商品合同不显示续签区；“按当前日结束”在下一个北京时间自然日边界正常结束，立即终止继续按发起方承担 20% 日额度保证金赔付。旧有限批次商品合同的当前批次、续签、宽限与受偿方主动解除界面只保留兼容展示；旧兼容续签中提出续签条款不代表同意续签，采购方与供应方仍必须分别明确同意，单方同意不冻结资产，不得被复制回新每日额度合同。'''
sub('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', r'进行中合同卡先展示当前批次履约状态.*?申请批次后结束与立即违约终止仍单独放在底部管理区。', page_active, label='page active current')

page_history = '''每条历史合同固定展示合同内容、结束原因、结束时间、完成事实、结束统计和“重新拟定”按钮。每日额度商品合同的完成事实以累计实际交付数量、实际交付事件和合同持续天数为准，不伪造“必须完成的每日数量”或批次完成率；旧有限批次／旧长期商品合同继续按其历史批次语义展示，借贷按一次性偿还、租赁按租金期数展示。结束原因和时间来自服务器终态摘要，客户端不得根据余额或本地时间推断；旧两阶段违约合同继续区分 `breachedAt` 与最终 `endedAt`。结束统计按当前玩家视角展示真实货款／租金、服务费、净收入、实际偿还、抵押处置、资金或商品退回以及非零赔付。旧合同缺少完整转移事件时显示部分统计提示，不伪造缺失过程。'''
sub('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', r'每条历史合同固定展示“合同内容.*?不伪造缺失过程。', page_history, label='page history current')

# Server authority: daily contracts are partial-use daily quotas; batch/grace/renewal rules are legacy-only.
server_accept = '''每日额度商品合同承接时，采购方和供应方分别冻结“固定价格 × 每日最大供应量”的 20% 履约保证金；采购方自动补款和供应方自动准备只为当前北京时间自然日剩余额度冻结真实货款／商品，不能透支未来资金、未来产量或其他地区库存。合同实际使用可以小于每日额度，并按每次真实取得数量即时转移同地区商品、扣除固定价货款和累计 1% 卖方市场服务费；未用满额度本身不是违约。跨日时先释放上一日未使用货款和商品预留，再把 `dailyUsedQuantity` 归零并按自动设置准备新一天。'''
sub('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', r'承接时采购方冻结首批完整货款.*?不能透支未来产量或未来收入。', server_accept, label='server daily acceptance')
replace('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '正式世界处理先结算到期生产周期，再执行合同自动准备、到期结算和宽限期违约确认。', '正式世界处理对旧有限批次合同继续维持到期生产、自动准备、批次结算与宽限；每日额度合同只在实际生产输入择源、手动／自动当日托管、北京时间自然日边界和合同到期边界推进，不因“当日额度未用满”启动宽限或违约。', 'server processing current')

server_settlement = '''旧有限批次商品合同继续在单一事务中按原批次规则检查冻结商品、冻结货款和兼容仓库条件，并保留“宽限结束只确认违约 → 受偿方主动解除”的两阶段状态机。每日额度商品合同没有整批强制交付：每次生产输入或显式使用只结算 `min(请求数量, 当日剩余额度, 已托管货款可支付数量, 已预留商品数量)`，允许同一自然日多次部分使用；额度、货款或预留不足时只停止本次合同消费并由生产流程继续尝试本地仓库／统一市场，不因为未消费的额度进入宽限。'''
sub('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', r'每批结算在一个事务中同时检查供应方冻结商品.*?任一条件不足不得部分交付，并进入宽限期；', server_settlement, label='server settlement current')
replace('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '**宽限结束只确认违约**：', '旧有限批次商品合同的 **宽限结束只确认违约**：', 'server default scope')

server_audit = '''合同审计必须同时区分新每日额度事件与旧兼容事件。每日额度合同覆盖发布、承接、议价、自动准备／补款设置变化、手动准备／补款、每次真实部分交付、北京时间跨日释放与重置、当前日结束申请、有限合同到期、立即违约终止和保证金赔付；交付事件必须记录真实 `lastDeliveryQuantity / lastDeliveryGross / lastDeliveryFee`，不得把每日上限伪装成实际交付量。旧有限批次合同继续保留原发布、批次准备／补款、宽限、逐批成功交付、续签、违约确认与受偿方领取事件。每个事件保存稳定事件类型、执行主体、触发类型、服务器事务时间、原因代码、前后紧凑快照和资产转移；玩家查询不得返回请求幂等键、来源哈希、世界修订号或其他玩家的非合同资产。旧世界既有合同只允许按已有审计完整度读取，不根据缺失字段伪造过程。'''
sub('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', r'合同审计必须覆盖发布、承接、手动或自动准备商品.*?不得根据完成批数或最后交付字段伪造上线前逐批历史；新发布合同标记为 `full`。', server_audit, label='server audit current')

replace('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '### 合同续签与公开经济事件调度', '### 旧有限批次商品合同续签兼容与公开经济事件调度', 'server renewal heading')
replace('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '合同 schema 8 在原合同上保存单个续签提议', '旧有限批次商品合同的 schema 8 在原合同上保存单个续签提议', 'server renewal scope')
replace('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '合同必须先预检双方、首批货款、双方保证金、商品与仓库容量，再进入进行中状态；任一批次失败不得部分转移。', '新每日额度商品合同必须先预检双方、地区权限、日额度保证金与当前日自动托管能力再进入进行中状态；实际交付允许在当日额度内分多次部分结算。旧有限批次商品合同继续按其首批货款、保证金和原批次原子规则兼容。', 'server invariant current')
replace('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '- `contracts.js`：三类合同的统一门面、生命周期、状态交付与供货合同结算；商品供货公开合同的结构化议价线程也由该模块权威维护，议价不冻结资产，接受最终报价后复用正式签约校验；合同 schema 10 同时在本模块维护“宽限结束只确认违约 → 已违约待解除 → 受偿方主动解除/领取”的两阶段违约状态机；', '- `unified-contracts.js`：三类合同的统一运行门面和新旧商品合同分流；`daily-supply-contracts.js` 权威维护玩家新发布的地区化每日额度商品合同与结构化议价；`contracts.js` 仅保留旧商品合同、市场储备合同和历史兼容，旧合同 schema 10 同时维护“宽限结束只确认违约 → 已违约待解除 → 受偿方主动解除/领取”的两阶段违约状态机；', 'server module registry')
replace('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '旧玩家长期商品合同迁移为默认地区的每日额度长期合同，市场储备固定条款合同继续保留有限批次机制。', '所有已存在的旧玩家商品合同（含旧长期合同）保持原语义直至结束，不强制转换为每日额度；旧玩家商品合同协议中 `totalDeliveries` 允许为 2～100 的整数或 `null`，其中 `null` 继续表示旧长期合同，旧长期合同不接受续签；市场储备固定条款合同继续保留有限批次机制。', 'server migration truth')
replace('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '每日额度按服务器权威自然日惰性重置', '每日额度按北京时间自然日惰性重置', 'server daily timezone')

# Root summary must describe the new current model and mark the previous batch contract as legacy compatibility.
p = Path('README.md')
text = p.read_text()
old = '- **合同与拍卖**：发布和承接供应／采购、放贷／贷款、出租／租赁合同；商品采购／供应合同可留空总批次形成长期合同，仍按批次托管并可在当前批完成后正常结束；固定批次供货合同续签由采购方与供应方分别明确同意，单方同意不冻结续签资产；也可通过资产包拍卖完成更复杂的资产流转。'
new = '- **合同与拍卖**：发布和承接供应／采购、放贷／贷款、出租／租赁合同；新商品采购／供应合同按地区使用固定价格、北京时间每日最大额度和按天期限，未使用额度不累计，长期合同可在当前自然日结束后正常终止；旧有限批次／旧长期商品合同继续按原语义兼容，其中旧固定批次续签仍由采购方与供应方分别明确同意且单方同意不冻结续签资产；也可通过资产包拍卖完成更复杂的资产流转。'
if old not in text:
    raise SystemExit('root README contract summary anchor missing')
p.write_text(text.replace(old, new, 1))

# Legacy renewal verifier now explicitly validates compatibility instead of treating it as the current new-publish model.
p = Path('scripts/verify-contract-renewal-economic-events.mjs')
text = p.read_text()
text = text.replace("assert.ok(pageDesign.includes('`totalDeliveries = null`') && pageDesign.includes('长期合同不会因完成批次数自动结束'), 'page design must own long-term supply contract semantics');", "assert.ok(pageDesign.includes('旧玩家商品合同协议中的 `totalDeliveries = null`') && pageDesign.includes('旧长期合同不会因完成批次数自动结束'), 'page design must preserve legacy long-term supply compatibility');")
text = text.replace("assert.ok(serverDesign.includes('`totalDeliveries` 允许为 2～100 的整数或 `null`') && serverDesign.includes('长期合同不接受续签'), 'server design must own long-term supply lifecycle');", "assert.ok(serverDesign.includes('旧玩家商品合同协议中 `totalDeliveries` 允许为 2～100 的整数或 `null`') && serverDesign.includes('旧长期合同不接受续签'), 'server design must preserve legacy long-term supply lifecycle');")
text = text.replace("assert.ok(rootReadme.includes('可留空总批次形成长期合同'), 'root README must summarize long-term supply contracts');", "assert.ok(rootReadme.includes('新商品采购／供应合同按地区使用固定价格') && rootReadme.includes('旧有限批次／旧长期商品合同继续按原语义兼容'), 'root README must summarize daily current contracts and legacy compatibility');")
p.write_text(text)

# Layout verifier follows the new authoritative daily-card wording.
replace('scripts/verify-contract-layout.mjs', "  '进行中合同卡先展示当前批次履约状态',", "  '进行中每日额度商品合同卡先展示当日额度状态',", 'layout design token')

# Dedicated non-regression verifier forbids the superseded current-model descriptions.
p = Path('scripts/verify-daily-supply-contracts.mjs')
text = p.read_text()
if "'CONTRACT_DAY_OFFSET_MS'," not in text:
    text = text.replace("  'CONTRACT_DAY_MS',\n", "  'CONTRACT_DAY_MS',\n  'CONTRACT_DAY_OFFSET_MS',\n", 1)
guards = """
for (const [source, token, message] of [
  [pageDesign, '玩家发布的采购／供应商品合同允许将总批次设置为 2～100 批', '页面权威设计不得把旧总批次模型继续描述为新发布规则。'],
  [pageDesign, '进行中合同卡先展示当前批次履约状态', '页面权威设计不得把旧当前批次卡片继续描述为新每日合同。'],
  [serverDesign, '承接时采购方冻结首批完整货款', '服务器权威设计不得把旧首批托管描述为每日合同当前规则。'],
  [serverDesign, '每批结算在一个事务中同时检查供应方冻结商品', '服务器权威设计不得把旧整批结算描述为每日合同当前规则。'],
  [serverDesign, '旧玩家长期商品合同迁移为默认地区的每日额度长期合同', '服务器权威设计不得声明实现不存在的强制旧长约迁移。'],
]) forbidText(source, token, message);
requireText(daily, 'CONTRACT_DAY_OFFSET_MS = 8 * 60 * 60 * 1000', '每日额度自然日必须与北京时间边界一致。');

"""
if guards.strip() not in text:
    marker = 'if (failures.length) {'
    if marker not in text:
        raise SystemExit('daily verifier marker missing')
    text = text.replace(marker, guards + marker, 1)
p.write_text(text)

# Design index: current final rule only, with explicit Beijing-day boundary.
p = Path('docs/README.md')
text = p.read_text().replace('按 `provinceId + productId` 使用固定价格、每日最大供应量和按天时间', '按 `provinceId + productId` 使用固定价格、北京时间自然日每日最大供应量和按天时间')
p.write_text(text)
