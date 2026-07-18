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

async function openSettings(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.route('**/economy-api/game/invitations', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: '测试环境未连接邀请服务' }),
    });
  });
  await page.goto('runtime-test.html');
  await page.addStyleTag({ url: '/economy/src/styles/unified-market-admin.css' });
  await page.addStyleTag({ url: '/economy/src/styles/invitations.css' });
  await page.addStyleTag({ url: '/economy/src/styles/settings.css' });
  await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
}

test('desktop settings columns stack independently without shared-row gaps', async ({ page }) => {
  await openSettings(page, 1440, 1000);

  const layout = page.locator('.settings-layout');
  const profile = page.locator('.profile-settings-card');
  const preferences = page.locator('.game-preferences-card');
  const invitation = page.locator('.invite-card');
  const gift = page.locator('.gift-redemption-card');
  const account = page.locator('.account-management-card');

  await expect(layout).toBeVisible();
  await expect(account.getByRole('heading', { name: '危险区域', exact: true })).toBeVisible();
  await expect(account.getByText('清空资金、统计、订单和工厂；宝石、邀请关系和封禁记录将保留。', { exact: true })).toBeVisible();
  expect(await gridTrackCount(layout)).toBe(2);
  expect(await gridTrackCount(profile.locator('.player-stat-grid'))).toBe(4);

  const profileBox = await requireBox(profile);
  const preferencesBox = await requireBox(preferences);
  const invitationBox = await requireBox(invitation);
  const giftBox = await requireBox(gift);
  const accountBox = await requireBox(account);

  expect(Math.abs(profileBox.y - preferencesBox.y)).toBeLessThan(3);
  expect(invitationBox.y).toBeGreaterThan(profileBox.y + profileBox.height);
  expect(giftBox.y).toBeGreaterThan(preferencesBox.y + preferencesBox.height);
  expect(giftBox.y - (preferencesBox.y + preferencesBox.height)).toBeLessThan(40);
  expect(accountBox.y).toBeGreaterThan(giftBox.y + giftBox.height);
  expect(giftBox.y).toBeLessThan(profileBox.y + profileBox.height);

  const saveButton = page.getByRole('button', { name: '保存昵称', exact: true });
  const saveButtonBox = await requireBox(saveButton);
  expect(saveButtonBox.width).toBeLessThan(profileBox.width * 0.35);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('mobile settings order, statistics and nickname action remain compact', async ({ page }) => {
  await openSettings(page, 390, 844);

  const layout = page.locator('.settings-layout');
  expect(await gridTrackCount(layout)).toBe(1);
  expect(await gridTrackCount(page.locator('.profile-settings-card .player-stat-grid'))).toBe(2);

  const cards = [
    page.locator('.profile-settings-card'),
    page.locator('.game-preferences-card'),
    page.locator('.invite-card'),
    page.locator('.gift-redemption-card'),
    page.locator('.account-management-card'),
  ];
  const boxes = await Promise.all(cards.map(requireBox));
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].y).toBeGreaterThan(boxes[index - 1].y + boxes[index - 1].height);
  }

  const editorBox = await requireBox(page.locator('.nickname-editor'));
  const saveButtonBox = await requireBox(page.getByRole('button', { name: '保存昵称', exact: true }));
  expect(Math.abs(saveButtonBox.width - editorBox.width)).toBeLessThan(3);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
