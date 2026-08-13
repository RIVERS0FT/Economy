import { expect, test, type Page } from '@playwright/test';

type ClockCounts = { parent: number; leaf: number };

async function counts(page: Page): Promise<ClockCounts> {
  return page.evaluate(() => (
    window as typeof window & {
      __clockLeafHarness: { counts: () => ClockCounts };
    }
  ).__clockLeafHarness.counts());
}

test('shared second ticker only commits the clock leaf, not its parent', async ({ page }) => {
  await page.goto('clock-leaf-test.html');
  await expect.poll(() => counts(page)).toEqual({ parent: 1, leaf: 1 });
  const initial = await counts(page);
  await expect.poll(async () => (await counts(page)).leaf, { timeout: 4_000 }).toBeGreaterThan(initial.leaf);
  expect((await counts(page)).parent).toBe(1);
});
