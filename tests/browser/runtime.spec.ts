import { expect, test } from '@playwright/test';

test('storage denial does not block the settings runtime', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() {
          throw new DOMException('Storage disabled for runtime test', 'SecurityError');
        },
      });
    }
  });
  await page.route('**/economy-api/game/invitations', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: '测试环境未连接邀请服务' }),
    });
  });

  await page.goto('tests/browser/runtime-harness.html');
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  await expect(page.getByText('紧凑数字', { exact: true })).toBeVisible();
  await expect(page.getByText('状态刷新频率', { exact: true })).toBeVisible();
  await expect(page.getByText('界面音效', { exact: true })).toHaveCount(0);
  await expect(page.getByText('画面性能', { exact: true })).toHaveCount(0);

  const localActivity = await page.evaluate(() => (
    window as typeof window & { __localActivityResult: { assetEvents: unknown[]; trades: unknown[] } }
  ).__localActivityResult);
  expect(localActivity).toEqual({ assetEvents: [], trades: [] });
  expect(pageErrors).toEqual([]);
});
