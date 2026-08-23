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
  await page.goto('runtime-test.html');
  await page.addStyleTag({ url: '/economy/src/styles/unified-market-admin.css' });
  await page.addStyleTag({ url: '/economy/src/styles/settings.css' });
  await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
}

async function requireSettingsCardOrder(page: Page) {
  const cards = [
    page.locator('.profile-settings-card'),
    page.locator('.game-preferences-card'),
    page.locator('.account-management-card'),
  ];
  const boxes = await Promise.all(cards.map(requireBox));
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].y).toBeGreaterThan(boxes[index - 1].y + boxes[index - 1].height);
    expect(boxes[index].y - (boxes[index - 1].y + boxes[index - 1].height)).toBeLessThan(40);
  }
}

test('desktop settings remain single-column with save deletion management', async ({ page }) => {
  await openSettings(page, 1440, 1000);

  const layout = page.locator('.settings-layout');
  const profile = page.locator('.profile-settings-card');
  const account = page.locator('.account-management-card');

  await expect(layout).toBeVisible();
  await expect(layout.locator(':scope > .widget')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: '邀请好友', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '礼品兑换', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '账号资料', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '前往主页修改账号资料', exact: true })).toHaveCount(0);
  await expect(account.getByRole('heading', { name: '存档管理', exact: true })).toBeVisible();
  await expect(account.getByRole('button', { name: '删除存档', exact: true })).toBeVisible();
  await expect(account.getByRole('heading', { name: '危险区域', exact: true })).toHaveCount(0);
  expect(await gridTrackCount(layout)).toBe(1);
  expect(await gridTrackCount(profile.locator('.player-stat-grid'))).toBe(4);
  await requireSettingsCardOrder(page);

  const profileBox = await requireBox(profile);
  const saveButton = page.getByRole('button', { name: '保存昵称', exact: true });
  const saveButtonBox = await requireBox(saveButton);
  expect(saveButtonBox.width).toBeLessThan(profileBox.width * 0.35);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('mobile settings order, statistics and save deletion action remain compact', async ({ page }) => {
  await openSettings(page, 390, 844);

  const layout = page.locator('.settings-layout');
  expect(await gridTrackCount(layout)).toBe(1);
  expect(await gridTrackCount(page.locator('.profile-settings-card .player-stat-grid'))).toBe(2);
  await expect(layout.locator(':scope > .widget')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: '邀请好友', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '礼品兑换', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '账号资料', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '前往主页修改账号资料', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '存档管理', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '删除存档', exact: true })).toBeVisible();
  await requireSettingsCardOrder(page);

  const editorBox = await requireBox(page.locator('.nickname-editor'));
  const saveButtonBox = await requireBox(page.getByRole('button', { name: '保存昵称', exact: true }));
  expect(Math.abs(saveButtonBox.width - editorBox.width)).toBeLessThan(3);
  const deleteButtonBox = await requireBox(page.getByRole('button', { name: '删除存档', exact: true }));
  expect(Math.abs(deleteButtonBox.width - editorBox.width)).toBeLessThan(3);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
