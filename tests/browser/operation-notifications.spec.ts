import { expect, test, type Page } from '@playwright/test';
import { CURRENT_CLIENT_STATE_VERSION } from '../../server/shared/economy-state-version.js';

type HarnessWindow = Window & {
  __operationShowResult: (result: { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>) => Promise<void>;
  __operationNotify: (message: string, tone?: 'info' | 'success' | 'error' | 'warning') => void;
  __updateCommercialGroup: (id: string, patch: Record<string, unknown>) => void;
  __operationRefreshMode?: string;
};

async function initializeIndustrialSession(page: Page) {
  // Exercise the normal state-delivery path; never bypass the production epoch guard.
  await page.route('**/economy-api/game/state**', (route) => route.fulfill({ json: {
    revision: 1, unchanged: false, serverNow: Date.now(),
    partitionRevisions: {
      catalog: 'catalog-0001', player: 'player-00001', market: 'market-00001',
      auction: 'auction-0001', contract: 'contract-0001', leaderboard: 'leader-00001',
    },
    patches: {
      catalog: {
        version: CURRENT_CLIENT_STATE_VERSION,
        products: [{ id: 'machinery', name: '机械', category: 'industrial', basePrice: 5 }],
        facilityTypes: [{
          id: 'machine-factory', name: '机械厂', category: 'industrial', complexity: 'C1',
          buildCost: 100, buildTimeMs: 0, cycleMs: 300_000, operatingCost: 1, inputs: [],
          output: { productId: 'machinery', quantity: 1 }, systemValue: 100,
          defaultRecipeId: 'machine-standard', recipes: [{
            id: 'machine-standard', name: '标准', cycleMs: 300_000, operatingCost: 1,
            inputs: [], output: { productId: 'machinery', quantity: 1 },
          }],
        }],
        commercialBuildingTypes: [{ id: 'convenience-store', name: '便利店' }],
        researchLevels: [{ id: 'C1', rank: 1, cost: 0, durationMs: 0 }],
        provinces: [{ id: '110000', name: '加利福尼亚', shortName: 'CA', mapName: 'California', longitude: -119.4179, latitude: 36.7783 }],
        defaultProvinceId: '110000',
      },
      player: {
        userId: 123, saveEpoch: 3, playerName: '测试玩家', registeredAt: 1_800_000_000_000,
        credits: 10_000, frozenCredits: 0, inventories: {}, provinceInventories: {}, facilityGroups: [], stats: {},
        factoryAutoOperationPolicies: { '110000:machine-factory': { enabled: true, inputCoverageCycles: 2, mode: 'balanced', outputMode: 'surplus' } },
      },
      market: { orders: [], markets: {} }, auction: { assetAuctions: [] },
      contract: { productionContracts: [] }, leaderboard: { leaderboard: [] },
    },
  } }));
  const epoch = await page.evaluate(async () => {
    const apiPath = '/src/api/game.ts';
    const sessionPath = '/src/api/gameWriteSession.ts';
    const api = await import(apiPath);
    const session = await import(sessionPath);
    session.beginGameWriteSession(123);
    const response = await api.getGameState();
    return response.state?.saveEpoch;
  });
  expect(epoch).toBe(3);
}

async function openDetail(page: Page, kind: 'industrial' | 'commercial') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('runtime-test.html?view=regional-buildings&scenario=activity');
  if (kind === 'industrial') await initializeIndustrialSession(page);
  await page.getByRole('tab', { name: kind === 'industrial' ? '工业' : '商业', exact: true }).click();
  await page.locator('.unified-building-list > .facility-cluster-selector-card').first().click();
  await expect(page.locator(`.building-detail-page[data-building-kind="${kind}"]`)).toBeVisible();
  const control = page.getByRole('checkbox', { name: /^(开启|关闭)自动经营$/ });
  await control.scrollIntoViewIfNeeded();
  await control.focus();
  return control;
}

async function geometry(page: Page) {
  return page.locator('.building-detail-page').evaluate((root) => {
    const nodes = [...root.querySelectorAll<HTMLElement>('.facility-auto-operation, .facility-auto-operation__header, .facility-production-formula, .facility-production-settings')];
    const boxes = nodes.map((element) => {
      const box = element.getBoundingClientRect();
      return [box.x, box.y, box.width, box.height];
    }).flat();
    const scroll: number[] = [window.scrollX, window.scrollY];
    let element: HTMLElement | null = root.querySelector('.facility-auto-operation');
    while (element) { scroll.push(element.scrollLeft, element.scrollTop); element = element.parentElement; }
    return [...boxes, ...scroll];
  });
}

async function expectGeometryUnchanged(page: Page, before: number[]) {
  await expect.poll(async () => {
    const after = await geometry(page);
    return after.length === before.length ? Math.max(...after.map((value, index) => Math.abs(value - before[index]))) : Infinity;
  }).toBeLessThanOrEqual(1);
  await expect(page.locator('.facility-auto-operation__message, .commercial-action-error')).toHaveCount(0);
  await expect(page.getByText('自动经营策略已保存', { exact: true })).toHaveCount(0);
}

async function receiptHistory(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((value) => value.startsWith('economy:notifications:v1:'));
    return key ? JSON.parse(localStorage.getItem(key) || '[]') as { id: string; title: string; tone: string; readAt: number | null }[] : [];
  });
}

for (const width of [320, 1440]) {
  for (const kind of ['industrial', 'commercial'] as const) {
    test(`${kind} save uses a notification without moving the page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let requests = 0;
      await page.route(kind === 'industrial' ? '**/economy-api/game/orders' : '**/economy-api/game/commercial-buildings', async (route) => {
        requests += 1;
        const payload = route.request().postDataJSON();
        if (kind === 'industrial') {
          expect(route.request().headers()['x-economy-save-epoch']).toBe('3');
          expect(payload.execution).toBe('factory-auto-operation-policy');
        }
        await gate;
        if (kind === 'commercial') {
          await page.evaluate((policy) => (window as HarnessWindow).__updateCommercialGroup('convenience-store', { autoOperationPolicy: policy }), payload.policy);
        }
        await route.fulfill({ json: { revision: 1, result: { ok: true, message: '自动经营策略已保存' } } });
      });
      const auto = await openDetail(page, kind);
      const before = await geometry(page);
      await auto.click();
      await expect(auto).toBeDisabled();
      await auto.evaluate((element) => (element as HTMLInputElement).click());
      await expect.poll(() => requests).toBe(1);
      release();
      await expect(auto).toBeEnabled();
      await expect(auto).not.toBeChecked();
      await expect(page.locator('.notification-toast--success, .notification-island--success')).toContainText('自动经营已关闭');
      await expectGeometryUnchanged(page, before);
      await expect.poll(async () => (await receiptHistory(page)).filter((item) => item.title === '自动经营已关闭').length).toBe(1);
    });

    test(`${kind} rejected save preserves layout and authoritative settings at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      let requests = 0;
      await page.route(kind === 'industrial' ? '**/economy-api/game/orders' : '**/economy-api/game/commercial-buildings', (route) => {
        requests += 1;
        if (kind === 'industrial') expect(route.request().headers()['x-economy-save-epoch']).toBe('3');
        return route.fulfill({ json: { revision: 1, result: { ok: false, message: '设置不可用' } } });
      });
      const auto = await openDetail(page, kind);
      const before = await geometry(page);
      await auto.click();
      await expect(page.locator('.notification-toast--error, .notification-island--error')).toContainText('设置不可用');
      await expect(auto).toBeEnabled();
      await expect(auto).toBeChecked();
      expect(requests).toBe(1);
      await expectGeometryUnchanged(page, before);
    });
  }

  test(`identical independent receipts survive batching but one result is reported once at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openDetail(page, 'commercial');
    const before = await geometry(page);
    await page.evaluate(async () => {
      const report = (window as HarnessWindow).__operationShowResult;
      const result = Promise.resolve({ ok: true, message: '设置已更新' });
      await Promise.all([report(result), report(result), report({ ok: true, message: '设置已更新' })]);
    });
    await expect.poll(async () => (await receiptHistory(page)).length).toBe(2);
    const records = await receiptHistory(page);
    expect(new Set(records.map((item) => item.id)).size).toBe(2);
    expect(records.every((item) => item.title === '设置已更新' && item.tone === 'success')).toBe(true);
    await expectGeometryUnchanged(page, before);
  });

  test(`disabled alerts and an open panel retain receipts without later replay at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openDetail(page, 'commercial');
    const trigger = page.getByRole('button', { name: /^通知，/ });
    await trigger.click();
    const panel = page.getByRole('dialog', { name: '通知', exact: true });
    await panel.getByRole('button', { name: '禁用通知', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.evaluate(() => (window as HarnessWindow).__operationNotify('关闭提醒期间的操作', 'success'));
    await expect.poll(async () => (await receiptHistory(page)).length).toBe(1);
    await expect(page.locator('.notification-toast, .notification-island')).toHaveCount(0);
    await trigger.click();
    await panel.getByRole('button', { name: '启用通知', exact: true }).click();
    await page.evaluate(() => (window as HarnessWindow).__operationNotify('面板打开期间的操作', 'success'));
    await expect(panel.getByText('面板打开期间的操作', { exact: true })).toBeVisible();
    await expect.poll(async () => (await receiptHistory(page)).length).toBe(2);
    expect((await receiptHistory(page)).every((item) => item.readAt !== null)).toBe(true);
    await expect(page.locator('.notification-toast, .notification-island')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(page.locator('.notification-toast, .notification-island')).toHaveCount(0);
  });
}

test('an unconfirmed commercial response warns and refreshes authority without a second mutation', async ({ page }) => {
  let requests = 0;
  await page.route('**/economy-api/game/commercial-buildings', (route) => {
    requests += 1;
    return route.fulfill({ status: 503, json: { message: '服务暂时不可用' } });
  });
  const auto = await openDetail(page, 'commercial');
  const before = await geometry(page);
  await auto.click();
  await expect(page.locator('.notification-toast--warning, .notification-island--warning')).toContainText('自动经营设置结果未确认');
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).__operationRefreshMode)).toBe('authoritative');
  await expect(auto).toBeEnabled();
  expect(requests).toBe(1);
  await expectGeometryUnchanged(page, before);
});
