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
  "creditPopulationEmployment(world, employmentCredits, 'banking')",
  'prudentFacilityValue',
  'transferableFacilityQuantity',
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
  'title="银行"',
  '<AssetOverviewPanel model={model} />',
  'bank-account-balance-strip',
  '今日计息余额',
  '存款利息与周结算',
  '工厂抵押贷款',
  '抵押物审慎估值',
  '最高可贷额度',
  '贷款本金会同时增加等额负债',
  '成功经济操作会激活本周',
  '抵押工厂继续生产',
]) requireText('src/pages/BankPage.tsx', text);
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
for (const text of ['固定日利率', '每日固定 1%', '预计 10% 周扣除']) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of ['每日固定 1%', '贷款利息池优先支付', '补贴发行']) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);
for (const text of ['抵押数量必须继续计入当前或下一周期生产能力', '可转让数量', 'mortgagedCount']) requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);
for (const text of ['| 银行 | `bank` | `BankPage`', '玩家导航固定为九项', '资产总览', '存款账户', '额度评估']) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of ['`banking.js`', '世界版本 17', '客户端状态版本 20', '/api/game/bank/deposits', '银行截止时间']) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);
requireText('docs/UI_DESIGN_SYSTEM.md', '`src/styles/bank.css`');

for (const text of [
  'deposits and withdrawals move existing funds without changing net assets',
  'mortgaged factories keep producing but cannot be transferred',
  'loan proceeds add matching liability and do not inflate wealth',
  'active-week deposit interest is fixed at one percent, pool-funded first, and new deposits wait a full day',
  'loan assessment exposes transparent collateral and rate inputs',
]) requireText('server/test/banking.test.js', text);

for (const text of ['<BankPage model={model} />', 'version: 24']) requireText('tests/browser/bank-runtime-harness.tsx', text);
for (const text of ['transparent collateral assessment', 'stacks safely on mobile', 'scrollWidth <= element.clientWidth + 1']) requireText('tests/browser/bank-runtime.spec.ts', text);
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
forbidText('src/pages/BankPage.tsx', '领取利息');

if (failures.length) {
  console.error(`银行与存款利息验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('银行验证通过：存取款守恒、抵押生产边界、净资产、透明额度、期限利率、活跃周每日固定 1%、贷款利息池优先支付、补贴发行、周结算和统一截止时间均已锁定。');
