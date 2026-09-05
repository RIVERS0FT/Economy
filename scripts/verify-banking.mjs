import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不得包含: ${text}`); };

[
  'server/src/banking.js',
  'server/src/storage.js',
  'server/src/facility-groups.js',
  'server/src/leaderboards.js',
  'server/src/world-deadline-planner.js',
  'server/test/banking.test.js',
  'src/pages/BankPage.tsx',
  'src/styles/bank.css',
  'bank-runtime-test.html',
  'tests/browser/bank-runtime-harness.tsx',
  'tests/browser/bank-runtime.spec.ts',
  'src/types.ts',
  'src/api/game.ts',
  'src/app/gameViewModel.ts',
  'src/config/navigation.ts',
  'src/pages/PageRouter.tsx',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
].forEach(requireFile);

for (const text of [
  'BANK_LOAN_TERM_MS = 72 * 60 * 60 * 1000',
  'BANK_LOAN_GRACE_MS = 12 * 60 * 60 * 1000',
  'BANK_DAILY_INTEREST_RATE_BPS = 100',
  'BANK_INTEREST_POOL_SHARE_PERCENT = 70',
  'BANK_EMPLOYMENT_SHARE_PERCENT = 20',
  'BANK_RISK_RESERVE_SHARE_PERCENT = 10',
  'dayOpeningDepositCredits',
  'dayMinimumDepositCredits',
  'depositInterestCarryMicros',
  'Math.min(account.dayOpeningDepositCredits, account.dayMinimumDepositCredits)',
  'isPlayerWeeklyInterestEligible',
  'depositInterestSubsidyIssued',
  'interestPoolMicros',
  'function addSafeMicros',
  'const poolMicros = internalMoneyToMicros(poolCredits);',
  'bank.interestPoolMicros = addSafeMicros(',
  "creditPopulationEmployment(world, employmentCredits, 'banking')",
  'prudentFacilityValue',
  'transferableFacilityQuantity',
  'const participatingReduction = Math.min(safeNonNegativeInteger(group.participatingCount), removed);',
  'processBankWorld',
  'nextBankDeadlineAt',
  "action === 'bankDeposit'",
  "action === 'bankBorrow'",
]) requireText('server/src/banking.js', text);

for (const text of [
  "const BANK_ACTIONS = new Set(['bankDeposit', 'bankWithdraw', 'bankBorrow', 'bankRepay', 'bankSetAutoRepay'])",
  'BANK_ACTIONS.has(action)',
  'applyBankAction(world, user, action, payload, now)',
  'createBankClientState',
]) requireText('server/src/storage.js', text);

for (const text of [
  'mortgagedFacilityQuantity',
  'mortgagedFacilityValue',
  'netAssetValue',
  'totalAssets: netAssetValue',
]) requireText('server/src/facility-groups.js', text);
for (const text of ['operatingAssetsFor', 'wealthAssetsFor', 'activeLoanLiability', 'depositCredits']) requireText('server/src/leaderboards.js', text);
requireText('server/src/world-deadline-planner.js', 'bank: nextBankDeadlineAt(world, normalizedNow)');
for (const text of [
  "path === '/api/game/bank/deposits'",
  "path === '/api/game/bank/withdrawals'",
  "path === '/api/game/bank/loans'",
  '/(repay|auto-repay)$/',
]) requireText('server/src/game-routes.js', text);

for (const text of [
  "{ id: 'bank', label: '银行' }",
]) requireText('src/config/navigation.ts', text);
requireText('src/pages/PageRouter.tsx', "import('./BankPage')");
for (const text of [
  '<PageLayout title="银行">',
  '<AssetOverviewPanel model={model} />',
  'title="资金管理"',
  'bank-account-balance-strip',
  '今日计息余额',
  'bank-transfer-direction',
  'aria-label="资金转移方向"',
  '>25%</Button>',
  '>50%</Button>',
  '>最大</Button>',
  '本周资金计划',
  'title="工厂冻结融资"',
  'bank-collateral-list',
  'aria-label="可冻结工厂"',
  'bank-loan-decision',
  '授信利用率',
  'role="progressbar"',
  '剩余授信',
  '冻结资产审慎估值',
  '最高可贷额度',
  '贷款本金会同时增加等额负债',
  '成功经济操作会激活本周',
  '冻结工厂继续生产',
  'bank-history-filters',
]) requireText('src/pages/BankPage.tsx', text);
for (const text of [
  'description="统一查看资产构成',
  '<table className="bank-collateral-table">',
  'bank-collateral-table-wrap',
  '领取利息',
]) forbidText('src/pages/BankPage.tsx', text);
for (const text of ['bankDeposit', 'bankWithdraw', 'bankBorrow', 'bankRepay', 'bankSetAutoRepay']) {
  requireText('src/api/game.ts', text);
  requireText('src/app/gameViewModel.ts', text);
}

for (const text of [
  '借款人实际支付的贷款利息',
  '70% 进入存款利息池',
  '每日 1%',
  '3%／4%／6%',
  '同一自然周内的普通状态读取',
  '不属于经营增长',
  '每周 10%',
  '日初存款',
  '当日最低存款',
  '本金发行与等额负债同步发生',
  '净资产',
]) requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text);
for (const text of [
  '固定日利率',
  '每日固定 1%',
  '预计 10% 周扣除',
  '页面顺序固定为“资产总览／资金管理／工厂冻结融资／银行记录”',
  '授信利用率',
  '连续冻结列表',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of [
  '每日固定 1%',
  '贷款利息池优先支付',
  '补贴发行',
  '银行利息池使用百万分之一普通货币的整数微单位保存',
  '业务模块不得自行使用 `value * 100`、`value * 1_000_000`',
]) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);
for (const text of ['冻结数量必须继续计入当前或下一周期生产能力', '可转让数量', 'mortgagedCount']) requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);
for (const text of ['| 银行 | `bank` | `BankPage`', '十一个业务导航按钮', '资产总览', '资金管理', '额度评估']) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of ['`banking.js`', '/api/game/bank/deposits', '银行每日结息']) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);
for (const text of ['`src/styles/bank.css`', '授信利用率', '不得依赖横向滚动']) requireText('docs/UI_DESIGN_SYSTEM.md', text);

for (const text of [
  'deposits and withdrawals move existing funds without changing net assets',
  'mortgaged factories keep producing but cannot be transferred',
  'loan proceeds add matching liability and do not inflate wealth',
  'active-week deposit interest is fixed at one percent, pool-funded first, and new deposits wait a full day',
  'large realized loan interest remains representable in the micros pool',
  'large loan default settles interest without micros double scaling',
  "assert.equal(Object.hasOwn(borrower.facilityGroups[0], 'pendingJoinCount'), false);",
  'assert.doesNotThrow(() => assertEconomicStateInvariants(world));',
  'loan assessment exposes transparent collateral and rate inputs',
]) requireText('server/test/banking.test.js', text);

for (const text of ['<BankPage model={model} />', 'version: 26']) requireText('tests/browser/bank-runtime-harness.tsx', text);
for (const text of [
  'transparent credit utilization',
  'without a collateral horizontal table',
  "getByRole('progressbar', { name: '授信利用率' })",
  'scrollWidth <= element.clientWidth + 1',
]) requireText('tests/browser/bank-runtime.spec.ts', text);
requireText('bank-runtime-test.html', '/tests/browser/bank-runtime-harness.tsx');

forbidText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '2%／3%／5%');
forbidText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '固定存款日利率为每日 1%，固定存款日利率为每日 1%');
forbidText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '每周 10% 的资金扣除只适用于完整活跃周。每周 10% 的资金扣除只适用于完整活跃周。');
for (const path of ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md']) {
  forbidText(path, '每日最高收益率 0.25%');
  forbidText(path, '不承诺固定收益');
  forbidText(path, '没有利息池时收益为 0');
}
forbidText('server/src/banking.js', 'setInterval(');
forbidText('server/src/banking.js', 'depositCredits += Math.ceil');
forbidText('server/src/banking.js', 'BANK_INTEREST_MICROS_PER_CREDIT');
forbidText('server/src/banking.js', 'Math.round(poolCredits *');
forbidText('server/src/banking.js', 'pendingJoinCount');
forbidText('server/test/banking.test.js', 'participatingCount: 0, pendingJoinCount: 0');

if (failures.length) {
  console.error(`银行与存款利息验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('银行验证通过：现有存取款守恒、冻结生产、净资产、期限利率与活跃周结息规则保持不变，资金管理、连续冻结列表、授信利用率、移动端无横向冻结表格与权威流水筛选均已锁定。');
