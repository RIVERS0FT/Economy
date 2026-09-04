import { expect, test, type Route } from '@playwright/test';

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function fullStateDelivery(saveEpoch: number, revision = 1) {
  return {
    revision,
    unchanged: false,
    serverNow: 1_850_000_000_000,
    partitionRevisions: {
      catalog: 'catalog-0001',
      player: `player-${String(revision).padStart(5, '0')}`,
      market: 'market-00001',
      auction: 'auction-0001',
      contract: 'contract-0001',
      leaderboard: 'leader-00001',
    },
    patches: {
      catalog: {
        version: 40,
        products: [{ id: 'wheat', name: '小麦', category: 'raw', basePrice: 1 }],
        facilityTypes: [{
          id: 'farm',
          name: '农场',
          category: 'raw',
          complexity: 'C1',
          buildCost: 100,
          buildTimeMs: 0,
          cycleMs: 1_000,
          operatingCost: 1,
          inputs: [],
          output: { productId: 'wheat', quantity: 1 },
          defaultRecipeId: 'farm-standard',
          recipes: [{
            id: 'farm-standard',
            name: '标准',
            cycleMs: 1_000,
            operatingCost: 1,
            inputs: [],
            output: { productId: 'wheat', quantity: 1 },
          }],
          systemValue: 100,
        }],
        commercialBuildingTypes: [{ id: 'convenience-store', name: '便利店' }],
        researchLevels: [{ id: 'C1', rank: 1, cost: 0, durationMs: 0 }],
        provinces: [{
          id: '110000',
          name: '加利福尼亚',
          shortName: 'CA',
          mapName: 'California',
          longitude: -119.4179,
          latitude: 36.7783,
        }],
        defaultProvinceId: '110000',
      },
      player: {
        userId: 1,
        saveEpoch,
        playerName: 'Epoch Tester',
        registeredAt: 1_800_000_000_000,
        credits: 100,
        frozenCredits: 0,
        inventories: {},
        provinceInventories: {},
        facilityGroups: [],
        stats: {},
      },
      market: { orders: [], markets: {} },
      auction: { assetAuctions: [] },
      contract: { productionContracts: [] },
      leaderboard: { leaderboard: [] },
    },
  };
}

function productionStateDelivery(saveEpoch: number) {
  const delivery = fullStateDelivery(saveEpoch);
  const serverNow = Number(delivery.serverNow);
  delivery.patches.player.provinceInventories = {
    '110000': {
      wheat: { available: 0, frozen: 0, inTransit: 0 },
    },
  };
  delivery.patches.player.facilityGroups = [{
    provinceId: '110000',
    facilityTypeId: 'farm',
    count: 1,
    productionAvailableCount: 1,
    participatingCount: 1,
    enabled: true,
    status: 'running',
    activeRecipeId: 'farm-standard',
    lifetimeOutput: 0,
    cycleStartedAt: serverNow - 5_000,
    staffingRateBps: 10_000,
    staffingUpdatedAt: serverNow - 5_000,
    productionSettlementStaffingRateBps: 10_000,
    productionSettlementStaffingUpdatedAt: serverNow - 5_000,
    staffingBatchCarryBps: 0,
  }];
  return delivery;
}

function unchangedStateDelivery(revision = 1) {
  return {
    revision,
    unchanged: true,
    serverNow: 1_850_000_005_000,
    partitionRevisions: {
      catalog: 'catalog-0001',
      player: `player-${String(revision).padStart(5, '0')}`,
      market: 'market-00001',
      auction: 'auction-0001',
      contract: 'contract-0001',
      leaderboard: 'leader-00001',
    },
  };
}

function epochPatchDelivery(saveEpoch: number, revision = 2) {
  return {
    revision,
    unchanged: false,
    serverNow: 1_850_000_005_000,
    partitionRevisions: {
      catalog: 'catalog-0001',
      player: `player-${String(revision).padStart(5, '0')}`,
      market: 'market-00001',
      auction: 'auction-0001',
      contract: 'contract-0001',
      leaderboard: 'leader-00001',
    },
    patches: {
      player: {
        userId: 1,
        saveEpoch,
        playerName: 'Epoch Tester',
        registeredAt: 1_800_000_000_000,
        credits: 100,
        frozenCredits: 0,
        inventories: {},
        provinceInventories: {},
        facilityGroups: [],
        stats: {},
      },
    },
  };
}

type SaveEpochHarness = {
  loadState: (revision?: number) => Promise<{
    ok: boolean;
    revision: number | null;
    saveEpoch: number | null;
    error: string;
    staleMessage: string;
  }>;
  loadAndWriteOnAuthorityPublish: () => Promise<{
    state: { ok: boolean; saveEpoch: number | null };
    write: { ok: boolean; message: string } | null;
  }>;
  writeAfterOrdinaryReset: () => Promise<{ ok: boolean; message: string }>;
  writeAfterEpochMismatch: () => Promise<{ ok: boolean; message: string; staleMessage: string }>;
  resetGameSession: () => void;
};

test('authority publication locks saveEpoch before synchronous background writes and ordinary reset preserves it', async ({ page }) => {
  const epochs: string[] = [];
  await page.route('**/economy-api/game/state**', (route) => json(route, fullStateDelivery(3)));
  await page.route('**/economy-api/game/orders', async (route) => {
    epochs.push(route.request().headers()['x-economy-save-epoch'] || '');
    await json(route, { result: { ok: true, message: '订单已提交' }, revision: 1 });
  });

  await page.goto('save-epoch-test.html');
  const initial = await page.evaluate(() => (
    window as typeof window & { __saveEpochHarness: SaveEpochHarness }
  ).__saveEpochHarness.loadAndWriteOnAuthorityPublish());
  expect(initial.state.ok).toBe(true);
  expect(initial.state.saveEpoch).toBe(3);
  expect(initial.write?.ok).toBe(true);
  expect(epochs).toEqual(['3']);

  const afterReset = await page.evaluate(() => (
    window as typeof window & { __saveEpochHarness: SaveEpochHarness }
  ).__saveEpochHarness.writeAfterOrdinaryReset());
  expect(afterReset.ok).toBe(true);
  expect(epochs).toEqual(['3', '3']);
});

test('same-user epoch change invalidates the document before publication and blocks later writes locally', async ({ page }) => {
  let stateRequestCount = 0;
  let orderRequestCount = 0;
  await page.route('**/economy-api/game/state**', (route) => {
    stateRequestCount += 1;
    return json(
      route,
      stateRequestCount === 1 ? fullStateDelivery(3, 1) : epochPatchDelivery(4, 2),
    );
  });
  await page.route('**/economy-api/game/orders', async (route) => {
    orderRequestCount += 1;
    await json(route, { result: { ok: true, message: '不应发送' }, revision: 2 });
  });

  await page.goto('save-epoch-test.html');
  await page.evaluate(() => (
    window as typeof window & { __saveEpochHarness: SaveEpochHarness }
  ).__saveEpochHarness.resetGameSession());
  const first = await page.evaluate(() => (
    window as typeof window & { __saveEpochHarness: SaveEpochHarness }
  ).__saveEpochHarness.loadState());
  expect(first.ok).toBe(true);
  expect(first.saveEpoch).toBe(3);

  const stale = await page.evaluate(() => (
    window as typeof window & { __saveEpochHarness: SaveEpochHarness }
  ).__saveEpochHarness.loadState(1));
  expect(stale.ok).toBe(false);
  expect(stale.error).toContain('当前存档已变化');
  expect(stale.staleMessage).toContain('请刷新页面后继续操作');

  const blocked = await page.evaluate(() => (
    window as typeof window & { __saveEpochHarness: SaveEpochHarness }
  ).__saveEpochHarness.writeAfterEpochMismatch());
  expect(blocked.ok).toBe(false);
  expect(blocked.message).toContain('请刷新页面后继续操作');
  expect(orderRequestCount).toBe(0);
});

test('production settlement 409 keeps the accepted state and the same basis is not posted again', async ({ page }) => {
  let stateRequestCount = 0;
  let settlementRequestCount = 0;
  const settlementEpochs: string[] = [];
  await page.route('**/economy-api/game/state**', (route) => {
    stateRequestCount += 1;
    return json(
      route,
      stateRequestCount === 1 ? productionStateDelivery(3) : unchangedStateDelivery(1),
    );
  });
  await page.route('**/economy-api/game/production/settle', async (route) => {
    settlementRequestCount += 1;
    settlementEpochs.push(route.request().headers()['x-economy-save-epoch'] || '');
    await json(route, {
      message: '客户端生产补算不是当前权威资源下的最大合法结果',
      code: 'PRODUCTION_SETTLEMENT_INVALID',
    }, 409);
  });

  await page.goto('save-epoch-test.html');
  await page.evaluate(() => (
    window as typeof window & { __saveEpochHarness: SaveEpochHarness }
  ).__saveEpochHarness.resetGameSession());
  const first = await page.evaluate(() => (
    window as typeof window & { __saveEpochHarness: SaveEpochHarness }
  ).__saveEpochHarness.loadState());
  expect(first.ok).toBe(true);
  expect(first.saveEpoch).toBe(3);
  expect(settlementRequestCount).toBe(1);
  expect(settlementEpochs).toEqual(['3']);

  const second = await page.evaluate(() => (
    window as typeof window & { __saveEpochHarness: SaveEpochHarness }
  ).__saveEpochHarness.loadState(1));
  expect(second.ok).toBe(true);
  expect(second.saveEpoch).toBe(3);
  expect(settlementRequestCount).toBe(1);
});
