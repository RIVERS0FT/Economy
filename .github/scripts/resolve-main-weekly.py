from pathlib import Path
import re

ROOT = Path('.')


def resolve_blocks(text, replacements):
    out = []
    position = 0
    index = 0
    pattern = re.compile(r'^<<<<<<< HEAD\n(.*?)^=======\n(.*?)^>>>>>>> origin/main\n', re.M | re.S)
    for match in pattern.finditer(text):
        out.append(text[position:match.start()])
        replacement = replacements[index]
        if replacement == 'ours':
            out.append(match.group(1))
        elif replacement == 'theirs':
            out.append(match.group(2))
        else:
            out.append(replacement)
        position = match.end()
        index += 1
    out.append(text[position:])
    if index != len(replacements):
        raise RuntimeError(f'Expected {len(replacements)} conflict blocks, resolved {index}')
    return ''.join(out)


# Keep main's latest precision section, then append the weekly banking contract.
path = ROOT / 'README.md'
content = resolve_blocks(path.read_text(), ['theirs'])
weekly = '''\n\n## 活跃周银行收益与周资金结算\n\n- 成功经济写操作激活当前北京时间自然周，存款从下一个 00:00 起按每日固定 1% 自动结息；登录、轮询、签到、失败操作和后台推进不激活，离线周不补发。\n- 每个完整活跃周结束后按可用资金、冻结资金和银行存款扣除贷款与既有周结算负债后的净货币资金生成 10% 账单；冻结资金只计入，不被强制解冻。\n- 账单在下一次登录或写操作前先从银行存款、再从可用资金结算；不足部分继续作为负债。长期离线不逐周累计，无旧账单时回归只执行一次 10% 结算。\n- 贷款利息池优先支付固定收益，缺口显式计入补贴发行；周结算实收直接销毁。固定利息和周资金销毁不参与增长榜经营成绩。\n'''
if '## 活跃周银行收益与周资金结算' not in content:
    content = content.rstrip() + weekly
path.write_text(content)

# Page authority: keep main's money boundary and add the fixed-yield display contract.
path = ROOT / 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
content = resolve_blocks(path.read_text(), ['theirs'])
section = '''\n\n## 银行固定收益与周资金结算展示\n\n银行页必须展示固定日利率、本周是否由成功经济写操作激活、计息开始时间、预计周末计税资金、预计 10% 周扣除、待完成账单、昨日与累计利息及下一次结息时间。冻结资金计入估算但不得暗示会被直接解冻或扣除；登录自动结算不可提供跳过、稍后处理或客户端确认按钮。普通玩家页面不展示内部补贴发行与利息池审计明细，管理员统计可以展示资金来源和净货币变化。\n'''
if '## 银行固定收益与周资金结算展示' not in content:
    content = content.rstrip() + section
path.write_text(content)

# Authority index: preserve main's precision rule and add rule 61.
path = ROOT / 'docs/README.md'
content = resolve_blocks(path.read_text(), ['theirs'])
rule = '''\n61. 银行固定收益与周资金结算属于跨模块强制规则：银行存款仅在成功经济写操作激活的北京时间自然周内从次日开始按每日固定 1% 结息；贷款利息池优先支付，缺口记录为补贴发行。完整活跃周结束生成净货币资金 10% 账单，冻结资金计入但不直接扣除，登录时先扣存款再扣可用资金，欠缴保留为负债；离线周不累计，无旧账单时回归只结算一次。同一自然周普通读取不得刷新登录标记或推进世界修订号，固定利息与周资金销毁不得计入增长榜经营成绩。规则唯一归属产品、服务器和页面三份权威文档，并由银行、周结算、状态轮询与资金精度验证共同防回退。\n'''
if '61. 银行固定收益与周资金结算属于跨模块强制规则' not in content:
    content = content.rstrip() + '\n' + rule
path.write_text(content)

# Server authority: keep main's micro-unit core and add weekly settlement transactions.
path = ROOT / 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
content = resolve_blocks(path.read_text(), ['theirs'])
section = '''\n\n## 活跃周固定利息与周资金结算事务\n\n`weekly-cash-settlement.js` 是北京时间自然周、成功经济写操作激活、次日计息资格、10% 活跃周账单、长期回归一次性账单、登录扣款、欠缴负债和客户端摘要的唯一服务器实现。`banking.js` 只负责每日 1% 利息、贷款利息池优先支付与补贴发行；不得在客户端或排行榜复制资格判断。\n\n周一 00:00 的权威顺序为截止时间前世界推进、贷款与最后一日利息、关闭周资金账单、排行榜周期切换。账单关闭不扫描撤销玩家托管；冻结资金只参与计税。正式状态读取、商店读取和所有写操作必须在返回或执行业务前执行玩家登录结算，先扣存款、再扣可用资金，未缴金额留作负债。成功且改变经济状态的写操作在旧债清零后激活当前周；轮询、签到、失败和幂等重放不能激活。\n\n世界 20 迁移初始化周结算状态和银行版本 3，不追溯规则上线前利息或扣除，并把上线所在周标记为不完整周；下一个完整周开始正式关闭活跃周账单。客户端状态版本 23 增加周结算摘要。重复加载、登录重试、服务重启与跨周追赶不得重复建账或重复扣款。同一自然周内的普通状态读取、无账单登录和幂等重试不得刷新登录周标记，也不得因此推进世界修订号。\n'''
if '## 活跃周固定利息与周资金结算事务' not in content:
    content = content.rstrip() + section
path.write_text(content)

# Product authority: align the new banking rule with main's single six-decimal money core.
path = ROOT / 'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md'
content = path.read_text()
content = content.replace(
    '当日新增存款从下一自然日开始计息，当日取款立即降低本日计息余额，取出后再存回不能恢复。个人不足 0.01 的收益以百万分之一普通货币保存，累计达到 0.01 后入账；利息直接进入银行存款并从下一日参与复利。借款人实际支付利息仍按 70%／20%／10% 分配，其中 70% 进入存款利息池、20% 进入银行服务就业收入、10% 进入风险准备金。',
    '当日新增存款从下一自然日开始计息，当日取款立即降低本日计息余额，取出后再存回不能恢复。每日利息按百万分之一普通货币向下结算并直接进入银行存款，不设置独立的“分”级准备金；界面不足 0.01 时显示 `<0.01`，该显示值不得参与运算。利息从下一日参与复利。借款人实际支付利息仍按 70%／20%／10% 分配，其中 70% 进入存款利息池、20% 进入银行服务就业收入、10% 进入风险准备金。',
)
content = content.replace(
    '本周应扣 = floorToCent(周结算计税资金 × 10%)',
    '本周应扣 = floorToMicro(周结算计税资金 × 10%)',
)
path.write_text(content)

# Precision verifier: combine state/version guards with main's micro-unit assertions.
path = ROOT / 'scripts/verify-money-precision.mjs'
content = path.read_text()
combined = """assert.match(read('server/shared/economy-state-version.js'), /CURRENT_CLIENT_STATE_VERSION = 23/);\nassert.match(read('server/shared/economy-state-version.js'), /MIN_COMPATIBLE_CLIENT_STATE_VERSION = 23/);\nassert.match(read('server/src/market-demand/catalog.js'), /MARKET_DEMAND_MODEL_VERSION = 12/);\nassert.match(read('server/src/storage.js'), /normalizeWorldMoneyPrecision/);\nassert.match(read('server/src/storage.js'), /world\\.version = 20/);\nassert.match(read('server/src/population-economy.js'), /POPULATION_ECONOMY_VERSION = 6/);\nassert.match(read('server/src/market-sell-fee.js'), /MARKET_SELL_FEE_VERSION = 3/);\n\nconst banking = read('server/src/banking.js');\nassert.match(banking, /BANKING_VERSION = 3/);\nassert.match(banking, /BANK_DAILY_INTEREST_RATE_BPS = 100/);\nassert.match(banking, /safePositiveMoney\\(payload\\.amount, safeNonNegativeMoney\\(player\\.credits\\)\\)/);\nassert.match(banking, /calculateRateMoney\\(eligible, BANK_DAILY_INTEREST_RATE_BPS/);\nassert.match(banking, /microsToInternalMoney\\(fundedByPoolMicros\\)/);\nassert.doesNotMatch(banking, /Math\\.floor\\(shareMicros \\/ 10_000\\) \\* 10_000/);\n"""
content = resolve_blocks(content, [combined])
path.write_text(content)

# Banking implementation: preserve main's money helpers while applying fixed-yield rules.
path = ROOT / 'server/src/banking.js'
content = path.read_text()
import_block = """import { calculateRateMoney, floorInternalMoney, internalMoneyToMicros, microsToInternalMoney, multiplyMoneyRatio, normalizePlayerMoneyInput, roundInternalMoney } from './money.js';\nimport {\n  createWeeklyCashSettlementClientState,\n  isPlayerWeeklyInterestEligible,\n} from './weekly-cash-settlement.js';\n"""
settlement_start = """function settleDepositInterest(world, settlementAt) {\n  const bank = ensureBankWorld(world, settlementAt);\n  let totalEligible = 0;\n"""
settlement_core = """    totalEligible = addSafe(totalEligible, eligible);\n    const interestCredits = calculateRateMoney(eligible, BANK_DAILY_INTEREST_RATE_BPS, 10_000, 'floor') || 0;\n    const payableMicrosBig = internalMoneyToMicros(interestCredits) || 0n;\n    const payableMicros = payableMicrosBig > BigInt(Number.MAX_SAFE_INTEGER)\n      ? Number.MAX_SAFE_INTEGER\n      : Number(payableMicrosBig);\n    account.depositInterestCarryMicros = 0;\n    if (payableMicros <= 0 || interestCredits <= 0) continue;\n\n    const poolMicros = Math.min(bank.interestPoolMicros, payableMicros);\n    const issuedMicros = payableMicros - poolMicros;\n    bank.interestPoolMicros -= poolMicros;\n    fundedByPoolMicros += poolMicros;\n    subsidyMicros += issuedMicros;\n    account.lastDepositInterestEarned = interestCredits;\n    account.depositCredits = addSafe(account.depositCredits, interestCredits);\n    account.totalDepositInterestEarned = addSafe(account.totalDepositInterestEarned, interestCredits);\n    player.stats ||= {};\n    player.stats.bankDepositInterestEarned = addSafe(player.stats.bankDepositInterestEarned, interestCredits);\n    player.stats.bankDepositInterestSubsidyIssued = addSafe(\n      player.stats.bankDepositInterestSubsidyIssued,\n      microsToInternalMoney(issuedMicros) || 0,\n    );\n    paidCredits = addSafe(paidCredits, interestCredits);\n    recordTransaction(account, 'deposit_interest', interestCredits, settlementAt, '银行存款每日固定结息');\n  }\n\n  const fundedByPoolCredits = microsToInternalMoney(fundedByPoolMicros) || 0;\n  const subsidyCredits = microsToInternalMoney(subsidyMicros) || 0;\n"""
settlement_totals = """  bank.totals.depositorInterestFundedByPool = addSafe(\n    bank.totals.depositorInterestFundedByPool,\n    fundedByPoolCredits,\n  );\n  bank.totals.depositInterestSubsidyIssued = addSafe(\n    bank.totals.depositInterestSubsidyIssued,\n    subsidyCredits,\n  );\n  world.stats ||= {};\n  world.stats.bankDepositInterestSubsidyIssued = addSafe(\n    world.stats.bankDepositInterestSubsidyIssued,\n    subsidyCredits,\n  );\n\n  const depositsAfter = Object.values(world.players || {}).reduce((sum, player) => (\n    addSafe(sum, ensurePlayerBankAccount(player, settlementAt).depositCredits)\n  ), 0);\n  const retainedCredits = calculateRateMoney(\n    depositsAfter,\n    BANK_DAILY_INTEREST_RATE_BPS * BANK_INTEREST_POOL_RETENTION_DAYS,\n    10_000,\n    'floor',\n  ) || 0;\n  const poolCapMicros = Number(internalMoneyToMicros(retainedCredits) || 0n);\n"""
summary = """      dailyInterestCapBps: BANK_DAILY_INTEREST_RATE_BPS,\n      dailyInterestRateBps: BANK_DAILY_INTEREST_RATE_BPS,\n      interestPoolCredits: microsToInternalMoney(bank.interestPoolMicros) || 0,\n      weeklyCashSettlement: createWeeklyCashSettlementClientState(world, player, now),\n"""
content = resolve_blocks(content, [import_block, 'ours', settlement_start, settlement_core, settlement_totals, summary])
content = content.replace(
    'export const BANK_DAILY_INTEREST_CAP_BPS = 25; // 0.25%',
    'export const BANK_DAILY_INTEREST_RATE_BPS = 100; // 1.00%',
)
path.write_text(content)

# Weekly settlement uses the same six-decimal micro-unit boundary as main.
path = ROOT / 'server/src/weekly-cash-settlement.js'
content = path.read_text()
content = content.replace(
    "import { floorPlayerMoney, roundInternalMoney } from './money.js';",
    "import { calculateRateMoney, internalMoneyToMicros, roundInternalMoney } from './money.js';",
)
content = content.replace('  const normalized = floorPlayerMoney(value);', '  const normalized = roundInternalMoney(value);')
content = content.replace(
    "  if (total === null || !Number.isSafeInteger(Math.trunc(total * 100))) throw new Error(message);",
    "  if (total === null || internalMoneyToMicros(total) === null) throw new Error(message);",
)
content = content.replace(
    "  const normalized = Math.floor(Number(amount || 0) * Number(rateBps || 0) * 100 / 10_000) / 100;\n  if (!Number.isFinite(normalized) || normalized < 0 || normalized > MAX_SAFE) {",
    "  const normalized = calculateRateMoney(amount, rateBps, 10_000, 'floor');\n  if (normalized === null || normalized < 0 || normalized > MAX_SAFE) {",
)
path.write_text(content)

# Banking tests assert six-decimal interest rather than a separate cent reserve.
path = ROOT / 'server/test/banking.test.js'
content = path.read_text()
content = content.replace(
    "test('deposit interest preserves sub-cent carry until a full cent can be paid', () => {",
    "test('deposit interest credits exact six-decimal amounts without a cent reserve', () => {",
)
content = content.replace(
    "  assert.equal(account.depositCredits, 0.5);\n  assert.equal(account.depositInterestCarryMicros, 5_000);\n  processBankWorld(world, firstMidnight + 24 * 60 * 60 * 1000);\n  assert.equal(account.depositCredits, 0.51);\n  assert.equal(account.depositInterestCarryMicros, 0);",
    "  assert.equal(account.depositCredits, 0.505);\n  assert.equal(account.depositInterestCarryMicros, 0);\n  processBankWorld(world, firstMidnight + 24 * 60 * 60 * 1000);\n  assert.equal(account.depositCredits, 0.51005);\n  assert.equal(account.depositInterestCarryMicros, 0);",
)
path.write_text(content)

for candidate in ROOT.rglob('*'):
    if candidate.is_file() and candidate.suffix in {'.js', '.mjs', '.md'}:
        text = candidate.read_text(errors='ignore')
        if '<<<<<<< HEAD' in text or '>>>>>>> origin/main' in text:
            raise RuntimeError(f'Unresolved merge marker: {candidate}')

print('Resolved main merge while preserving fixed weekly settlement and six-decimal money rules.')
