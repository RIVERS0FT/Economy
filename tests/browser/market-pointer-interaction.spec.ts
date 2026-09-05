import { expect, test, type Locator, type Page } from '@playwright/test';

async function pointFor(chart: Locator, index: number, volume: boolean) {
  return chart.evaluate((node, { index, volume }) => {
    const element = node as HTMLElement;
    const box = element.getBoundingClientRect();
    const left = Number(element.dataset.axisLeft);
    const right = Number(element.dataset.axisRight);
    const top = Number(volume ? element.dataset.volumeTop : element.dataset.priceTop);
    const bottom = Number(volume ? element.dataset.volumeBottom : element.dataset.priceBottom);
    return { x: box.left + left + (box.width - left - right) * ((index + 0.5) / 30), y: box.top + (top + bottom) / 2 };
  }, { index, volume });
}

async function inspectPointer(page: Page) {
  return page.evaluate(async () => {
    const { getEChartsInstanceByDom } = await import('/economy/src/components/charts/echartsCore.ts');
    const canvas = document.querySelector('.market-history-echart .economy-chart__canvas') as HTMLElement;
    const chart = getEChartsInstanceByDom(canvas)!;
    const option = chart.getOption() as any;
    const upper = option.xAxis[0].axisPointer;
    const lower = option.xAxis[1].axisPointer;
    return {
      values: [upper.value, lower.value],
      positions: [chart.convertToPixel({ xAxisIndex: 0 }, upper.value), chart.convertToPixel({ xAxisIndex: 1 }, lower.value)],
      statuses: [upper.status, lower.status],
      animations: [upper.animation, lower.animation],
      patterns: [upper.lineStyle.type, lower.lineStyle.type],
      offsets: [upper.lineStyle.dashOffset || 0, lower.lineStyle.dashOffset || 0],
      trigger: option.tooltip[0].triggerOn,
      linked: option.axisPointer[0].link[0].xAxisIndex,
    };
  });
}

async function expectActuallyPainted(tooltip: Locator) {
  const result = await tooltip.evaluate((node) => {
    const element = node as HTMLElement;
    const box = element.getBoundingClientRect();
    const host = element.parentElement!;
    const safe = host.getBoundingClientRect();
    const previous = element.style.cssText;
    // A visible DOM box can still be underneath the Sheet. Probe the actual
    // paint order, then restore pointer transparency before testing controls.
    element.style.setProperty('pointer-events', 'auto', 'important');
    const front = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    const painted = front !== null && element.contains(front);
    element.style.cssText = previous;
    return {
      painted,
      diagnostic: {
        tooltip: { x: box.x, y: box.y, width: box.width, height: box.height, css: element.style.cssText },
        safe: { x: safe.x, y: safe.y, width: safe.width, height: safe.height },
        viewport: { width: innerWidth, height: innerHeight },
        coordinateNodes: [host, ...Array.from(document.querySelectorAll('.market-history-chart, .economy-chart, .economy-chart__canvas, .economy-chart__canvas > div'))].map((parent) => ({
          tag: parent.tagName, cls: parent.className,
          rect: parent.getBoundingClientRect().toJSON(), style: (parent as HTMLElement).style.cssText,
          offsetTop: (parent as HTMLElement).offsetTop, offsetParent: (parent as HTMLElement).offsetParent?.className,
          children: Array.from(parent.children).filter((child) => child.tagName === 'DIV').map((child) => ({
            cls: child.className, rect: child.getBoundingClientRect().toJSON(), style: (child as HTMLElement).style.cssText,
            offsetLeft: (child as HTMLElement).offsetLeft, offsetTop: (child as HTMLElement).offsetTop,
            offsetParent: (child as HTMLElement).offsetParent?.className,
          })),
        })),
        front: front?.outerHTML.slice(0, 500),
        parents: [host, host.parentElement, host.parentElement?.parentElement].filter(Boolean).map((node) => ({
          className: node!.className, z: getComputedStyle(node!).zIndex,
          position: getComputedStyle(node!).position, transform: getComputedStyle(node!).transform,
          inert: (node as HTMLElement).inert,
        })),
      },
      safe: box.left >= safe.left + 7 && box.top >= safe.top + 7
        && box.right <= safe.right - 7 && box.bottom <= safe.bottom - 7,
      host: host.matches('[data-workspace-tooltip-layer="true"]'),
      ordinaryHost: !host.matches(':popover-open'),
      transparentHost: getComputedStyle(host).pointerEvents === 'none',
      glass: getComputedStyle(element).backdropFilter,
    };
  });
  expect(result.painted, JSON.stringify(result.diagnostic)).toBe(true);
  expect(result.safe).toBe(true);
  expect(result.host).toBe(true);
  expect(result.ordinaryHost).toBe(true);
  expect(result.transparentHost).toBe(true);
  expect(result.glass).toContain('blur(18px)');
}

for (const { width, scale, touch } of [
  { width: 960, scale: 1, touch: false },
  { width: 390, scale: 1, touch: true },
  { width: 320, scale: 1.25, touch: true },
]) {
  test.describe(`market pointer ${width}px ${touch ? 'touch' : 'mouse'}`, () => {
    test.use({ viewport: { width, height: 960 }, hasTouch: touch, isMobile: touch });
    test('one painted tooltip, one day and continuous linked pointers in both grids', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('market-runtime-test.html?scenario=freeze-details&fractional=1');
      await page.evaluate((fontScale) => { document.documentElement.style.fontSize = `${16 * fontScale}px`; }, scale);
      const chart = page.locator('.market-history-chart.full');
      await expect(chart.locator('.market-history-echart')).toHaveAttribute('data-echarts-ready', 'true');
      await expect(page.getByText('正在加载当前市场行情…')).toHaveCount(0);
      await chart.scrollIntoViewIfNeeded();
      const tooltip = page.locator('.economy-chart-tooltip');
      for (const index of [0, 15, 29]) {
        let expectedText = '';
        for (const volume of [false, true]) {
          const point = await pointFor(chart, index, volume);
          if (touch) await page.touchscreen.tap(point.x, point.y);
          else await page.mouse.move(point.x, point.y);
          await expect(tooltip).toBeVisible();
          await expect(chart).toHaveAttribute('data-active-bucket-index', String(index));
          await expect(tooltip).toContainText('16.03');
          if (!volume) expectedText = await tooltip.innerText();
          else expect(await tooltip.innerText()).toBe(expectedText);
          await expectActuallyPainted(tooltip);
          const pointer = await inspectPointer(page);
          expect(pointer.values[0]).toBe(pointer.values[1]);
          expect(Math.abs(Number(pointer.positions[0]) - Number(pointer.positions[1]))).toBeLessThanOrEqual(1);
          expect(pointer.statuses).toEqual(['show', 'show']);
          expect(pointer.animations).toEqual([false, false]);
          expect(pointer.patterns).toEqual([[4, 4], [4, 4]]);
          expect(pointer.trigger).toBe('none');
          expect(pointer.linked).toEqual([0, 1]);
          const volumeHeight = await chart.evaluate((node) => Number((node as HTMLElement).dataset.volumeBottom) - Number((node as HTMLElement).dataset.volumeTop));
          expect(Math.abs(pointer.offsets[0] - (volumeHeight % 8))).toBeLessThan(0.03);
          expect(pointer.offsets[1]).toBe(0);
          await expect(page.locator('[data-workspace-tooltip-layer="true"]')).toHaveCount(1);
          await expect(page.locator('.economy-chart-tooltip:visible')).toHaveCount(1);
        }
      }
      await page.keyboard.press('Escape');
      await expect(tooltip).not.toBeVisible();
      const dismissed = await inspectPointer(page);
      expect(dismissed.statuses).toEqual(['hide', 'hide']);
      await expect(chart).toBeVisible();
      if (touch) await expect(page.locator('[data-mobile-workspace-sheet-host="true"]')).toBeVisible();
      await page.getByRole('button', { name: '数量增加 1' }).click();
      await expect(page.locator('#market-trade-quantity')).toHaveValue('2');
      expect(errors).toEqual([]);
    });
  });
}

test.describe('mobile tooltip lifetime', () => {
  test.use({ viewport: { width: 390, height: 960 }, hasTouch: true, isMobile: true });
  test('tap persists through polling and real option updates, cancellation and context reset leave no pointer', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=freeze-details&fractional=1');
    const chart = page.locator('.market-history-chart.full');
    await expect(chart.locator('.market-history-echart')).toHaveAttribute('data-echarts-ready', 'true');
    await expect(page.getByText('正在加载当前市场行情…')).toHaveCount(0);
    await chart.scrollIntoViewIfNeeded();
    const point = await pointFor(chart, 15, false);
    await page.touchscreen.tap(point.x, point.y);
    const tooltip = page.locator('.economy-chart-tooltip');
    const canvas = chart.locator('.economy-chart__canvas');
    const instance = await canvas.getAttribute('data-echarts-instance-id');
    await expect(tooltip).toBeVisible();
    await page.evaluate(() => {
      const timer = setInterval(() => window.__updateFreezeFixture?.(), 1000);
      setTimeout(() => clearInterval(timer), 6500);
    });
    await page.waitForTimeout(6500);
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('16.03');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('market-fixture-context', { detail: { kind: 'price' } })));
    await expect(tooltip).toContainText('16.04');
    await expect(canvas).toHaveAttribute('data-echarts-instance-id', instance!);
    await expect(chart).toHaveAttribute('data-active-bucket-index', '15');
    await expectActuallyPainted(tooltip);
    await chart.dispatchEvent('pointercancel', { pointerType: 'touch', pointerId: 1 });
    await expect(tooltip).not.toBeVisible();
    expect((await inspectPointer(page)).statuses).toEqual(['hide', 'hide']);
    await page.touchscreen.tap(point.x, point.y);
    await expect(tooltip).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('market-fixture-context', { detail: { kind: 'province' } })));
    await expect(page.locator('.economy-chart-tooltip:visible')).toHaveCount(0);
    await expect(canvas).not.toHaveAttribute('data-echarts-instance-id', instance!);
  });
});
