import { expect, test, type Page, type Route } from '@playwright/test';
import { CURRENT_CLIENT_STATE_VERSION } from '../../server/shared/economy-state-version.js';

async function initializeWriteAuthority(page: Page) {
  await page.route('**/economy-api/game/state**', (route) => route.fulfill({ json: {
    revision: 1,
    unchanged: false,
    serverNow: Date.now(),
    partitionRevisions: {
      catalog: 'catalog-0001',
      player: 'player-00001',
      market: 'market-00001',
      auction: 'auction-0001',
      contract: 'contract-0001',
      leaderboard: 'leader-00001',
    },
    patches: {
      catalog: {
        version: CURRENT_CLIENT_STATE_VERSION,
        products: [{ id: 'wheat', name: '小麦', category: 'agriculture', basePrice: 1 }],
        facilityTypes: [{
          id: 'farm',
          name: '农场',
          category: 'industrial',
          complexity: 'C1',
          buildCost: 100,
          buildTimeMs: 0,
          cycleMs: 300_000,
          operatingCost: 1,
          inputs: [],
          output: { productId: 'wheat', quantity: 1 },
          systemValue: 100,
          defaultRecipeId: 'farm-standard',
          recipes: [{
            id: 'farm-standard',
            name: '标准',
            cycleMs: 300_000,
            operatingCost: 1,
            inputs: [],
            output: { productId: 'wheat', quantity: 1 },
          }],
        }],
        commercialBuildingTypes: [{ id: 'convenience-store', name: '便利店' }],
        researchLevels: [{ id: 'C1', rank: 1, cost: 0, durationMs: 0 }],
        provinces: [{ id: 'A', name: '加利福尼亚', shortName: 'CA', mapName: 'California', longitude: -100, latitude: 30 }],
        defaultProvinceId: 'A',
      },
      player: {
        userId: 8912,
        saveEpoch: 1,
        playerName: '运输测试玩家',
        registeredAt: 1_800_000_000_000,
        credits: 10_000,
        frozenCredits: 0,
        inventories: {},
        provinceInventories: {},
        lastProcessedAt: Date.now(),
        facilityGroups: [],
        stats: {},
      },
      market: { orders: [], markets: {} },
      auction: { assetAuctions: [] },
      contract: { productionContracts: [] },
      leaderboard: { leaderboard: [] },
    },
  } }));
  const epoch = await page.evaluate(async () => {
    const session = await import('/economy/src/api/gameWriteSession.ts');
    const api = await import('/economy/src/api/game.ts');
    session.beginGameWriteSession(8912);
    const response = await api.getGameState();
    return response.state?.saveEpoch;
  });
  expect(epoch).toBe(1);
}

async function open(page: Page) {
  await page.route(/\/transport-fleet-harness$/, (route) => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Transport slots</title><div id="root"></div><script type="module" src="/economy/tests/browser/transport-fleet-harness.tsx"></script></html>' }));
  await page.goto('transport-fleet-harness');
  await initializeWriteAuthority(page);
  await page.waitForFunction(() => Boolean(window.transportFleet));
}
async function patch(page: Page, value: Record<string, unknown>) {
  await page.evaluate((value) => window.transportFleet.patch(value), value);
}
async function chooseTool(page: Page, trigger: ReturnType<Page['getByRole']>, option: string) {
  await trigger.click();
  await page.getByRole('listbox').getByRole('option').filter({ has: page.getByText(option, { exact: true }) }).click();
}

function configuredSlots(mode: 'road' | 'rail' | 'air' = 'air') {
  return {
    version: 1,
    stage: 'C3',
    limit: 5,
    used: 1,
    slots: [
      { id: 'transport-slot-1', index: 1, mode: 'road', experience: 38, level: 6, nextLevelExperience: 54, speedBonusBps: 1500, occupied: true, routeId: 'route-1' },
      { id: 'transport-slot-2', index: 2, mode, experience: 0, level: 1, nextLevelExperience: 3, speedBonusBps: 0, occupied: false },
      { id: 'transport-slot-3', index: 3, mode: 'air', experience: 0, level: 1, nextLevelExperience: 3, speedBonusBps: 0, occupied: false },
      { id: 'transport-slot-4', index: 4, mode: 'road', experience: 3, level: 2, nextLevelExperience: 8, speedBonusBps: 300, occupied: false },
      { id: 'transport-slot-5', index: 5, mode: 'rail', experience: 0, level: 1, nextLevelExperience: 3, speedBonusBps: 0, occupied: false },
    ],
  };
}

test('technology slots render as independent tool choices with persistent training state', async ({ page }) => {
  await open(page);
  const panel = page.locator('[data-transport-slots="true"]');
  await expect(panel).toBeVisible();
  await expect(panel.getByText('1 / 5', { exact: true })).toBeVisible();
  await expect(panel.getByText('科技 C3', { exact: true })).toBeVisible();
  await expect(page.locator('[data-slot-id]')).toHaveCount(5);
  const occupied = page.locator('[data-slot-id="transport-slot-1"]');
  await expect(occupied.getByRole('combobox', { name: '运输工具' })).toBeDisabled();
  await expect(occupied).toContainText('卡车 Lv.6');
  await expect(occupied).toContainText('速度 +15%');
  await expect(occupied).toContainText('熟练度 38 / 54');
  const free = page.locator('[data-slot-id="transport-slot-2"]');
  await expect(free.getByRole('combobox', { name: '运输工具' })).toContainText('火车');
  await expect(free).toContainText('火车 Lv.3');
  await expect(page.getByRole('button', { name: '增加运力', exact: true })).toHaveCount(0);
});

test('switching an idle slot sends one authoritative command and resets only that tool training', async ({ page }) => {
  const requests: Route[] = [];
  await page.route('**/economy-api/game/transport', (route) => { requests.push(route); });
  await open(page);
  const card = page.locator('[data-slot-id="transport-slot-2"]');
  const select = card.getByRole('combobox', { name: '运输工具' });
  await chooseTool(page, select, '飞机');
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].request().headers()['x-economy-save-epoch']).toBe('1');
  expect(requests[0].request().postDataJSON()).toMatchObject({ operation: 'slot-configure', slotId: 'transport-slot-2', mode: 'air' });
  await requests[0].fulfill({ json: { revision: 42, result: { ok: true, message: '槽位 2 已切换为飞机，培养进度已重置', transportSlots: configuredSlots('air') } } });
  await expect(select).toContainText('飞机');
  await expect(card).toContainText('飞机 Lv.1');
  await expect(card).toContainText('熟练度 0 / 3');
  await expect(page.getByText('槽位 2 已切换为飞机，培养进度已重置', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.transportFleet.notices)).toEqual(['槽位 2 已切换为飞机，培养进度已重置']);
  expect(requests).toHaveLength(1);
});

test('occupied slots cannot change tools and become editable after the trip releases the slot', async ({ page }) => {
  const requests: Route[] = [];
  await page.route('**/economy-api/game/transport', (route) => { requests.push(route); route.abort(); });
  await open(page);
  const slot = page.locator('[data-slot-id="transport-slot-1"]');
  await expect(slot).toHaveAttribute('data-slot-occupied', 'true');
  await expect(slot.getByRole('combobox', { name: '运输工具' })).toBeDisabled();
  expect(requests).toHaveLength(0);
  await patch(page, { active: false });
  await expect(slot).toHaveAttribute('data-slot-occupied', 'false');
  await expect(slot.getByRole('combobox', { name: '运输工具' })).toBeEnabled();
});

test('slot cards fit desktop and 320px mobile; route deletion explicitly preserves cultivated tools', async ({ page }) => {
  await open(page);
  for (const width of [1200, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const panel = page.locator('[data-transport-slots="true"]');
    await expect(panel).toBeVisible();
    await expect(async () => {
      const size = await panel.evaluate((element) => ({ width: element.clientWidth, content: element.scrollWidth,
        page: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(size.content).toBeLessThanOrEqual(size.width + 1);
      expect(size.page).toBeLessThanOrEqual(size.viewport + 1);
    }).toPass();
  }
  await page.locator('[data-route-id="route-1"]').click();
  await expect(page.locator('[data-transport-route-capacity]')).toHaveAttribute('data-transport-route-capacity', '200');
  await expect(page.getByText('拥有数量', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '本趟完成后删除', exact: true }).click();
  await expect(page.locator('.transport-delete-confirmation')).toContainText('运输槽位及其中运输工具的培养等级保留');
  await expect(page.getByRole('button', { name: '确认本趟完成后删除' })).toBeVisible();
});
