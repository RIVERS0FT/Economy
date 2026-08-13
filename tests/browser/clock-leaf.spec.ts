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
  await page.waitForTimeout(2_200);
  const later = await counts(page);
  expect(later.parent).toBe(1);
  expect(later.leaf).toBeGreaterThan(initial.leaf);
});
