import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authorityStore = readFileSync(
  new URL('../../src/app/gameAuthorityStore.ts', import.meta.url),
  'utf8',
);

test('React authority hooks bind one accepted state snapshot instead of a live proxy', () => {
  assert.match(
    authorityStore,
    /function useAuthorityRenderSnapshot[\s\S]*?return ready \? readGameAuthorityState\(\) : null;/,
    'React 权威状态 Hook 必须在一次 render 内读取同一个已接受 EconomyState 对象',
  );
  assert.match(
    authorityStore,
    /export function useGameAuthorityState\(\)[\s\S]*?useAuthorityRenderSnapshot/,
    '根 ViewModel 必须复用 render 快照读取器',
  );
  assert.match(
    authorityStore,
    /export function useGameAuthorityView\(userId: number\)[\s\S]*?useAuthorityRenderSnapshot/,
    '按用户读取的 React Hook 也必须复用 render 快照读取器',
  );
  assert.doesNotMatch(
    authorityStore,
    /new Proxy|AUTHORITY_STATE_VIEW/,
    'React 权威状态模块不得保留会随全局 authority reset 改变字段值的实时 Proxy',
  );
});
