import { expect, test, type Page } from '@playwright/test';

type PartitionCounts = {
  root: number;
  market: number;
  production: number;
  bank: number;
  status: number;
  orders: number;
  quotes: number;
  calendar: number;
  auction: number;
  contract: number;
  leaderboard: number;
};

type PatchName =
  | 'playerAssets'
  | 'playerBank'
  | 'playerProduction'
  | 'marketOrders'
  | 'marketQuotes'
  | 'marketCalendar'
  | 'auction'
  | 'contract'
  | 'leaderboard';

async function counts(page: Page): Promise<PartitionCounts> {
  return page.evaluate(() => (
    window as typeof window & {
      __partitionAuthorityHarness: { counts: () => PartitionCounts };
    }
  ).__partitionAuthorityHarness.counts());
}

async function patch(page: Page, name: PatchName) {
  await page.evaluate((patchName) => {
    (
      window as typeof window & {
        __partitionAuthorityHarness: { patch: (name: PatchName) => void };
      }
    ).__partitionAuthorityHarness.patch(patchName);
  }, name);
}

test('authority slices only commit React consumers that declare the changed dependency', async ({ page }) => {
  await page.goto('partition-authority-test.html');
  const initial: PartitionCounts = {
    root: 1,
    market: 1,
    production: 1,
    bank: 1,
    status: 1,
    orders: 1,
    quotes: 1,
    calendar: 1,
    auction: 1,
    contract: 1,
    leaderboard: 1,
  };
  await expect.poll(() => counts(page)).toEqual(initial);

  await patch(page, 'playerBank');
  await expect.poll(() => counts(page)).toEqual({
    ...initial,
    bank: 2,
  });

  await patch(page, 'marketQuotes');
  await expect.poll(() => counts(page)).toEqual({
    ...initial,
    market: 2,
    production: 2,
    bank: 2,
    quotes: 2,
  });

  await patch(page, 'marketOrders');
  await expect.poll(() => counts(page)).toEqual({
    ...initial,
    market: 3,
    production: 3,
    bank: 2,
    orders: 2,
    quotes: 2,
  });

  await patch(page, 'marketCalendar');
  await expect.poll(() => counts(page)).toEqual({
    ...initial,
    market: 3,
    production: 3,
    bank: 2,
    orders: 2,
    quotes: 2,
    calendar: 2,
  });

  await patch(page, 'playerProduction');
  await expect.poll(() => counts(page)).toEqual({
    ...initial,
    market: 4,
    production: 4,
    bank: 3,
    orders: 2,
    quotes: 2,
    calendar: 2,
  });

  await patch(page, 'playerAssets');
  await expect.poll(() => counts(page)).toEqual({
    ...initial,
    market: 5,
    production: 5,
    bank: 4,
    status: 2,
    orders: 2,
    quotes: 2,
    calendar: 2,
  });

  await patch(page, 'auction');
  await patch(page, 'contract');
  await patch(page, 'leaderboard');
  await expect.poll(() => counts(page)).toEqual({
    root: 1,
    market: 5,
    production: 6,
    bank: 4,
    status: 3,
    orders: 2,
    quotes: 2,
    calendar: 2,
    auction: 2,
    contract: 2,
    leaderboard: 2,
  });
});

test('captured root authority state stays coherent when the global delivery cache resets', async ({ page }) => {
  await page.goto('partition-authority-test.html');
  await expect(page.getByTestId('root-count')).toHaveText('1');
  const survived = await page.evaluate(() => (
    window as typeof window & {
      __partitionAuthorityHarness: { capturedRootSnapshotSurvivesReset: () => boolean };
    }
  ).__partitionAuthorityHarness.capturedRootSnapshotSurvivesReset());
  expect(survived).toBe(true);
});
