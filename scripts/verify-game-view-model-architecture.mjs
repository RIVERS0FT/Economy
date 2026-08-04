import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
for (const path of [
  'src/app/gameViewModel.ts',
  'src/app/useAuthoritativeGameState.ts',
  'src/app/gameDerivedData.ts',
  'src/app/gameViewModelLabels.ts',
]) assert.ok(existsSync(path), `缺少 ViewModel 职责文件：${path}`);

const facade = read('src/app/gameViewModel.ts');
for (const required of [
  "from './gameDerivedData'",
  "from './useAuthoritativeGameState'",
  "from './gameViewModelLabels'",
  'useAuthoritativeGameState(user, onSignedOut, refreshRate)',
]) assert.ok(facade.includes(required), `gameViewModel 门面缺少：${required}`);
for (const forbidden of ['revisionRef', 'refreshTaskRef', 'function deriveGameData', 'getGameState(']) {
  assert.equal(facade.includes(forbidden), false, `gameViewModel 不得重新承担权威状态职责：${forbidden}`);
}

const authority = read('src/app/useAuthoritativeGameState.ts');
for (const required of [
  "export type RefreshMode = 'normal' | 'authoritative'",
  'revisionRef.current',
  'canAcceptRevision(revisionRef.current, incomingRevision)',
  'getGameState(revisionRef.current, controller.signal)',
  'actionsInFlightRef.current',
  'syncConfirmedAction',
]) assert.ok(authority.includes(required), `权威状态 Hook 缺少：${required}`);

const derived = read('src/app/gameDerivedData.ts');
for (const required of ['export interface DerivedGameData', 'export function deriveGameData', 'order.isOwn &&']) {
  assert.ok(derived.includes(required), `派生数据模块缺少：${required}`);
}
const labels = read('src/app/gameViewModelLabels.ts');
for (const required of ['facilityStatusNames', 'facilityStatusReasonNames', 'orderStatusNames']) {
  assert.ok(labels.includes(required), `状态名称模块缺少：${required}`);
}
assert.ok(read('docs/UI_DESIGN_SYSTEM.md').includes('`src/app/gameViewModel.ts` 只作为页面模型门面'));
console.log('游戏 ViewModel 架构验证通过：权威状态、纯派生数据和显示名称职责已拆分。');
