import { expect, test } from '@playwright/test';

test('province map exposes 34 clickable regions and switches local operating context', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: '中国地图', exact: true })).toBeVisible();
  const markers = page.locator('.province-map-marker');
  await expect(markers).toHaveCount(34);
  const overlaps = await markers.evaluateAll((nodes) => nodes.flatMap((node, index) => {
    const left = node.getBoundingClientRect();
    return nodes.slice(index + 1).flatMap((candidate) => {
      const right = candidate.getBoundingClientRect();
      const overlapsHorizontally = left.left < right.right && left.right > right.left;
      const overlapsVertically = left.top < right.bottom && left.bottom > right.top;
      return overlapsHorizontally && overlapsVertically
        ? [`${node.getAttribute('aria-label')} / ${candidate.getAttribute('aria-label')}`]
        : [];
    });
  }));
  expect(overlaps).toEqual([]);
  await expect(page.getByRole('button', { name: /北京市，工厂 18，库存 580/ })).toHaveAttribute('aria-pressed', 'true');

  const guangdong = page.getByRole('button', { name: /广东省，工厂 0，库存 0/ });
  await guangdong.click();
  await expect(guangdong).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: '广东省' })).toBeVisible();
  await expect(page.getByText('当地商品只进入本地仓库，订单只与当地盘口撮合。')).toBeVisible();

  await page.getByRole('button', { name: '进入本地市场' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __lastSelectedTab?: string }).__lastSelectedTab)).toBe('market');
});
