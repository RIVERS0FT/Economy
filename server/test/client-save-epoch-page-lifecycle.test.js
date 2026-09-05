import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const clientApi = readFileSync(
  new URL('../../src/api/game.ts', import.meta.url),
  'utf8',
);
const autoTrade = readFileSync(
  new URL('../../src/auto-trade/useOnlineAutoTrade.ts', import.meta.url),
  'utf8',
);

test('page save epoch is validated before authority publication and survives ordinary state reset', () => {
  assert.match(
    clientApi,
    /createStateDeliveryCache\(\{ validateState: validatePageSaveEpoch \}\)/,
    '状态交付必须在 authority 发布前校验页面存档世代',
  );
  assert.match(
    clientApi,
    /function validatePageSaveEpoch[\s\S]*?pageSaveEpoch !== saveEpoch[\s\S]*?SaveEpochPageMismatchError/,
    '同一用户的页面世代不得被普通状态刷新自动升级',
  );
  const ordinaryReset = clientApi.match(/export function resetGameStateDelivery\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.equal(ordinaryReset.includes('pageSaveEpoch = null'), false, '普通状态 reset 不得清除页面世代锁');
  assert.equal(ordinaryReset.includes('pageSaveUserId = null'), false, '普通状态 reset 不得清除页面用户锁');
  assert.match(
    clientApi,
    /export function resetGameSession\(\)[\s\S]*?pageSaveEpoch = null/,
    '只有完整会话 reset 才能清除页面世代锁',
  );
  assert.equal(clientApi.includes('currentSaveEpoch'), false, '不得恢复与权威状态发布分离的 currentSaveEpoch 竞态缓存');
});

test('writes require a locked page epoch and server epoch mismatch never auto-upgrades the page', () => {
  assert.match(
    clientApi,
    /headers\.set\('X-Economy-Save-Epoch', String\(requiredPageSaveEpoch\(\)\)\)/,
    '普通游戏写必须从页面世代锁生成请求头',
  );
  assert.match(
    clientApi,
    /code === 'SAVE_EPOCH_MISMATCH'[\s\S]*?markPageSaveEpochStale\(message\)[\s\S]*?SaveEpochPageMismatchError/,
    '服务器世代冲突必须使当前文档失效，而不是写入服务器的新世代',
  );
  assert.equal(
    /SAVE_EPOCH_MISMATCH[\s\S]{0,400}(retry|postAction|request<GameActionResponse>)/.test(clientApi),
    false,
    'SAVE_EPOCH_MISMATCH 后不得自动重放业务写请求',
  );
});

test('cycle sale observations respect the current player and save epoch without issuing automatic writes', () => {
  assert.match(autoTrade, /getStateAuthoritySnapshot\(\)\.state/);
  assert.match(autoTrade, /state\.userId !== userId \|\| state\.saveEpoch !== saveEpoch/);
  assert.match(autoTrade, /if \(!previous\) return/);
  assert.match(autoTrade, /quantity > \(previous\[key\] \|\| 0\)/);
  assert.doesNotMatch(autoTrade, /model\.onlineAuto(?:Buy|Sell)\(/);
  assert.doesNotMatch(autoTrade, /maintainAutoTrade|setInterval\(/);
});

test('production settlement rejection no longer turns a valid state GET into a load failure loop', () => {
  assert.match(
    clientApi,
    /reason instanceof GameApiError && reason\.code\.startsWith\('PRODUCTION_SETTLEMENT_'\)[\s\S]*?suppressedProductionSettlementBasisId = basisId;[\s\S]*?return response;/,
    '生产提案 409 必须保留已接受状态并抑制同 basis 重复提交',
  );
  assert.match(
    clientApi,
    /suppressedProductionSettlementBasisId && basisId === suppressedProductionSettlementBasisId[\s\S]*?return null;/,
    '同一被拒生产 basis 不得在每次轮询重复制造 409',
  );
});
