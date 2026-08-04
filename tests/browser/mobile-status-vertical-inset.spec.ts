import { expect, test } from '@playwright/test';

const mobileWidths = [430, 390, 375, 360, 320];

test('mobile status content fills the bar without an internal vertical inset', async ({ page }) => {
  await page.setViewportSize({ width: 431, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  for (const width of mobileWidths) {
    await page.setViewportSize({ width, height: 900 });
    const status = page.locator('.asset-bar');
    await expect(status).toBeVisible();

    const geometry = await status.evaluate((element) => {
      const layout = element.querySelector<HTMLElement>('.asset-bar-layout');
      const content = element.querySelector<HTMLElement>('.asset-bar-content');
      const items = Array.from(element.querySelectorAll<HTMLElement>('.asset-bar-item'));
      if (!layout || !content || items.length !== 5) {
        throw new Error('mobile status vertical geometry fixture is incomplete');
      }

      const layoutRect = layout.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const contentStyle = getComputedStyle(content);
      const itemRects = items.map((item) => item.getBoundingClientRect());

      return {
        paddingTop: contentStyle.paddingTop,
        paddingBottom: contentStyle.paddingBottom,
        contentTopDelta: contentRect.top - layoutRect.top,
        contentBottomDelta: layoutRect.bottom - contentRect.bottom,
        itemsFillContent: itemRects.every((rect) => (
          Math.abs(rect.top - contentRect.top) <= 1
          && Math.abs(rect.bottom - contentRect.bottom) <= 1
        )),
      };
    });

    expect(geometry.paddingTop, `${width}px 状态内容不应保留顶部内边距`).toBe('0px');
    expect(geometry.paddingBottom, `${width}px 状态内容不应保留底部内边距`).toBe('0px');
    expect(Math.abs(geometry.contentTopDelta), `${width}px 状态内容顶部未与布局对齐`).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.contentBottomDelta), `${width}px 状态内容底部未与布局对齐`).toBeLessThanOrEqual(1);
    expect(geometry.itemsFillContent, `${width}px 状态项未占满状态内容轨道`).toBe(true);
  }
});
