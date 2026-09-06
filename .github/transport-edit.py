from pathlib import Path


def replace(path, old, new):
    file = Path(path)
    text = file.read_text()
    assert text.count(old) == 1, f'{path}: {text.count(old)} matches for {old[:80]!r}'
    file.write_text(text.replace(old, new))


replace('tests/browser/transport-balance.spec.ts', '''    await draft.scrollIntoViewIfNeeded();
    await expect(draft).toBeVisible();
    const measurements = await draft.evaluate((element) => ({
      pageWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      width: element.clientWidth,
      contentWidth: element.scrollWidth,
    }));
    expect(measurements.pageWidth).toBeLessThanOrEqual(measurements.viewport + 1);
    expect(measurements.contentWidth).toBeLessThanOrEqual(measurements.width + 1);
    await expect(draft.locator('[data-transport-mode-option="air"]')).toContainText('周期总费用');
    await expect(draft.locator('[data-transport-mode-option="rail"]')).toContainText('预计周期耗时');''', '''    // Crossing the shell breakpoint can replace the page host. Resolve the
    // locator again until the complete new layout satisfies the same bounds.
    await expect(async () => {
      await expect(draft).toBeVisible();
      await draft.scrollIntoViewIfNeeded();
      const measurements = await draft.evaluate((element) => ({
        pageWidth: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
      }));
      expect(measurements.pageWidth).toBeLessThanOrEqual(measurements.viewport + 1);
      expect(measurements.contentWidth).toBeLessThanOrEqual(measurements.width + 1);
      await expect(draft.locator('[data-transport-mode-option="air"]')).toContainText('周期总费用');
      await expect(draft.locator('[data-transport-mode-option="rail"]')).toContainText('预计周期耗时');
    }).toPass({ timeout: 10_000 });''')
replace('tests/browser/market-chart-safe-zone.spec.ts', '''  await page.setViewportSize(viewport);
  await expect.poll(async () => {
    const bounds = await inspectChartGeometry(chart);
    const usesMobileAxisChrome = bounds.chartWidth <= 720;
    return {
      widthChanged: Math.abs(bounds.chartWidth - previousWidth) > 1,
      responsiveChrome: bounds.mobileAxisTitles === (usesMobileAxisChrome ? 'true' : 'false')
        && bounds.xAxisTitleVisible === (usesMobileAxisChrome ? 'false' : 'true'),
      heightSynced: Math.abs(bounds.actualHeight - bounds.declaredHeight) <= 2,
    };
  }).toEqual({ widthChanged: true, responsiveChrome: true, heightSynced: true });
  return inspectChartGeometry(chart);''', '''  await page.setViewportSize(viewport);
  let bounds!: Awaited<ReturnType<typeof inspectChartGeometry>>;
  // The responsive host can remount ECharts while the viewport settles. Retry
  // readiness together with geometry instead of throwing from an early poll.
  await expect(async () => {
    await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
    bounds = await inspectChartGeometry(chart);
    const usesMobileAxisChrome = bounds.chartWidth <= 720;
    expect({
      ready: bounds.ready,
      hasSvg: bounds.hasSvg,
      widthChanged: Math.abs(bounds.chartWidth - previousWidth) > 1,
      responsiveChrome: bounds.mobileAxisTitles === (usesMobileAxisChrome ? 'true' : 'false')
        && bounds.xAxisTitleVisible === (usesMobileAxisChrome ? 'false' : 'true'),
      heightSynced: Math.abs(bounds.actualHeight - bounds.declaredHeight) <= 2,
    }).toEqual({ ready: 'true', hasSvg: true, widthChanged: true, responsiveChrome: true, heightSynced: true });
  }).toPass({ timeout: 10_000 });
  return bounds;''')
print('Responsive tests now wait for the active host without weakening geometry or viewport assertions.')
