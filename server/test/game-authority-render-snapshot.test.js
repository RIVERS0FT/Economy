import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authorityStore = readFileSync(
  new URL('../../src/app/gameAuthorityStore.ts', import.meta.url),
  'utf8',
);

test('root authority render hook returns one accepted state snapshot instead of the live proxy', () => {
  const hook = authorityStore.match(/export function useGameAuthorityState\(\)[\s\S]*?\n}\n/)?.[0] || '';
  assert.match(
    hook,
    /return ready \? getStateAuthoritySnapshot\(\)\.state : null;/,
    '根 ViewModel 必须在一次 render 内读取同一个已接受 EconomyState 对象',
  );
  assert.doesNotMatch(
    hook,
    /AUTHORITY_STATE_VIEW/,
    '根 ViewModel 不得持有会随全局 authority reset 改变字段值的实时 Proxy',
  );
});
