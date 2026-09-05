import { expect, test, type Page, type Route } from '@playwright/test';

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function fullStateDelivery(revision = 1) {
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
        version: 41,
        products: [{ id: 'wheat', name: '小麦', category: 'raw', basePrice: 1 }],
        facilityTypes: [{ id: 'farm', name: '农场', category: 'raw' }],
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
        saveEpoch: 1,
        playerName: `Lifecycle Tester ${revision}`,
        registeredAt: 1_800_000_000_000,
        lastProcessedAt: 1_850_000_000_000,
        credits: 100,
        frozenCredits: 0,
        gems: 0,
        provinceInventories: { '110000': {} },
        provinceFacilityGroups: { '110000': [] },
        assetSummary: {
          cashValue: 100,
          commodityValue: 0,
          facilityValue: 0,
          totalAssets: 100,
        },
        stats: {},
      },
      market: {
        orders: [],
        provinceMarkets: { '110000': {} },
        provinceFacilityMarkets: { '110000': {} },
      },
      auction: { assetAuctions: [] },
      contract: { productionContracts: [] },
      leaderboard: { leaderboard: [] },
    },
  };
}

function brokenCatalogDelivery(revision = 2) {
  return {
    revision,
    unchanged: false,
    serverNow: 1_850_000_001_000,
    partitionRevisions: {
      catalog: `catalog-${String(revision).padStart(4, '0')}`,
      player: 'player-00001',
      market: 'market-00001',
      auction: 'auction-0001',
      contract: 'contract-0001',
      leaderboard: 'leader-00001',
    },
    patches: {
      catalog: { version: 41 },
    },
  };
}

async function observeLoadingTransitions(page: Page) {
  await page.evaluate(() => {
    const target = window as typeof window & {
      __gameLoadingTransitions?: number;
      __gameLoadingObserver?: MutationObserver;
    };
    target.__gameLoadingTransitions = 0;
    const recordLoading = () => {
      if (document.querySelector('[data-testid="game-view-model-status"]')?.textContent === 'loading') {
        target.__gameLoadingTransitions = (target.__gameLoadingTransitions ?? 0) + 1;
      }
    };
    const observer = new MutationObserver(recordLoading);
    observer.observe(document.getElementById('root') as HTMLElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    target.__gameLoadingObserver = observer;
  });
}

async function readLoadingTransitions(page: Page) {
  return page.evaluate(() => (
    window as typeof window & { __gameLoadingTransitions?: number }
  ).__gameLoadingTransitions ?? 0);
}

test('ready game view model does not return to loading on parent rerender or same-user remount', async ({ page }) => {
  let stateRequests = 0;
  await page.route('**/economy-api/game/state**', async (route) => {
    stateRequests += 1;
    await json(route, fullStateDelivery(stateRequests));
  });

  await page.goto('/economy/game-loading-lifecycle-test.html');
  const status = page.getByTestId('game-view-model-status');
  await expect(status).toHaveText('ready');
  const requestsAfterReady = stateRequests;

  await observeLoadingTransitions(page);

  await page.locator('#rerender-parent').click();
  await page.waitForTimeout(100);
  await expect(status).toHaveText('ready');
  expect(stateRequests).toBe(requestsAfterReady);

  await page.locator('#remount-game').click();
  await page.waitForTimeout(100);
  await expect(status).toHaveText('ready');
  expect(stateRequests).toBe(requestsAfterReady);

  const loadingTransitions = await readLoadingTransitions(page);
  expect(loadingTransitions).toBe(0);
});

test('ready game stays visible while integrity recovery clears transport cache and refetches a full snapshot', async ({ page }) => {
  let stateRequests = 0;
  let recoveryArmed = false;
  let recoveryRequests = 0;
  await page.route('**/economy-api/game/state**', async (route) => {
    stateRequests += 1;
    if (!recoveryArmed) {
      await json(route, fullStateDelivery(1));
      return;
    }

    recoveryRequests += 1;
    if (recoveryRequests === 1) {
      await json(route, brokenCatalogDelivery(2));
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    await json(route, fullStateDelivery(3));
  });

  await page.goto('/economy/game-loading-lifecycle-test.html');
  const status = page.getByTestId('game-view-model-status');
  const playerName = page.getByTestId('game-player-name');
  await expect(status).toHaveText('ready');
  await expect(playerName).toHaveText('Lifecycle Tester 1');

  await observeLoadingTransitions(page);
  recoveryArmed = true;
  await page.locator('#refresh-game').click();

  await expect(status).toHaveText('ready');
  await expect(playerName).toHaveText('Lifecycle Tester 3');
  expect(recoveryRequests).toBeGreaterThanOrEqual(2);
  expect(stateRequests).toBeGreaterThanOrEqual(3);
  const loadingTransitions = await readLoadingTransitions(page);
  expect(loadingTransitions).toBe(0);
});
