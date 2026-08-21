import { expect, test, type Page, type Route } from '@playwright/test';

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
        version: 36,
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
        researchLevels: [{ id: 'C1', rank: 1, cost: 0, durationMs: 0 }],
        provinces: [{
          id: '110000',
          name: '加利福尼亚州',
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

async function harness<T>(page: Page, callback: (api: SaveEpochHarness) => Promise<T> | T) {
  return page.evaluate(callback);
}

test('authority publication locks saveEpoch before synchronous background writes and ordinary reset preserves it', async ({ page }) => {
  const epochs: string[] = [];
  await page.route('**/economy-api/game/state**', (route) => json(route, fullStateDelivery(3)));
  await page.route('**/economy-api/game/orders', async (route) => {
    epochs.push(route.request().headers()['x-economy-save-epoch'] || '');
    await json(route, { result: { ok: true, message: '订单已提交' }, revision: 1 });
  });

  await page.goto('/save-epoch-test.html');
  const initial = await harness(page, (api) => api.loadAndWriteOnAuthorityPublish());
  expect(initial.state.ok).toBe(true);
  expect(initial.state.saveEpoch).toBe(3);
  expect(initial.write?.ok).toBe(true);
  expect(epochs).toEqual(['3']);

  const afterReset = await harness(page, (api) => api.writeAfterOrdinaryReset());
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

  await page.goto('/save-epoch-test.html');
  await harness(page, (api) => api.resetGameSession());
  const first = await harness(page, (api) => api.loadState());
  expect(first.ok).toBe(true);
  expect(first.saveEpoch).toBe(3);

  const stale = await harness(page, (api) => api.loadState(1));
  expect(stale.ok).toBe(false);
  expect(stale.error).toContain('当前存档已变化');
  expect(stale.staleMessage).toContain('请刷新页面后继续操作');

  const blocked = await harness(page, (api) => api.writeAfterEpochMismatch());
  expect(blocked.ok).toBe(false);
  expect(blocked.message).toContain('请刷新页面后继续操作');
  expect(orderRequestCount).toBe(0);
});
