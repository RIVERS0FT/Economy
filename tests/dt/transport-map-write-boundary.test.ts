import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the map selection surface cannot create or dispatch transport before review', () => {
  const stage = readFileSync(new URL('../../src/components/shell/StrategicWorkspace.tsx', import.meta.url), 'utf8');
  // The account-free browser preview rejects writes, so an empty HTTP log alone
  // would not catch reintroducing a premature call to its model write stub.
  assert.doesNotMatch(stage, /\b(?:createTransportRoute|startTransportCycle|serviceTransportNode)\s*\(/);
  assert.doesNotMatch(stage, /\/api\/game\/transport/);
  assert.match(stage, /routeDraft\.finishPicking\(\)/);
});
