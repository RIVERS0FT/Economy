from pathlib import Path

def replace(path, old, new, count=1):
    p=Path(path);s=p.read_text();assert s.count(old)==count,(path,old[:90],s.count(old));p.write_text(s.replace(old,new))
replace('tests/browser/market-runtime-harness.tsx', "import '../../src/styles/strategic-game-shell.css';", "import '../../src/styles/strategic-game-shell.css';\nimport '../../src/styles/market-detail-direct-flow.css';")
replace('src/styles/strategic-game-shell.css', '.game-shell .workspace-floating-layer {\n  z-index: 4;\n}', '@media (min-width: 721px) {\n  .game-shell .workspace-floating-layer {\n    z-index: 4;\n  }\n}')
replace('src/components/charts/EconomyChart.tsx', "  updateMode = 'replace',\n", "  updateMode = 'replace',\n  lazyUpdate = true,\n")
replace('src/components/charts/EconomyChart.tsx', '  updateMode?: EconomyChartUpdateMode;\n', '  updateMode?: EconomyChartUpdateMode;\n  lazyUpdate?: boolean;\n')
replace('src/components/charts/EconomyChart.tsx', 'applyChartOption(chart, container, option, updateMode, true, tooltipLayer);', 'applyChartOption(chart, container, option, updateMode, lazyUpdate, tooltipLayer);')
replace('src/components/charts/EconomyChart.tsx', '  }, [option, tooltipLayer, updateMode]);', '  }, [option, tooltipLayer, updateMode, lazyUpdate]);')
replace('src/components/charts/PriceSparkline.tsx', '  bucketCountRef.current = safeBuckets.length;', '  const interactionGeometryRef = useRef({ windowStart, top: geometry.top, priceBottom: geometry.priceBottom });\n  bucketCountRef.current = safeBuckets.length;\n  interactionGeometryRef.current = { windowStart, top: geometry.top, priceBottom: geometry.priceBottom };')
replace('src/components/charts/PriceSparkline.tsx', '''      // A single API action selects the daily price point and drives both linked axes.
      // Native mouse/click drivers are disabled to prevent independent resnapping.
      chartInstance.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex });''', '''      const metrics = interactionGeometryRef.current;
      const value = metrics.windowStart + (dataIndex + 0.5) * MARKET_BUCKET_MS;
      const x = Number(chartInstance.convertToPixel({ xAxisIndex: 0 }, value));
      if (!Number.isFinite(x)) return;
      // Trigger only the price axis from its interior, even when the price point lies
      // on the shared boundary. ECharts links the volume pointer and one HTML tooltip.
      chartInstance.dispatchAction({
        type: 'updateAxisPointer', x, y: (metrics.top + metrics.priceBottom) / 2,
        axesInfo: [{ axisDim: 'x', axisIndex: 0, value }],
      });''')
replace('src/components/charts/PriceSparkline.tsx', "{ id: 'market-price-grid', left:", "{ id: 'market-price-grid', outerBoundsMode: 'none', left:")
replace('src/components/charts/PriceSparkline.tsx', "{ id: 'market-volume-grid', left:", "{ id: 'market-volume-grid', outerBoundsMode: 'none', left:")
replace('src/components/charts/PriceSparkline.tsx', "type: 'value', gridIndex: 0, min: windowStart", "type: 'value', containShape: false, gridIndex: 0, min: windowStart")
replace('src/components/charts/PriceSparkline.tsx', "type: 'value', gridIndex: 1, min: windowStart", "type: 'value', containShape: false, gridIndex: 1, min: windowStart")
replace('src/components/charts/PriceSparkline.tsx', 'dashOffset: priceHeight % 8', 'dashOffset: -volumeHeight % 8')
replace('src/components/charts/PriceSparkline.tsx', '        option={option}\n', '        option={option}\n        lazyUpdate={false}\n')
replace('scripts/verify-market-chart.mjs', "'dashOffset: priceHeight % 8'", "'dashOffset: -volumeHeight % 8', 'containShape: false', \"outerBoundsMode: 'none'\", 'lazyUpdate={false}'")
replace('scripts/verify-market-chart.mjs', '"type: \'showTip\'", "type: \'hideTip\'",', '"type: \'updateAxisPointer\'", "axesInfo: [{ axisDim: \'x\', axisIndex: 0, value }]", "type: \'hideTip\'",')
replace('docs/MARKET_CHART_LAYOUT_DESIGN.md', '外层只计算一次所选日桶，以该日价格点驱动联动轴；关闭库原生鼠标／点击触发，禁止与手动 showTip 同时独立吸附。上下指针禁用位移动画，成交量段按价格段长度延续虚线相位。', '外层只计算一次所选日桶，以该日中心轴值和价格图区内部点驱动价格轴，再由联动更新成交量轴与唯一 Tooltip；即使价格点落在共享边界，也不能让两轴分别选择输入。关闭库原生鼠标／点击触发，禁止重复吸附。两条时间轴均关闭 `containShape`，防止柱形自动扩大映射范围；两个 Grid 均关闭 `outerBoundsMode` 自动重排，遵守组件已经计算的共同几何。上下指针禁用位移动画；ECharts 竖线按从下到上绘制，成交量段按自身长度的负相位与价格段接续，不能按价格段长度套用从上到下的相位。')
replace('docs/MARKET_CHART_LAYOUT_DESIGN.md', '尺寸变化后恢复当前横向比例对应的日期。', '尺寸变化后恢复当前横向比例对应的日期。市场 Option 使用共享 `EconomyChart` 的同步更新模式，在新坐标与数据完成应用后恢复当前日期；普通共享图表保持原来的延迟更新默认值。')
replace('docs/LIQUID_GLASS_CHROME_DESIGN.md', '移动 `.signed-in-shell__body` 与 `.workspace-floating-layer` 的结构容器使用 `z-index:auto`', '移动 `.signed-in-shell__body` 与 `.workspace-floating-layer` 的结构容器使用 `z-index:auto`，游戏专属浮层的 `z-index:4` 只在桌面生效，不能以更高选择器权重重新制造移动层叠上下文')
replace('tests/browser/market-tooltip-persistence-harness.tsx', '    const price = active ? 12 + dataRevision : 12;', "    const price = (active ? 12 + dataRevision : 12)\n      + (new URLSearchParams(window.location.search).get('scenario') === 'decimal' ? 4.03 : 0);")
replace('tests/browser/market-chart-pointer.spec.ts', "    return { x: r.x, y: r.y, width: r.width, height: r.height, offset: Number(el.getAttribute('stroke-dashoffset') || 0) };", "    const path = el as SVGGeometryElement;\n    return { x: r.x, y: r.y, width: r.width, height: r.height, offset: Number(el.getAttribute('stroke-dashoffset') || 0), length: path.getTotalLength(), startY: path.getPointAtLength(0).y, endY: path.getPointAtLength(path.getTotalLength()).y };")
replace('tests/browser/market-chart-pointer.spec.ts', '  expect(Math.abs(lines[0].y + lines[0].height - lines[1].y)).toBeLessThanOrEqual(1);', '''  expect(Math.abs(lines[0].y + lines[0].height - lines[1].y)).toBeLessThanOrEqual(1);
  // ECharts emits both vertical paths bottom-to-top. Compare the actual phases at
  // the shared boundary, not just line styles or the two option strings.
  expect(lines[0].startY).toBeGreaterThan(lines[0].endY);
  expect(lines[1].startY).toBeGreaterThan(lines[1].endY);
  const phaseDelta = lines[1].length + lines[1].offset - lines[0].offset;
  expect(Math.abs(phaseDelta - Math.round(phaseDelta / 8) * 8)).toBeLessThanOrEqual(1);''')
replace('tests/browser/market-chart-pointer.spec.ts', '  expect(geometry.inFront).toBe(true);', '  expect(geometry.inFront, JSON.stringify(geometry)).toBe(true);')
p=Path('tests/browser/market-chart-pointer.spec.ts')
p.write_text(p.read_text()+r'''

test('integer price ticks never round away the tooltip currency precision', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await page.goto('market-tooltip-persistence-test.html?scenario=decimal');
  const chart = page.locator('.market-history-chart.full');
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
  const selected = await point(chart, 0.502);
  await page.mouse.move(selected.x, selected.y);
  const tooltip = page.locator('.economy-chart-tooltip');
  await expect(tooltip).toContainText('16.03');
  await expectPointers(chart);
  await page.evaluate(() => window.__advanceMarketTooltipData?.());
  await expect(tooltip).toContainText('17.03');
  await expectPointers(chart);
  await page.screenshot({ path: 'test-results/market-tooltip-decimal.png' });
});

test.describe('native chart touch scrolling', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('a vertical swipe scrolls the existing Sheet and clears both pointers', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=active');
    const chart = page.locator('.market-history-chart.full');
    await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
    await chart.scrollIntoViewIfNeeded();
    const scroll = page.locator('.mobile-detail-sheet-scroll');
    const before = await scroll.evaluate((element) => element.scrollTop);
    const selected = await point(chart, 0.502, true);
    await page.touchscreen.tap(selected.x, selected.y);
    await expectForegroundTooltip(page);
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: selected.x, y: selected.y }] });
    for (let distance = 20; distance <= 140; distance += 20) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: selected.x, y: selected.y - distance }] });
      await page.waitForTimeout(16);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
    await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(before + 10);
    await expect(page.locator('.economy-chart-tooltip')).toBeHidden();
    await expect.poll(async () => (await pointerLines(chart)).length).toBe(0);
    await expect(page.locator('[data-mobile-workspace-sheet-host="true"]')).toBeVisible();
  });
});
''')
print('Applied evidence-driven chart mapping, paint order, synchronous restoration and real-layout fixture fixes.')
