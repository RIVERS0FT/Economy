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
  'server/src/banking-legacy.js',
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
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
].forEach(requireFile);

for (const text of [
  'BANKING_VERSION = 4',
  'BANK_LOAN_TERM_OPTIONS_HOURS = Object.freeze([24, 72, 168])',
  'BANK_LOAN_GRACE_MS = 12 * 60 * 60 * 1000',
  'BANK_COLLECTION_RETRY_MS = 6 * 60 * 60 * 1000',
  'BANK_BASE_CREDIT_RATIO_BPS = 3_000',
  'BANK_REPAYMENT_HISTORY_BONUS_BPS = 500',
  'BANK_RECENT_DEFAULT_PENALTY_BPS = 1_500',
  'BANK_MINIMUM_CREDIT_RATIO_BPS = 1_500',
  'BANK_MAXIMUM_CREDIT_RATIO_BPS = 3_500',
  'creditLoan',
  'bankCreditAssetValue',
  'calculateAssetCreditAssessment',
  'creditLimitAtOrigination',
  'creditUtilizationBps',
  'utilizationSurchargeBps',
  'termHoursFromPayload',
  "TERM_CARRIER_PROVINCE_ID = '__bank_credit_term__'",
  'collectAvailableCommodities',
  'collectAvailableFacilities',
  'collectAvailableCommercialBuildings',
  'collection_pending',
  "return legacy.applyBankAction(world, user, action, payload, now, { processWorld: false })",
]) requireText('server/src/banking.js', text);

for (const text of [
  'BANKING_VERSION = 3',
  'BANK_DAILY_INTEREST_RATE_BPS = 100',
  'BANK_INTEREST_POOL_SHARE_PERCENT = 70',
  'BANK_EMPLOYMENT_SHARE_PERCENT = 20',
  'BANK_RISK_RESERVE_SHARE_PERCENT = 10',
  'dayOpeningDepositCredits',
  'dayMinimumDepositCredits',
  'depositInterestCarryMicros',
  'isPlayerWeeklyInterestEligible',
  'depositInterestSubsidyIssued',
  'normalizeCollateralWithValues',
  'seizeCollateral',
]) requireText('server/src/banking-legacy.js', text);

for (const text of [
  'activeLoanLiability',
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
  '<PageLayout title="银行">',
  '<AssetOverviewPanel model={model} />',
  'title="资金管理"',
  '本周资金计划',
  'title="银行贷款"',
  '资产授信',
  '授信资产净值',
  '最高可贷额度',
  'aria-label="贷款周期"',
  '24h ·',
  '72h ·',
  '168h ·',
  '贷款快捷金额',
  '>75%</Button>',
  '授信利用率',
  'role="progressbar"',
  '剩余授信',
  '额度使用加点',
  '基础授信比例',
  '最终授信比例',
  '贷款不冻结工厂、商品或其他资产',
  '历史抵押贷款',
  '宽限结束仍未结清时，服务器依次追偿银行存款、可用资金、可用商品、可用工厂和商业建筑',
  'bank-history-filters',
]) requireText('src/pages/BankPage.tsx', text);
for (const text of [
  'title="工厂冻结融资"',
  'aria-label="可冻结工厂"',
  '冻结资产审慎估值',
  '先选择冻结工厂',
  '基础可贷成数',
]) forbidText('src/pages/BankPage.tsx', text);

for (const text of ['bankDeposit', 'bankWithdraw', 'bankBorrow', 'bankRepay', 'bankSetAutoRepay']) {
  requireText('src/api/game.ts', text);
  requireText('src/app/gameViewModel.ts', text);
}
requireText('src/api/game.ts', "bankBorrow: (amount: number, termHours: number, autoRepay = true)");
requireText('src/api/game.ts', "postAction('/bank/loans', { amount, termHours, autoRepay })");
requireText('src/app/gameViewModel.ts', 'bankBorrow: (amount: number, termHours: number, autoRepay?: boolean)');
forbidText('src/pages/BankPage.tsx', 'CREDIT_TERM_CARRIER_PROVINCE_ID');

for (const text of [
  '资产授信贷款',
  '基础授信比例 = 30%',
  '最终授信比例限制在 15%～35%',
  '最高贷款额度 = floorToCent(授信资产净值 × 最终授信比例)',
  '24 小时',
  '72 小时',
  '168 小时',
  '50%',
  '80%',
  '不冻结工厂、商品或商业建筑',
  '全资产追偿',
  '历史抵押贷款',
]) requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text);
for (const text of [
  '页面顺序固定为“资产总览／资金管理／银行贷款／银行记录”',
  '授信资产净值',
  '贷款周期',
  '额度使用加点',
  '不得恢复新贷款抵押物选择',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of [
  'POST | `/api/game/bank/loans`',
  '贷款金额与贷款周期',
  'creditLoan',
  '历史 `activeLoan`',
]) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);
for (const text of [
  '银行贷款',
  '贷款周期',
  '授信资产净值',
  '不得恢复连续冻结列表',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

for (const text of [
  'asset credit loan needs no collateral and never freezes factories',
  'loan amount, term and utilization determine locked rate while assets determine limit',
  'loan proceeds add matching principal liability and only locked interest reduces net wealth',
  'default does not write off missing assets and schedules continuing collection',
  'default collection uses available assets only after grace and returns liquidation surplus',
  'legacy collateral loan remains readable and keeps its original freeze boundary',
]) requireText('server/test/banking.test.js', text);
for (const text of [
  'asset credit amount, term and utilization without collateral selection',
  "getByRole('group', { name: '贷款周期' })",
  "toBe('168')",
  "page.locator('.bank-collateral-list')).toHaveCount(0)",
]) requireText('tests/browser/bank-runtime.spec.ts', text);

forbidText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '基础可贷成数 = 40%');
forbidText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '贷款期限固定为 72 小时');
forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '页面顺序固定为“资产总览／资金管理／工厂冻结融资／银行记录”');
forbidText('server/src/banking.js', 'normalizeCollateralWithValues(world, player, collateral)');
forbidText('server/src/banking.js', 'setInterval(');

if (failures.length) {
  console.error(`银行与资产授信验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('银行验证通过：新贷款按服务器净资产授信，玩家选择金额与 24h/72h/168h 周期，不冻结资产；额度加点、自动还款、违约持续追偿、历史抵押贷款兼容和存款结息均已锁定。');
