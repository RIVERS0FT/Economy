import { expect, test, type Locator, type Page } from '@playwright/test';

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function gridTrackCount(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).gridTemplateColumns
    .split(' ')
    .filter(Boolean)
    .length);
}

async function openGemShop(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.route('**/economy-api/game/gem-shop', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        gemShop: {
          gems: 40,
          credits: 23_594,
          creditsPerGem: 10,
          minExchangeGems: 1,
          maxExchangeGems: 100,
          maxExchangeableGems: 40,
          totalGemsSpent: 15,
          totalCreditsReceived: 150,
          recentExchanges: [
            { gemsSpent: 10, creditsReceived: 100, createdAt: Date.UTC(2026, 6, 17, 12, 0, 0) },
            { gemsSpent: 5, creditsReceived: 50, createdAt: Date.UTC(2026, 6, 16, 12, 0, 0) },
          ],
        },
      }),
    });
  });
  await page.goto('runtime-test.html?view=gem-shop');
  await expect(page.getByRole('heading', { name: '商店', exact: true })).toBeVisible();
  await expect(page.getByText('1 宝石 = 10 货币', { exact: true })).toBeVisible();
}

test('desktop shop keeps compact icons and places the primary exchange action in the first viewport', async ({ page }) => {
  await openGemShop(page, 1440, 900);

  const grid = page.locator('.gem-shop-grid');
  const balance = page.locator('.gem-shop-balance-card');
  const exchange = page.locator('.gem-shop-exchange-card');
  const history = page.locator('.gem-shop-history-card');
  const icon = page.locator('.gem-shop-balance-row svg').first();
  const confirm = page.getByRole('button', { name: '确认兑换', exact: true });

  expect(await gridTrackCount(grid)).toBe(2);
  const gridBox = await requireBox(grid);
  const balanceBox = await requireBox(balance);
  const exchangeBox = await requireBox(exchange);
  const historyBox = await requireBox(history);
  const iconBox = await requireBox(icon);
  const confirmBox = await requireBox(confirm);

  expect(Math.abs(balanceBox.x - gridBox.x)).toBeLessThan(2);
  expect(Math.abs(balanceBox.width - gridBox.width)).toBeLessThan(2);
  expect(Math.abs(exchangeBox.y - historyBox.y)).toBeLessThan(2);
  expect(exchangeBox.width).toBeGreaterThan(gridBox.width * 0.4);
  expect(historyBox.width).toBeGreaterThan(gridBox.width * 0.4);
  expect(historyBox.x).toBeGreaterThan(exchangeBox.x + exchangeBox.width);
  expect(iconBox.width).toBeLessThanOrEqual(24);
  expect(iconBox.height).toBeLessThanOrEqual(24);
  expect(confirmBox.y + confirmBox.height).toBeLessThanOrEqual(900);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('compact shop stacks all cards without icon or horizontal overflow', async ({ page }) => {
  await openGemShop(page, 390, 844);

  const grid = page.locator('.gem-shop-grid');
  expect(await gridTrackCount(grid)).toBe(1);
  const cards = [
    page.locator('.gem-shop-balance-card'),
    page.locator('.gem-shop-exchange-card'),
    page.locator('.gem-shop-history-card'),
  ];
  const boxes = await Promise.all(cards.map(requireBox));
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].y).toBeGreaterThan(boxes[index - 1].y + boxes[index - 1].height);
  }

  const iconBox = await requireBox(page.locator('.gem-shop-balance-row svg').first());
  expect(iconBox.width).toBeLessThanOrEqual(24);
  expect(iconBox.height).toBeLessThanOrEqual(24);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
