import { expect, test } from '@playwright/test';

test.describe('navigation pill geometry', () => {
  test('player mobile navigation uses large vertical icon-label pills without changing glass or state colors', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=map&scenario=empty');

    const host = page.locator('.mobile-bottom-navigation[data-navigation-surface="game-mobile-navigation"]');
    const navigation = page.getByRole('navigation', { name: '游戏主导航' });
    const overview = navigation.getByRole('button', { name: '概览', exact: true });
    const market = navigation.getByRole('button', { name: '市场', exact: true });
    const hiddenOverview = host.locator('.sidebar-nav-button').filter({ hasText: '概览' });
    await expect(host).toBeVisible();

    const geometry = await overview.evaluate((button) => {
      const iconSlot = button.querySelector<HTMLElement>(':scope > span');
      const icon = iconSlot?.querySelector<HTMLElement>('.game-icon');
      const label = button.querySelector<HTMLElement>(':scope > strong');
      const surface = button.closest('.frosted-glass-surface');
      if (!iconSlot || !icon || !label || !surface) throw new Error('mobile navigation fixture is incomplete');
      const buttonBox = button.getBoundingClientRect();
      const iconBox = icon.getBoundingClientRect();
      const labelBox = label.getBoundingClientRect();
      const style = getComputedStyle(button);
      const surfaceStyle = getComputedStyle(surface);
      return {
        width: buttonBox.width,
        height: buttonBox.height,
        borderRadius: Number.parseFloat(style.borderTopLeftRadius),
        background: style.backgroundColor,
        border: style.borderTopColor,
        iconWidth: iconBox.width,
        iconHeight: iconBox.height,
        iconCenterX: (iconBox.left + iconBox.right) / 2,
        labelCenterX: (labelBox.left + labelBox.right) / 2,
        iconBottom: iconBox.bottom,
        labelTop: labelBox.top,
        surfaceBackground: surfaceStyle.backgroundColor,
        surfaceFilter: surfaceStyle.backdropFilter,
      };
    });
    const inactiveVisual = await market.evaluate((button) => {
      const style = getComputedStyle(button);
      return { background: style.backgroundColor, border: style.borderTopColor };
    });

    expect(geometry.width).toBeCloseTo(56, 0);
    expect(geometry.height).toBeCloseTo(50, 0);
    expect(geometry.borderRadius).toBeGreaterThanOrEqual(25);
    expect(geometry.iconWidth).toBeCloseTo(21.6, 0);
    expect(geometry.iconHeight).toBeCloseTo(21.6, 0);
    expect(Math.abs(geometry.iconCenterX - geometry.labelCenterX)).toBeLessThanOrEqual(1);
    expect(geometry.iconBottom).toBeLessThanOrEqual(geometry.labelTop + 1);
    expect(geometry.background).toBe('rgba(0, 0, 0, 0)');
    expect(geometry.border).toBe('rgba(0, 0, 0, 0)');
    expect(inactiveVisual.background).toBe('rgba(0, 0, 0, 0)');
    expect(inactiveVisual.border).toBe('rgba(0, 0, 0, 0)');
    expect(geometry.surfaceBackground).toBe('rgba(5, 20, 14, 0.76)');
    expect(geometry.surfaceFilter).toContain('blur(18px)');

    await overview.click();
    await expect(host).toHaveAttribute('data-workspace-sheet-hidden', 'true');
    await expect(hiddenOverview).toHaveClass(/active/);
    await expect(hiddenOverview).toHaveAttribute('aria-current', 'page');
  });

  test('desktop map lens controls use horizontal pills on a solid non-glass map surface while retaining state colors', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=map&scenario=empty');

    const bar = page.getByRole('navigation', { name: '地图镜头' });
    const buttons = bar.getByRole('button');
    await expect(bar).toBeVisible();
    await expect(buttons).toHaveCount(5);

    const geometry = await buttons.first().evaluate((button) => {
      const icon = button.querySelector<HTMLElement>('svg');
      const label = button.querySelector<HTMLElement>('span');
      const barElement = button.closest<HTMLElement>('.strategic-map-lens-bar');
      if (!icon || !label || !barElement) throw new Error('map lens fixture is incomplete');
      const buttonBox = button.getBoundingClientRect();
      const iconBox = icon.getBoundingClientRect();
      const labelBox = label.getBoundingClientRect();
      const style = getComputedStyle(button);
      const barStyle = getComputedStyle(barElement);
      return {
        display: style.display,
        flexDirection: style.flexDirection,
        whiteSpace: style.whiteSpace,
        height: buttonBox.height,
        borderRadius: Number.parseFloat(style.borderTopLeftRadius),
        iconRight: iconBox.right,
        labelLeft: labelBox.left,
        iconCenterY: (iconBox.top + iconBox.bottom) / 2,
        labelCenterY: (labelBox.top + labelBox.bottom) / 2,
        color: style.color,
        background: style.backgroundColor,
        border: style.borderTopColor,
        barBackground: barStyle.backgroundColor,
        barFilter: barStyle.backdropFilter,
      };
    });

    expect(geometry.display).toBe('flex');
    expect(geometry.flexDirection).toBe('row');
    expect(geometry.whiteSpace).toBe('nowrap');
    expect(geometry.height).toBeGreaterThanOrEqual(44);
    expect(geometry.borderRadius).toBeGreaterThanOrEqual(22);
    expect(geometry.iconRight).toBeLessThan(geometry.labelLeft);
    expect(Math.abs(geometry.iconCenterY - geometry.labelCenterY)).toBeLessThanOrEqual(0.75);
    expect(geometry.background).toBe('rgba(0, 0, 0, 0)');
    expect(geometry.barBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(geometry.barFilter).toBe('none');

    await buttons.nth(2).click();
    await expect(page.locator('.strategic-map-stage')).toHaveAttribute('data-map-lens', 'industry');
    await expect(buttons.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(buttons.nth(2)).toHaveClass(/is-active/);
    await expect.poll(async () => {
      const activeVisual = await buttons.nth(2).evaluate((button) => {
        const style = getComputedStyle(button);
        return {
          color: style.color,
          background: style.backgroundColor,
          border: style.borderTopColor,
        };
      });
      return {
        colorChanged: activeVisual.color !== geometry.color,
        borderChanged: activeVisual.border !== geometry.border,
        backgroundChanged: activeVisual.background !== geometry.background,
      };
    }, { message: '地图镜头激活态必须提交颜色、边框与背景三项视觉变化' }).toEqual({
      colorChanged: true,
      borderChanged: true,
      backgroundChanged: true,
    });
  });
});