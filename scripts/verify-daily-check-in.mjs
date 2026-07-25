import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const daily = read('server/src/daily-check-in.js');
const storage = read('server/src/storage.js');
const routes = read('server/src/game-routes.js');
const overview = read('src/pages/OverviewPage.tsx');
const types = read('src/types.ts');
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');

check(daily.includes("CHECK_IN_TIME_ZONE = 'Asia/Shanghai'"), 'check-in must use Shanghai time');
check(daily.includes('DAILY_CHECK_IN_REWARD_GEMS = 1'), 'daily reward must be one gem');
check(daily.includes('WEEKLY_FULL_ATTENDANCE_REWARD_GEMS = 5'), 'weekly bonus must be five gems');
check(routes.includes("path === '/api/game/check-in'"), 'check-in route is missing');
check(storage.includes('economy_daily_check_ins'), 'daily check-in table is missing');
check(storage.includes("'daily_check_in'"), 'daily gem ledger category is missing');
check(storage.includes("'weekly_full_attendance'"), 'weekly gem ledger category is missing');
check(storage.includes("'leaderboard_reward'"), 'leaderboard gem ledger category is missing');
check(types.includes('export interface DailyCheckInState'), 'client check-in state type is missing');
check(types.includes('checkIn: DailyCheckInState;'), 'EconomyState check-in field is missing');
check(overview.includes('title="本周签到"'), 'overview check-in card is missing');
check(overview.includes('role="list" aria-label="本周签到日历"'), 'check-in calendar semantics are missing');
check(overview.includes('签到领取 1 宝石'), 'daily claim button copy is missing');
check(!overview.includes('market-summary'), 'overview market card must be removed');
check(!overview.includes('PriceSparkline'), 'overview must not render the market chart');
check(productDesign.includes('每日签到'), 'product design must record daily check-in');
check(productDesign.includes('每周全勤'), 'product design must record weekly attendance');
check(pageDesign.includes('签到日历'), 'page design must record the check-in calendar');
check(serverDesign.includes('economy_daily_check_ins'), 'server design must record check-in persistence');

if (failures.length > 0) {
  console.error('Daily check-in verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Daily check-in verification passed.');
