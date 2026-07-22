import { existsSync, readFileSync } from 'node:fs';
import {
  CURRENT_CLIENT_STATE_VERSION,
  isCompatibleClientStateVersion,
  MIN_COMPATIBLE_CLIENT_STATE_VERSION,
} from '../server/shared/economy-state-version.js';
import { mergeStatePatches } from '../src/app/stateDelivery.js';

const failures = [];
const read = (path) => readFileSync(path, 'utf8');

function fail(message) {
  failures.push(message);
}

function versionFromMatch(path, pattern, label) {
  const match = read(path).match(pattern);
  if (!match) {
    fail(`${path} 缺少${label}声明`);
    return null;
  }
  return Number(match[1]);
}

function requireCurrentVersion(path, pattern, label) {
  const value = versionFromMatch(path, pattern, label);
  if (value !== null && value !== CURRENT_CLIENT_STATE_VERSION) {
    fail(`${path} 的${label}为 ${value}，应与共享协议版本 ${CURRENT_CLIENT_STATE_VERSION} 一致`);
  }
}

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) fail(`${path} 缺少客户端状态版本规则: ${fragment}`);
  }
}

if (!Number.isInteger(CURRENT_CLIENT_STATE_VERSION)
  || !Number.isInteger(MIN_COMPATIBLE_CLIENT_STATE_VERSION)
  || MIN_COMPATIBLE_CLIENT_STATE_VERSION < 0
  || MIN_COMPATIBLE_CLIENT_STATE_VERSION > CURRENT_CLIENT_STATE_VERSION) {
  fail('共享客户端状态版本及兼容下限必须是有效且有序的非负整数');
}

if (existsSync('shared/economy-state-version.js')) {
  fail('不得恢复根目录平行客户端状态版本模块');
}

requireCurrentVersion('README.md', /客户端状态版本：`(\d+)`/, '客户端状态版本');
requireCurrentVersion('docs/README.md', /> 客户端状态版本：(\d+)/, '客户端状态版本');
requireCurrentVersion(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  /> 客户端状态版本：(\d+)/,
  '客户端状态版本',
);

requireText('package.json', [
  '"verify:state-version": "node scripts/verify-client-state-version.mjs"',
  'node scripts/verify-client-state-version.mjs && node scripts/verify-order-matching-core.mjs',
]);
requireText('server/shared/economy-state-version.js', [
  `export const CURRENT_CLIENT_STATE_VERSION = ${CURRENT_CLIENT_STATE_VERSION};`,
  `export const MIN_COMPATIBLE_CLIENT_STATE_VERSION = ${MIN_COMPATIBLE_CLIENT_STATE_VERSION};`,
  'isCompatibleClientStateVersion',
]);
requireText('server/src/storage.js', [
  "from '../shared/economy-state-version.js'",
  'version: CURRENT_CLIENT_STATE_VERSION',
]);

const types = read('src/types.ts');
const stateTypeStart = types.indexOf('export interface EconomyState');
const stateTypeEnd = types.indexOf('\nexport interface AdminSummary', stateTypeStart);
if (stateTypeStart < 0 || stateTypeEnd < 0) {
  fail('src/types.ts 缺少 EconomyState 类型');
} else {
  const match = types.slice(stateTypeStart, stateTypeEnd).match(/\bversion:\s*(\d+);/);
  if (!match) fail('src/types.ts 缺少 EconomyState.version 字面量');
  else if (Number(match[1]) !== CURRENT_CLIENT_STATE_VERSION) {
    fail(`src/types.ts 声明版本 ${match[1]}，应为 ${CURRENT_CLIENT_STATE_VERSION}`);
  }
}

requireText('src/app/stateDelivery.js', [
  "from '../../server/shared/economy-state-version.js'",
  'isCompatibleClientStateVersion(state.version)',
  '客户端状态版本不兼容',
  'missingPartitions',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '`server/shared/economy-state-version.js`',
  '上一客户端状态版本',
  '`scripts/verify-client-state-version.mjs`',
]);
requireText('docs/README.md', [
  '`server/shared/economy-state-version.js`',
  '`scripts/verify-client-state-version.mjs`',
]);

function completePatches(version) {
  return {
    catalog: { version, products: [], facilityTypes: [] },
    player: { userId: 1, credits: 100 },
    market: { orders: [] },
    auction: { collectibles: [] },
    leaderboard: { leaderboard: [] },
  };
}

for (const version of [MIN_COMPATIBLE_CLIENT_STATE_VERSION, CURRENT_CLIENT_STATE_VERSION]) {
  if (!isCompatibleClientStateVersion(version)) fail(`兼容版本 ${version} 被共享判断器拒绝`);
  try {
    const merged = mergeStatePatches({}, completePatches(version));
    if (merged.state.version !== version || merged.state.userId !== 1) {
      fail(`客户端未正确接受兼容状态版本 ${version}`);
    }
  } catch (error) {
    fail(`客户端错误拒绝兼容状态版本 ${version}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const version of [MIN_COMPATIBLE_CLIENT_STATE_VERSION - 1, CURRENT_CLIENT_STATE_VERSION + 1]) {
  if (isCompatibleClientStateVersion(version)) fail(`非兼容版本 ${version} 被共享判断器接受`);
  try {
    mergeStatePatches({}, completePatches(version));
    fail(`客户端错误接受非兼容状态版本 ${version}`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('客户端状态版本不兼容')) {
      fail(`非兼容状态版本 ${version} 未返回明确错误`);
    }
  }
}

try {
  const patches = completePatches(CURRENT_CLIENT_STATE_VERSION);
  delete patches.auction;
  mergeStatePatches({}, patches);
  fail('客户端错误接受缺少初始分区的状态');
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes('缺少 auction 分区')) {
    fail('缺少初始分区时未返回明确错误');
  }
}

if (failures.length > 0) {
  console.error(failures.map((message) => `- ${message}`).join('\n'));
  process.exit(1);
}

console.log(
  `客户端状态版本契约验证通过：当前 ${CURRENT_CLIENT_STATE_VERSION}，最低兼容 ${MIN_COMPATIBLE_CLIENT_STATE_VERSION}`,
);
