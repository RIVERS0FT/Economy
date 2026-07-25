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
const gemShop = read('src/pages/GemShopPage.tsx');
const settings = read('src/pages/SettingsPage.tsx');
const types = read('src/types.ts');
const tests = read('server/test/daily-check-in.test.js');
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
check(storage.includes('saveWorldIfChanged(revision, world, now, stateJson)'), 'failed or repeated check-in must not force a world revision');
const economicActions = storage.match(/const ECONOMIC_ACTIVITY_ACTIONS = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
check(!economicActions.includes("'checkIn'"), 'check-in must not refresh economic activity');
check(tests.includes('assert.deepEqual(replay, first)'), 'same idempotency key replay coverage is missing');
check(tests.includes('assert.equal(duplicate.revision, first.revision)'), 'duplicate daily claim revision coverage is missing');
check(types.includes('export interface DailyCheckInState'), 'client check-in state type is missing');
check(types.includes('checkIn: DailyCheckInState;'), 'EconomyState check-in field is missing');
check(overview.includes('title="本周签到"'), 'overview check-in card is missing');
check(overview.includes('role="list" aria-label="本周签到日历"'), 'check-in calendar semantics are missing');
check(overview.includes('签到领取 1 宝石'), 'daily claim button copy is missing');
check(!overview.includes('market-summary'), 'overview market card must be removed');
check(!overview.includes('PriceSparkline'), 'overview must not render the market chart');
check(gemShop.includes('InvitationSettings'), 'latest invitation entry must remain in the shop');
check(!settings.includes('InvitationSettings'), 'invitation entry must not return to settings');
check(productDesign.includes('每日签到'), 'product design must record daily check-in');
check(productDesign.includes('每周全勤'), 'product design must record weekly attendance');
check(productDesign.includes('注册完成后不能补填'), 'latest invitation binding rule must remain documented');
check(pageDesign.includes('签到日历'), 'page design must record the check-in calendar');
check(pageDesign.includes('邀请获取宝石与宝石单向兑换普通货币'), 'shop invitation responsibility must remain documented');
check(serverDesign.includes('economy_daily_check_ins'), 'server design must record check-in persistence');

const staleVersion = String(17);
const staleFragments = [
  `version: ${staleVersion};`,
  `客户端状态版本：\`${staleVersion}\``,
  `客户端状态版本：${staleVersion}`,
];
for (const fileName of fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.endsWith('.mjs'))) {
  const source = read(`scripts/${fileName}`);
  for (const fragment of staleFragments) {
    check(!source.includes(fragment), `${fileName} must not hard-code stale current client version ${staleVersion}`);
  }
}

if (failures.length > 0) {
  console.error('Daily check-in verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Daily check-in verification passed.');
