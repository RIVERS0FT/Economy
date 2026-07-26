import { expect, test, type Locator, type Page } from '@playwright/test';

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function wheelOver(page: Page, target: Locator, deltaY: number) {
  const box = await requireBox(target);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, deltaY);
}

async function gridTrackCount(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).gridTemplateColumns
    .split(' ')
    .filter(Boolean)
    .length);
}

const populatedExchanges = [
  { gemsSpent: 10, creditsReceived: 1_000, creditsPerGem: 100, createdAt: Date.UTC(2026, 6, 17, 12, 0, 0) },
  { gemsSpent: 5, creditsReceived: 500, creditsPerGem: 100, createdAt: Date.UTC(2026, 6, 16, 12, 0, 0) },
];

async function openGemShop(page: Page, width: number, height: number, recentExchanges = populatedExchanges) {
  await page.setViewportSize({ width, height });
  await page.route('**/economy-api/game/gem-shop', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        gemShop: {
          gems: 40,
          credits: 23_594,
          creditsPerGem: 100,
          minExchangeGems: 1,
          maxExchangeGems: 100,
          maxExchangeableGems: 40,
          totalGemsSpent: 15,
          totalCreditsReceived: 1_500,
          recentExchanges,
        },
      }),
    });
  });
  await page.route('**/economy-api/game/invitations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        invitation: {
          gems: 40,
          inviteCode: 'ABCDEFGH',
          shareUrl: 'https://game.riversoft.top/economy/?invite=ABCDEFGH',
          rewardGems: 10,
          successfulInvitations: 3,
          shareLinkInvitations: 2,
          manualCodeInvitations: 1,
          invitationGemsEarned: 30,
          recentInvitations: [
            {
              playerName: '测试玩家',
              source: 'manual_code',
              status: 'rewarded',
              rewardGems: 10,
              claimedAt: Date.UTC(2026, 6, 18, 12, 0, 0),
              rewardedAt: Date.UTC(2026, 6, 18, 12, 0, 0),
            },
          ],
        },
      }),
    });
  });
  await page.goto('runtime-test.html?view=gem-shop');
  await expect(page.getByRole('heading', { name: '商店', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '兑换货币', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '兑换记录', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '邀请好友', exact: true })).toBeVisible();
  await expect(page.getByText('1 宝石 = 100 货币', { exact: true })).toBeVisible();
  await expect(page.getByText('注册完成后不能补填或更换。', { exact: false })).toBeVisible();
  await expect(page.getByLabel('填写好友邀请码')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '确认填写', exact: true })).toHaveCount(0);
}

test('desktop shop keeps invitation and exchange in independent top-aligned stacks', async ({ page }) => {
  await openGemShop(page, 1440, 900);

  const grid = page.locator('.gem-shop-grid');
  const balance = page.locator('.gem-shop-balance-card');
  const mainColumn = page.locator('.gem-shop-main-column');
  const sideColumn = page.locator('.gem-shop-side-column');
  const invitation = page.locator('.invite-card');
  const exchange = page.locator('.gem-shop-exchange-card');
  const history = page.locator('.gem-shop-history-card');
  const icon = page.locator('.gem-shop-balance-row svg').first();
  const confirm = page.getByRole('button', { name: '确认兑换', exact: true });

  await expect(confirm).toBeEnabled();
  expect(await gridTrackCount(grid)).toBe(2);
  const gridBox = await requireBox(grid);
  const balanceBox = await requireBox(balance);
  const mainBox = await requireBox(mainColumn);
  const sideBox = await requireBox(sideColumn);
  const invitationBox = await requireBox(invitation);
  const exchangeBox = await requireBox(exchange);
  const historyBox = await requireBox(history);
  const iconBox = await requireBox(icon);
  const confirmBox = await requireBox(confirm);

  expect(Math.abs(balanceBox.x - gridBox.x)).toBeLessThan(2);
  expect(Math.abs(balanceBox.width - gridBox.width)).toBeLessThan(2);
  expect(Math.abs(mainBox.y - sideBox.y)).toBeLessThan(2);
  expect(Math.abs(invitationBox.y - exchangeBox.y)).toBeLessThan(2);
  expect(historyBox.y).toBeGreaterThan(invitationBox.y + invitationBox.height);
  expect(sideBox.x).toBeGreaterThan(mainBox.x + mainBox.width);
  expect(iconBox.width).toBeLessThanOrEqual(24);
  expect(iconBox.height).toBeLessThanOrEqual(24);
  expect(confirmBox.y + confirmBox.height).toBeLessThanOrEqual(900);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('integer amount input always owns the wheel without moving the page', async ({ page }) => {
  await openGemShop(page, 390, 520);

  const input = page.getByLabel('消耗宝石数量');
  const pageScroll = page.locator('.page-scroll');
  await expect(input).toBeVisible();

  await input.fill('5');
  const beforeChange = await pageScroll.evaluate((element) => element.scrollTop);
  await wheelOver(page, input, 160);
  await expect(input).toHaveValue('4');
  expect(await pageScroll.evaluate((element) => element.scrollTop)).toBe(beforeChange);

  await input.fill('1');
  const beforeBoundary = await pageScroll.evaluate((element) => element.scrollTop);
  await wheelOver(page, input, 160);
  await expect(input).toHaveValue('1');
  expect(await pageScroll.evaluate((element) => element.scrollTop)).toBe(beforeBoundary);
});

test('desktop empty shop keeps balance and primary exchange action dense', async ({ page }) => {
  await openGemShop(page, 1680, 930, []);

  const balance = await requireBox(page.locator('.gem-shop-balance-card'));
  const exchange = await requireBox(page.locator('.gem-shop-exchange-card'));
  const confirm = await requireBox(page.getByRole('button', { name: '确认兑换', exact: true }));

  expect(await gridTrackCount(page.locator('.gem-shop-balance-row'))).toBe(3);
  expect(balance.height).toBeLessThan(130);
  expect(exchange.height).toBeLessThan(340);
  expect(confirm.y + confirm.height).toBeLessThan(720);
});

test('compact shop orders exchange before invitation without horizontal overflow', async ({ page }) => {
  await openGemShop(page, 390, 844);

  const grid = page.locator('.gem-shop-grid');
  expect(await gridTrackCount(grid)).toBe(1);
  const cards = [
    page.locator('.gem-shop-balance-card'),
    page.locator('.gem-shop-exchange-card'),
    page.locator('.invite-card'),
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
