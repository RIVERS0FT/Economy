import { expect, test, type Page } from '@playwright/test';

type PartitionCounts = {
  root: number;
  market: number;
  auction: number;
  contract: number;
  leaderboard: number;
  status: number;
};

type PartitionName = 'player' | 'market' | 'auction' | 'contract' | 'leaderboard';

async function counts(page: Page): Promise<PartitionCounts> {
  return page.evaluate(() => (
    window as typeof window & {
      __partitionAuthorityHarness: { counts: () => PartitionCounts };
    }
  ).__partitionAuthorityHarness.counts());
}

async function patch(page: Page, name: PartitionName) {
  await page.evaluate((partitionName) => {
    (
      window as typeof window & {
        __partitionAuthorityHarness: { patch: (name: PartitionName) => void };
      }
    ).__partitionAuthorityHarness.patch(partitionName);
  }, name);
}

test('authority partition patches only commit subscribed React consumers', async ({ page }) => {
  await page.goto('partition-authority-test.html');
  const initial = {
    root: 1,
    market: 1,
    auction: 1,
    contract: 1,
    leaderboard: 1,
    status: 1,
  };
  await expect.poll(() => counts(page)).toEqual(initial);

  await patch(page, 'auction');
  await expect.poll(() => counts(page)).toEqual({
    ...initial,
    auction: 2,
  });

  await patch(page, 'market');
  await expect.poll(() => counts(page)).toEqual({
    ...initial,
    market: 2,
    auction: 2,
    contract: 2,
  });

  await patch(page, 'leaderboard');
  await expect.poll(() => counts(page)).toEqual({
    ...initial,
    market: 2,
    auction: 2,
    contract: 2,
    leaderboard: 2,
    status: 2,
  });

  await patch(page, 'contract');
  await expect.poll(() => counts(page)).toEqual({
    ...initial,
    market: 2,
    auction: 2,
    contract: 3,
    leaderboard: 2,
    status: 2,
  });

  await patch(page, 'player');
  await expect.poll(() => counts(page)).toEqual({
    root: 1,
    market: 3,
    auction: 3,
    contract: 4,
    leaderboard: 3,
    status: 3,
  });
});
