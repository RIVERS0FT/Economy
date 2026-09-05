"""Bounded branch-only edits. This helper is removed before final PR validation."""
from pathlib import Path

changes = {}
def replace(path, old, new):
    content = changes.get(path, Path(path).read_text())
    if new in content and old not in content:
        return
    if content.count(old) != 1:
        raise RuntimeError(f'{path}: expected one replacement for {old[:100]!r}')
    changes[path] = content.replace(old, new, 1)

path = 'scripts/verify-market-chart.mjs'
replace(path, "  'axisPointer: { link: [{ xAxisIndex: [0, 1] }] }',",
        '''  "axisPointer: { triggerOn: 'none', animation: false, link: [{ xAxisIndex: [0, 1] }] }",
  'dashOffset: volumeHeight % 8', 'type: [4, 4]',
  'onPointerDown={handlePointerMove}', 'onPointerCancel={hideActiveTooltip}',
  'onResize={restoreActiveTooltip}', 'formatCurrency(bucket.price)',
  "type: 'updateAxisPointer', currTrigger: 'leave'",''')
replace(path, "'<PriceSparkline buckets={marketBuckets} variant=\"full\" />'", "'<PriceSparkline key={detailInteractionKey} buckets={marketBuckets} variant=\"full\" />'")
replace(path, "'主动驱动同一分段的 Tooltip'", "'行情外层 Pointer 事件是唯一主动触发入口'")
replace(path, "'Option 应用后恢复'", "'Option 应用／resize 后'")

path = 'src/components/charts/PriceSparkline.tsx'
replace(path, "    document.addEventListener('pointerdown', outside, true);",
        "    const focusOutside = (event: FocusEvent) => {\n      if (event.target instanceof Node && !ref.current?.contains(event.target)) hideActiveTooltip();\n    };\n    document.addEventListener('focusin', focusOutside, true);\n    document.addEventListener('pointerdown', outside, true);")
replace(path, "      document.removeEventListener('pointerdown', outside, true);",
        "      document.removeEventListener('focusin', focusOutside, true);\n      document.removeEventListener('pointerdown', outside, true);")
path = 'docs/MARKET_CHART_LAYOUT_DESIGN.md'
replace(path, '点击外部、Escape、商品／地区／玩家／存档上下文切换', '点击外部、焦点移至图表外部、Escape、商品／地区／玩家／存档上下文切换')
path = 'tests/browser/commodity-freeze-details.spec.ts'
replace(path, "  await page.goto('/market-runtime-test.html?scenario=freeze-long');\n  await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; });",
        "  await page.goto('/market-runtime-test.html?scenario=freeze-long');\n  await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; });\n  await page.evaluate(() => document.fonts.ready);\n  await expect(page.locator('.market-history-echart')).toHaveAttribute('data-echarts-ready', 'true');\n  await expect(page.getByText('正在加载当前市场行情…')).toHaveCount(0);")
for path, content in changes.items():
    Path(path).write_text(content)
print('Prepared:', ', '.join(sorted(changes)) or 'already applied')
