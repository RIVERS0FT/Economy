"""Bounded branch-only source edits. Removed before final PR validation."""
from pathlib import Path
changes = {}
def replace(path, old, new):
    source = changes.get(path, Path(path).read_text())
    if new in source:
        return
    if source.count(old) != 1:
        raise RuntimeError(f'{path}: expected one replacement for {old[:100]!r}')
    changes[path] = source.replace(old, new, 1)

path = 'src/components/charts/PriceSparkline.tsx'
replace(path, "{ id: 'market-price-grid', left:", "{ id: 'market-price-grid', outerBoundsMode: 'none', left:")
replace(path, "{ id: 'market-volume-grid', left:", "{ id: 'market-volume-grid', outerBoundsMode: 'none', left:")
for index, name in [(0, 'price'), (1, 'volume')]:
    replace(path, f"id: 'market-{name}-time-axis', type: 'value', gridIndex: {index}, min:",
            f"id: 'market-{name}-time-axis', type: 'value', gridIndex: {index}, containShape: false, boundaryGap: [0, 0], min:")
replace(path, "      chartInstance.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex });",
        """      const axisIndex = pointerY >= current.geometry.volumeTop ? 1 : 0;
      const top = axisIndex === 0 ? current.geometry.top : current.geometry.volumeTop;
      const bottom = axisIndex === 0 ? current.geometry.priceBottom : current.geometry.volumeBottom;
      // Trigger inside the hovered Grid rather than at the series' y-value: a
      // price at the min/max boundary must not hide the tooltip after refresh.
      chartInstance.dispatchAction({
        type: 'updateAxisPointer',
        x: Number(chartInstance.convertToPixel({ xAxisIndex: axisIndex }, axisValue)),
        y: Math.max(top + 1, Math.min(bottom - 1, pointerY)),
        axesInfo: [{ axisDim: 'x', axisIndex, value: axisValue }],
      });""")
path = 'scripts/verify-market-chart.mjs'
replace(path, "  \"type: 'showTip'\",", "  \"type: 'updateAxisPointer'\",\n  \"outerBoundsMode: 'none'\", 'containShape: false, boundaryGap: [0, 0]',\n  \"axesInfo: [{ axisDim: 'x', axisIndex, value: axisValue }]\",")
path = 'docs/MARKET_CHART_LAYOUT_DESIGN.md'
replace(path, '真实上下指针横坐标误差不得超过 1 个 CSS 像素。',
        '真实上下指针横坐标误差不得超过 1 个 CSS 像素。两组 X 轴必须关闭独立形状留白（`containShape: false`、`boundaryGap: [0, 0]`），双 Grid 使用 `outerBoundsMode: none` 遵守已计算的共享边界，避免库自动留白或各自避让重新改变像素映射；轴标签空间仍由现有统一几何计算负责。')
replace(path, '再在一帧内驱动该日中心对应的 Tooltip 与联动 AxisPointer；',
        '再在一帧内用 `updateAxisPointer` 驱动该日中心对应的 Tooltip 与联动 AxisPointer；传入共享日期和当前绘图区内部坐标，不依赖价格点的 Y 值，避免真实价格恰在纵轴边界时刷新后提示消失；')
path = 'tests/browser/market-pointer-interaction.spec.ts'
replace(path, '      painted,\n      safe:',
        """      painted,
      diagnostic: {
        tooltip: { x: box.x, y: box.y, width: box.width, height: box.height, css: element.style.cssText },
        safe: { x: safe.x, y: safe.y, width: safe.width, height: safe.height },
        viewport: { width: innerWidth, height: innerHeight },
        front: front?.outerHTML.slice(0, 500),
        parents: [host, host.parentElement, host.parentElement?.parentElement].filter(Boolean).map((node) => ({
          className: node!.className, z: getComputedStyle(node!).zIndex,
          position: getComputedStyle(node!).position, transform: getComputedStyle(node!).transform,
          inert: (node as HTMLElement).inert,
        })),
      },
      safe:""")
replace(path, '  expect(result.painted).toBe(true);', '  expect(result.painted, JSON.stringify(result.diagnostic)).toBe(true);')
path = 'src/components/ui/SafeTooltip.tsx'
replace(path, '    const maxHeight = Math.max(1, layerRect.height - SAFE_FLOATING_GAP * 2);',
        """    const belowSpace = Math.max(0, layerRect.bottom - anchorRect.bottom - SAFE_FLOATING_GAP * 2);
    const aboveSpace = Math.max(0, anchorRect.top - layerRect.top - SAFE_FLOATING_GAP * 2);
    const maxHeight = Math.max(1, Math.min(layerRect.height - SAFE_FLOATING_GAP * 2,
      interactive ? Math.max(belowSpace, aboveSpace) : Infinity));""")
replace(path, '  }, [floatingLayer, tooltipLayer, topLayerActive]);', '  }, [floatingLayer, tooltipLayer, topLayerActive, interactive]);')
path = 'docs/UI_DESIGN_SYSTEM.md'
replace(path, '长明细必须在安全区内翻转、收敛并只滚动浮层内容；',
        '长明细必须在安全区内翻转、收敛并只滚动浮层内容，最大高度以锚点上／下可用空间为限，不遮住再次点击关闭的冻结数值；')
path = 'tests/browser/commodity-freeze-details.spec.ts'
replace(path, "  await expect(tooltip).toHaveAttribute('data-pinned', 'true');\n});\n\nfor (const [scenario, text]",
        "  await expect(tooltip).toHaveAttribute('data-pinned', 'true');\n  await trigger.click();\n  await expect(tooltip).toHaveCount(0);\n  await expectGeometry(page, before);\n});\n\nfor (const [scenario, text]")
for path, source in changes.items():
    Path(path).write_text(source)
print('Prepared:', ', '.join(sorted(changes)) or 'already applied')
