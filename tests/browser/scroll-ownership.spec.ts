import { expect, test, type Locator, type Page } from '@playwright/test';

async function wheelOver(page: Page, target: Locator, deltaY: number) {
  const box = await target.boundingBox();
  if (!box) throw new Error('scroll ownership target is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 60));
  await page.mouse.wheel(0, deltaY);
}

async function position(target: Locator) {
  return target.evaluate((element) => ({
    top: element.scrollTop,
    maximum: Math.max(0, element.scrollHeight - element.clientHeight),
  }));
}

test.describe('nested scroll ownership', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 720 });
    await page.goto('runtime-test.html?view=scroll-ownership');
  });

  test('the nearest custom ScrollArea owns the wheel until it reaches its boundary', async ({ page }) => {
    const outer = page.locator('.scroll-ownership-custom-outer-viewport');
    const inner = page.locator('.scroll-ownership-custom-inner-viewport');

    await wheelOver(page, inner, 160);
    await expect.poll(async () => (await position(inner)).top).toBeGreaterThan(0);
    expect((await position(outer)).top).toBe(0);

    await inner.evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight; });
    await outer.evaluate((element) => { element.scrollTop = 0; });
    await wheelOver(page, inner, 160);
    await expect.poll(async () => (await position(outer)).top).toBeGreaterThan(0);
  });

  test('a native nested scrollport is not stolen by the parent ScrollArea', async ({ page }) => {
    const outer = page.locator('.scroll-ownership-native-outer-viewport');
    const inner = page.locator('.scroll-ownership-native-inner');

    await wheelOver(page, inner, 160);
    await expect.poll(async () => (await position(inner)).top).toBeGreaterThan(0);
    expect((await position(outer)).top).toBe(0);

    await inner.evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight; });
    await outer.evaluate((element) => { element.scrollTop = 0; });
    await wheelOver(page, inner, 160);
    await expect.poll(async () => (await position(outer)).top).toBeGreaterThan(0);
  });

  test('the final boundary leaves the wheel event unconsumed', async ({ page }) => {
    const outer = page.locator('.scroll-ownership-custom-outer-viewport');
    const inner = page.locator('.scroll-ownership-custom-inner-viewport');
    await page.evaluate(() => {
      (window as typeof window & { __boundaryWheel?: { seen: boolean; defaultPrevented: boolean } }).__boundaryWheel = {
        seen: false,
        defaultPrevented: true,
      };
      document.addEventListener('wheel', (event) => {
        (window as typeof window & { __boundaryWheel?: { seen: boolean; defaultPrevented: boolean } }).__boundaryWheel = {
          seen: true,
          defaultPrevented: event.defaultPrevented,
        };
      }, { once: true });
    });
    await inner.evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight; });
    await outer.evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight; });

    await wheelOver(page, inner, 160);
    await expect.poll(() => page.evaluate(() => (
      window as typeof window & { __boundaryWheel?: { seen: boolean; defaultPrevented: boolean } }
    ).__boundaryWheel)).toEqual({ seen: true, defaultPrevented: false });
  });
});
