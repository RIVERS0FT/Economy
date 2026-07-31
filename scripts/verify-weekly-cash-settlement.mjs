import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => readFileSync(path, 'utf8');
const requireFile = (path) => { if (!existsSync(path)) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不得包含: ${text}`); };

for (const path of [
  'server/src/weekly-cash-settlement.js',
  'server/test/weekly-cash-settlement.test.js',
  'server/src/banking.js',
  'server/src/storage.js',
  'server/src/facility-groups.js',
  'server/src/leaderboards.js',
  'server/src/world-deadline-planner.js',
  'src/pages/BankPage.tsx',
  'src/types.ts',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
]) requireFile(path);

for (const text of [
  'WEEKLY_CASH_SETTLEMENT_RATE_BPS = 1_000',
  "WEEKLY_CASH_TIME_ZONE = 'Asia/Shanghai'",
  'activateWeeklyCashSettlement',
  'interestEligibleFrom',
  "type === 'returning_player'",
  'player.frozenCredits',
  'weeklySettlementLiability',
  'settlePlayerWeeklyCashOnLogin',
  "'weekly_cash_settlement'",
]) requireText('server/src/weekly-cash-settlement.js', text);

for (const text of [
  'BANK_DAILY_INTEREST_RATE_BPS = 100',
  'depositInterestSubsidyIssued',
  'isPlayerWeeklyInterestEligible',
  'createWeeklyCashSettlementClientState',
]) requireText('server/src/banking.js', text);

for (const text of [
  'settlePlayerWeeklyCashOnLogin',
  'activateWeeklyCashSettlement',
  'collectPlayerWeeklyCashSettlement',
  'playerNeedsWeeklyLoginSettlement',
  'processWeeklyCashSettlementWorld',
]) requireText('server/src/storage.js', text);

requireText('server/src/facility-groups.js', 'weeklySettlementLiability');
requireText('server/src/leaderboards.js', 'openingPolicyAdjustments');
requireText('server/src/world-deadline-planner.js', 'weeklyCashSettlement');

for (const text of [
  '固定日利率',
  '本周状态',
  '预计周扣除',
  '待完成结算',
]) requireText('src/pages/BankPage.tsx', text);

for (const text of [
  '每日 1%',
  '每周 10%',
  '成功经济写操作',
  '回归结算',
  '冻结资金',
  '3%／4%／6%',
  '同一自然周内的普通状态读取',
  '不属于经营增长',
]) requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text);

forbidText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '2%／3%／5%');
forbidText('server/src/banking.js', 'BANK_DAILY_INTEREST_CAP_BPS = 25');
forbidText('src/pages/BankPage.tsx', '动态收益');

if (failures.length) {
  console.error(`固定利息与周资金结算验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('固定利息与周资金结算验证通过：活跃周每日 1%、周末 10% 账单、登录扣款、长期回归一次性结算、冻结资金守恒和排行榜调整均已锁定。');
