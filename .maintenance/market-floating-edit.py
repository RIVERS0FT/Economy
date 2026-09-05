from pathlib import Path
import subprocess

BASE = 'f98ff5850e86f4a8c20177a0f5f011c6739061ab'
subprocess.run(['git', 'cat-file', '-e', BASE + '^{commit}'], check=True)

def replace(path, old, new, count=1):
    file = Path(path)
    text = file.read_text()
    assert text.count(old) == count, (path, old[:120], text.count(old), count)
    file.write_text(text.replace(old, new))

def write(path, text):
    Path(path).write_text(text.lstrip('\n'))

write('src/components/ui/SafeTooltip.tsx', r'''
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type AriaRole,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { hideTopLayerPopover, showTopLayerPopover, supportsTopLayerPopover } from './topLayer';
import { useWorkspaceFloatingLayer, useWorkspaceTooltipLayer } from './WorkspaceFloatingLayer';

const SAFE_FLOATING_GAP = 8;
const PREVIEW_LEAVE_DELAY_MS = 140;
type FloatingPosition = { left: number; top: number; maxWidth: number; maxHeight: number };
type TooltipState = 'closed' | 'preview' | 'pinned';
type TooltipTriggerState = { expanded: boolean; tooltipId: string };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function SafeTooltip({
  content,
  children,
  className = '',
  disabled = false,
  anchorRole,
  anchorTabIndex,
  pinOnClick = false,
}: {
  content: ReactNode;
  children: ReactNode | ((state: TooltipTriggerState) => ReactNode);
  className?: string;
  disabled?: boolean;
  anchorRole?: AriaRole;
  anchorTabIndex?: number;
  pinOnClick?: boolean;
}) {
  const floatingLayer = useWorkspaceFloatingLayer();
  const tooltipLayer = useWorkspaceTooltipLayer();
  const topLayerActive = supportsTopLayerPopover() && Boolean(tooltipLayer);
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<TooltipState>('closed');
  const open = !disabled && state !== 'closed';
  const [position, setPosition] = useState<FloatingPosition>({
    left: SAFE_FLOATING_GAP, top: SAFE_FLOATING_GAP, maxWidth: 320, maxHeight: 240,
  });

  const cancelLeave = useCallback(() => {
    if (leaveTimerRef.current !== null) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = null;
  }, []);
  const close = useCallback(() => {
    cancelLeave();
    setState('closed');
  }, [cancelLeave]);
  const preview = () => {
    cancelLeave();
    if (!disabled) setState((current) => current === 'pinned' ? current : 'preview');
  };
  const leavePreview = () => {
    cancelLeave();
    if (!pinOnClick) { close(); return; }
    // The small delay only bridges the anchor-to-popup gap, never polling resets.
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null;
      setState((current) => current === 'pinned' ? current : 'closed');
    }, PREVIEW_LEAVE_DELAY_MS);
  };
  const isInside = (target: EventTarget | null) => target instanceof Node
    && (anchorRef.current?.contains(target) || tooltipRef.current?.contains(target));

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;
    const layerRect = topLayerActive && tooltipLayer
      ? tooltipLayer.getBoundingClientRect()
      : floatingLayer?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const maxWidth = Math.max(1, layerRect.width - SAFE_FLOATING_GAP * 2);
    const availableBelow = Math.max(1, layerRect.bottom - anchorRect.bottom - SAFE_FLOATING_GAP * 2);
    const availableAbove = Math.max(1, anchorRect.top - layerRect.top - SAFE_FLOATING_GAP * 2);
    const naturalHeight = Math.max(tooltipRect.height, tooltip.scrollHeight);
    const below = naturalHeight <= availableBelow || availableBelow >= availableAbove;
    const maxHeight = pinOnClick
      ? Math.min(Math.max(1, layerRect.height - SAFE_FLOATING_GAP * 2), below ? availableBelow : availableAbove)
      : Math.max(1, layerRect.height - SAFE_FLOATING_GAP * 2);
    const tooltipWidth = Math.min(tooltipRect.width, maxWidth);
    const tooltipHeight = Math.min(naturalHeight, maxHeight);
    const offsetLeft = topLayerActive ? 0 : layerRect.left;
    const offsetTop = topLayerActive ? 0 : layerRect.top;
    const preferBelow = pinOnClick ? below : anchorRect.bottom + SAFE_FLOATING_GAP + tooltipHeight <= layerRect.bottom - SAFE_FLOATING_GAP;
    const next = {
      left: clamp(anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2,
        layerRect.left + SAFE_FLOATING_GAP, layerRect.right - tooltipWidth - SAFE_FLOATING_GAP) - offsetLeft,
      top: clamp(preferBelow ? anchorRect.bottom + SAFE_FLOATING_GAP : anchorRect.top - tooltipHeight - SAFE_FLOATING_GAP,
        layerRect.top + SAFE_FLOATING_GAP, layerRect.bottom - tooltipHeight - SAFE_FLOATING_GAP) - offsetTop,
      maxWidth, maxHeight,
    };
    setPosition((current) => Object.keys(next).every((key) => Math.abs(current[key as keyof FloatingPosition] - next[key as keyof FloatingPosition]) < 0.1) ? current : next);
  }, [floatingLayer, tooltipLayer, topLayerActive, pinOnClick]);

  useLayoutEffect(() => {
    if (!open || !topLayerActive) return undefined;
    const tooltip = tooltipRef.current;
    if (!tooltip) return undefined;
    showTopLayerPopover(tooltip);
    return () => hideTopLayerPopover(tooltip);
  }, [open, topLayerActive, tooltipLayer]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
  }, [open, content, tooltipLayer, updatePosition]);

  useEffect(() => {
    if (disabled) close();
  }, [disabled, close]);
  useEffect(() => cancelLeave, [cancelLeave]);

  useEffect(() => {
    if (!open) return undefined;
    const handleViewportChange = () => updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !anchorRef.current?.contains(target)
        && !(pinOnClick && tooltipRef.current?.contains(target))) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (pinOnClick) {
        event.preventDefault();
        event.stopPropagation();
      }
      close();
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleViewportChange);
    if (tooltipRef.current) observer?.observe(tooltipRef.current);
    if (tooltipLayer) observer?.observe(tooltipLayer);
    window.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);
    document.addEventListener('scroll', handleViewportChange, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      document.removeEventListener('scroll', handleViewportChange, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, pinOnClick, tooltipLayer, close, updatePosition]);

  const tooltipNode = (
    <div
      ref={tooltipRef}
      id={tooltipId}
      className="safe-tooltip ui-tooltip-surface"
      role="tooltip"
      tabIndex={pinOnClick ? 0 : undefined}
      data-interactive={pinOnClick ? 'true' : undefined}
      data-pinned={state === 'pinned' ? 'true' : undefined}
      data-top-layer={topLayerActive ? 'true' : undefined}
      popover={topLayerActive ? 'manual' : undefined}
      onMouseEnter={pinOnClick ? cancelLeave : undefined}
      onMouseLeave={pinOnClick ? leavePreview : undefined}
      onFocus={pinOnClick ? cancelLeave : undefined}
      onBlur={pinOnClick ? (event) => { if (!isInside(event.relatedTarget)) close(); } : undefined}
      style={{
        position: topLayerActive ? 'fixed' : undefined,
        inset: topLayerActive ? 'auto' : undefined,
        margin: topLayerActive ? 0 : undefined,
        zIndex: topLayerActive ? 'auto' : undefined,
        left: `${position.left}px`, top: `${position.top}px`,
        maxWidth: `${position.maxWidth}px`, maxHeight: `${position.maxHeight}px`,
      }}
    >
      {content}
    </div>
  );
  const portalTarget = tooltipLayer ?? floatingLayer ?? (typeof document !== 'undefined' ? document.body : null);
  const tooltip = open && portalTarget ? createPortal(tooltipNode, portalTarget) : null;

  return (
    <>
      <span
        ref={anchorRef}
        className={className ? `safe-tooltip-anchor ${className}` : 'safe-tooltip-anchor'}
        role={anchorRole}
        tabIndex={anchorTabIndex}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={preview}
        onMouseLeave={leavePreview}
        onFocus={preview}
        onBlur={(event) => { if (!pinOnClick || !isInside(event.relatedTarget)) close(); }}
        onClick={pinOnClick ? () => {
          cancelLeave();
          // Focus precedes click on a button. Preview must become pinned, not closed.
          if (!disabled) setState((current) => current === 'pinned' ? 'closed' : 'pinned');
        } : undefined}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' && anchorTabIndex !== undefined) {
            event.currentTarget.focus({ preventScroll: true });
          }
        }}
      >
        {typeof children === 'function' ? children({ expanded: open, tooltipId }) : children}
      </span>
      {tooltip}
    </>
  );
}
''')

p = Path('src/components/market/CommodityFreezeDisclosure.tsx')
s = p.read_text().replace("import { useId, useState } from 'react';\n", '')
start = s.index('/** Shared safe tooltip')
s = s[:start] + r'''/** One shared floating disclosure for pointer, keyboard and touch; never a grid row. */
export function CommodityFreezeDisclosure({ quantity, entries }: { quantity: number; entries?: CommodityFreezeDetail[] }) {
  return <span className="commodity-freeze-disclosure">
    <small>冻结库存</small>
    <SafeTooltip pinOnClick content={<FreezeDetails quantity={quantity} entries={entries} />}>
      {({ expanded, tooltipId }) => <button
        type="button"
        className="commodity-freeze-disclosure__trigger"
        aria-expanded={expanded}
        aria-controls={expanded ? tooltipId : undefined}
        aria-describedby={expanded ? tooltipId : undefined}
        aria-label={`查看冻结库存 ${formatFullNumber(quantity)} 的来源明细`}
      >
        <strong>{formatNumber(quantity)}</strong>
      </button>}
    </SafeTooltip>
  </span>;
}
'''
p.write_text(s)
replace('src/styles/commodity-freezes.css', '.commodity-freeze-disclosure { min-width: 0; }', '''.commodity-freeze-disclosure { min-width: 0; }
.commodity-freeze-disclosure > .safe-tooltip-anchor {
  display: grid; align-items: stretch; line-height: inherit;
}''')
replace('src/styles/commodity-freezes.css', '  display: block; padding: 0; border: 0; background: transparent; color: inherit;', '  display: grid; min-width: 0; min-height: 0; height: auto; margin: 0; padding: 0; border: 0; background: transparent; color: inherit;')
replace('src/styles/commodity-freezes.css', '''.commodity-freeze-disclosure__expanded {
  grid-column: 1 / -1; display: block; margin-block-start: var(--space-3); max-width: 100%; min-width: 0;
  padding-block-start: var(--space-2); border-block-start: 1px solid var(--color-border);
}
''', '')
replace('src/styles/safe-floating.css', '.province-map-static-tooltip[popover] {', '''/* Only opt-in disclosure content accepts input; the shared host remains transparent. */
.safe-tooltip[data-interactive='true'] {
  pointer-events: auto !important;
  overscroll-behavior: contain;
}

@media (max-width: 720px) {
  .workspace-tooltip-layer {
    /* Above the root Sheet; the later Chrome sibling at the same level stays highest. */
    z-index: 3001;
  }
}

.province-map-static-tooltip[popover] {''')
replace('src/styles/viewport.css', '''  .signed-in-shell__body {
    position: relative;
    z-index: 0;
    order: 1;''', '''  .signed-in-shell__body {
    position: relative;
    z-index: auto;
    order: 1;''')
replace('src/styles/viewport.css', '''  .workspace-floating-layer {
    position: absolute;
    z-index: 1;
    order: 2;''', '''  .workspace-floating-layer {
    position: absolute;
    z-index: auto;
    order: 2;''')
replace('src/components/charts/EconomyChart.tsx', "container.closest('.workspace')", "container.closest('.signed-in-shell')")
replace('src/pages/MarketPage.tsx', '<CommodityFreezeDisclosure quantity={selectedInventory.frozen}', '<CommodityFreezeDisclosure key={`${model.selectedProvinceId}:${selectedProduct.id}`} quantity={selectedInventory.frozen}')
replace('src/pages/MarketPage.tsx', '<PriceSparkline buckets={marketBuckets} variant="full" />', '<PriceSparkline key={`${model.selectedProvinceId}:${activeAssetKind}:${assetId}`} buckets={marketBuckets} variant="full" />')

p = Path('src/components/charts/PriceSparkline.tsx')
s = p.read_text()
s = s.replace("import { EconomyChart } from './EconomyChart';", "import { formatCurrency } from '../../utils/formatters';\nimport { EconomyChart } from './EconomyChart';")
s = s.replace("  type: 'dashed' as const,", "  type: [4, 4],")
start = s.index('  const chartInstanceRef = useRef<EChartsType | null>(null);')
end = s.index('  const option = useMemo<EChartsCoreOption>', start)
s = s[:start] + r'''  const chartInstanceRef = useRef<EChartsType | null>(null);
  const pointerInsideRef = useRef(false);
  const pointerRatioRef = useRef<number | null>(null);
  const pointerTypeRef = useRef('mouse');
  const bucketCountRef = useRef(safeBuckets.length);
  const restoreFrameRef = useRef<number | null>(null);
  bucketCountRef.current = safeBuckets.length;

  const hideActiveTooltip = useCallback(() => {
    pointerInsideRef.current = false;
    pointerRatioRef.current = null;
    if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
    restoreFrameRef.current = null;
    const chartInstance = chartInstanceRef.current;
    if (!chartInstance || chartInstance.isDisposed()) return;
    chartInstance.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' });
    chartInstance.dispatchAction({ type: 'hideTip' });
  }, []);

  const scheduleActiveTooltip = useCallback((chartInstance: EChartsType | null = chartInstanceRef.current) => {
    if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
    restoreFrameRef.current = null;
    if (!chartInstance || !pointerInsideRef.current || pointerRatioRef.current === null) return;
    restoreFrameRef.current = requestAnimationFrame(() => {
      restoreFrameRef.current = null;
      if (chartInstance.isDisposed() || !pointerInsideRef.current || pointerRatioRef.current === null) return;
      const dataIndex = Math.min(bucketCountRef.current - 1,
        Math.floor(pointerRatioRef.current * bucketCountRef.current));
      // A single API action selects the daily price point and drives both linked axes.
      // Native mouse/click drivers are disabled to prevent independent resnapping.
      chartInstance.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex });
    });
  }, []);

  const handleChartReady = useCallback((chartInstance: EChartsType) => {
    chartInstanceRef.current = chartInstance;
    scheduleActiveTooltip(chartInstance);
  }, [scheduleActiveTooltip]);

  const restoreActiveTooltip = useCallback((chartInstance: EChartsType) => {
    scheduleActiveTooltip(chartInstance);
  }, [scheduleActiveTooltip]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const insideDataArea = pointerX >= geometry.left
      && pointerX <= geometry.width - geometry.right
      && pointerY >= geometry.top && pointerY <= geometry.volumeBottom;
    if (!insideDataArea) { hideActiveTooltip(); return; }
    pointerInsideRef.current = true;
    pointerTypeRef.current = event.pointerType;
    pointerRatioRef.current = Math.min(1, Math.max(0, (pointerX - geometry.left) / plotWidth));
    scheduleActiveTooltip();
  }, [geometry.left, geometry.right, geometry.top, geometry.volumeBottom, geometry.width, plotWidth, hideActiveTooltip, scheduleActiveTooltip]);

  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    // Touch produces pointerleave on lift; keep the selected day until outside tap or scroll.
    if (event.pointerType === 'mouse') hideActiveTooltip();
  }, [hideActiveTooltip]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) hideActiveTooltip();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !pointerInsideRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      hideActiveTooltip();
    };
    const scroll = (event: Event) => {
      if (pointerTypeRef.current !== 'mouse' && event.target instanceof Node
        && event.target.contains(ref.current)) hideActiveTooltip();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    document.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
      document.removeEventListener('scroll', scroll, true);
      if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
      pointerInsideRef.current = false;
      chartInstanceRef.current = null;
    };
  }, [hideActiveTooltip, ref]);

''' + s[end:]
s = s.replace("axisPointer: { link: [{ xAxisIndex: [0, 1] }] },", "axisPointer: { link: [{ xAxisIndex: [0, 1] }], triggerOn: 'none', animation: false },")
s = s.replace("triggerOn: 'mousemove|click',", "triggerOn: 'none',\n      transitionDuration: 0,\n      hideDelay: 0,")
s = s.replace('formatIntegerPriceTick(bucket.price)', 'formatCurrency(bucket.price)')
needle = 'axisPointer: { show: true, snap: true, label: { show: false }, lineStyle: MARKET_AXIS_POINTER_LINE_STYLE },'
assert s.count(needle) == 2
s = s.replace(needle, 'axisPointer: { show: true, snap: true, animation: false, label: { show: false }, lineStyle: MARKET_AXIS_POINTER_LINE_STYLE },', 1)
s = s.replace(needle, 'axisPointer: { show: true, snap: true, animation: false, label: { show: false }, lineStyle: { ...MARKET_AXIS_POINTER_LINE_STYLE, dashOffset: priceHeight % 8 } },', 1)
s = s.replace('      onPointerMove={handlePointerMove}\n', '      onPointerDown={handlePointerMove}\n      onPointerMove={handlePointerMove}\n      onPointerCancel={hideActiveTooltip}\n')
s = s.replace('      style={{ height: geometry.height }}', "      style={{ height: geometry.height, touchAction: 'pan-y pinch-zoom' }}")
s = s.replace('        onOptionApplied={restoreActiveTooltip}', '        onOptionApplied={restoreActiveTooltip}\n        onResize={restoreActiveTooltip}')
p.write_text(s)

replace('scripts/verify-market-chart.mjs', "'axisPointer: { link: [{ xAxisIndex: [0, 1] }] }',", "\"axisPointer: { link: [{ xAxisIndex: [0, 1] }], triggerOn: 'none', animation: false }\",\n  'onPointerDown={handlePointerMove}', 'onPointerCancel={hideActiveTooltip}',\n  'onResize={restoreActiveTooltip}', 'dashOffset: priceHeight % 8', 'formatCurrency(bucket.price)',")
replace('scripts/verify-market-chart.mjs', "'<PriceSparkline buckets={marketBuckets} variant=\"full\" />'", "'<PriceSparkline key={`${model.selectedProvinceId}:${activeAssetKind}:${assetId}`} buckets={marketBuckets} variant=\"full\" />'")
replace('scripts/verify-notification-center.mjs', r'\.signed-in-shell__body\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*0;', r'\.signed-in-shell__body\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*auto;')
replace('scripts/verify-notification-center.mjs', r'\.workspace-floating-layer\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*1;', r'\.workspace-floating-layer\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*auto;')

replace('docs/UI_DESIGN_SYSTEM.md', '冻结数量复用 `SafeTooltip` 的安全定位、工作区 Portal 与 hover／focus 内核，不建立业务自有全局浮层。移动点击及桌面点击在既有商品详情正文内展开来源列表，不创建第二个 Sheet、backdrop 或滚动根。列表按类型分组，来源名称可换行，数量保持整数右对齐，使用已有间距、边框和字体令牌。总数与明细来自同一玩家资产状态，不显示保障目标和缺口。', '''冻结数量只通过共享 `SafeTooltip` 展示来源明细，复用安全定位、唯一工作区 Tooltip 宿主与视觉材质。桌面 hover／键盘 focus 预览，桌面点击及移动轻点保持同一个浮层打开；再次点击数值、点击外部、焦点移出或 Escape 关闭。首次点击中的 focus 不得把随后 click 误判为关闭；鼠标移入明细及点击明细内部不得关闭，Escape 只关闭当前明细，不继续关闭下层详情。切换地区、商品或关闭详情必须清除旧状态。

冻结明细始终脱离正文布局，禁止恢复正文展开、跨列明细行、预留高度、第二个 Sheet、backdrop 或页面滚动锁。保留商品插画、四项摘要卡、响应式列数及图表／买卖区排列；冻结数值的交互包装只做自然行高与按钮最小高度归一，同排库存标题及数值分别对齐，不用偏移量补齐。打开、关闭及来源刷新前后，摘要卡、插画、图表和交易控件的位置与尺寸必须保持不变。

列表按类型分组，来源名称可换行，数量保持整数右对齐，使用已有间距和字体令牌。总数与明细来自同一玩家资产状态；零冻结显示“暂无冻结”，来源缺失或总和不符显示“冻结来源明细暂不可用”，不显示保障目标和缺口。长明细受安全区域及锚点可用侧空间约束，只在实际浮层内滚动；仅启用点击保持模式的实际浮层允许 pointer-events，透明宿主和普通 Tooltip 仍不拦截事件。浮层随内容、滚动和视口变化重新定位，不能覆盖状态栏或跑出安全边界。浏览器回归必须覆盖真实触摸、125% 字号、长来源和打开前后几何不变。''')
replace('docs/MARKET_CHART_LAYOUT_DESIGN.md', '- 竖向指针必须在零间距双 Grid 中保持同一 x 坐标、样式和虚线节奏，视觉上从价格区连续贯穿成交量区。', '''- 竖向指针必须在零间距双 Grid 中保持同一 x 坐标、样式和虚线节奏，视觉上从价格区连续贯穿成交量区。外层只计算一次所选日桶，以该日价格点驱动联动轴；关闭库原生鼠标／点击触发，禁止与手动 showTip 同时独立吸附。上下指针禁用位移动画，成交量段按价格段长度延续虚线相位。
- 移动轻点绘图区立即选中日期并显示同一个 Tooltip，抬手不能立即隐藏；继续移动更新日期，外部轻点、Escape、原生纵向滚动或 pointercancel 同时清理提示、指针与待执行帧。保留页面原生纵向滚动，不以 preventDefault 阻断滚动。尺寸变化后恢复当前横向比例对应的日期。
- 价格轴保留整数刻度，但 Tooltip 与无障碍摘要使用共享货币格式保留实际金额精度，例如 16.03 不得变成 16。移动 Sheet 内必须验证真实提示节点在 Sheet 内容上方可见，而非只检查 DOM 存在或 opacity。''')
replace('docs/LIQUID_GLASS_CHROME_DESIGN.md', '## 6. 移动与浮层\n', '''## 6. 移动与浮层

- 移动端 ECharts HTML Tooltip 继续挂载在原 `.workspace-floating-layer` 内唯一 `.workspace-tooltip-layer`，不新增 Portal 根、不把宿主或库管理节点改造成 Popover。为避免提示被根 Sheet 遮挡，移动 `.signed-in-shell__body` 与 `.workspace-floating-layer` 的结构容器使用 `z-index:auto`，只让既有 Tooltip 宿主参与 `3001` 层级；根 Dialog 保持 `3000`，后置 DOM 的 Chrome 同为 `3001` 并保持最高。宿主几何及安全裁切不变，pointer-events 始终为 none；仅批准的交互型 SafeTooltip 实际内容节点接收输入。首次初始化图表需从所属 signed-in-shell 找到宿主，兼容图表已 Portal 到根 Sheet、而 Context 回调尚未发布的首帧。移动触摸与实际命中测试必须同时证明提示高于 Sheet、状态栏仍最高和底层控件可用。
''')

replace('tests/browser/market-runtime-harness.tsx', "inventoryFreezeDetails: scenario === 'freeze-details' ?", "inventoryFreezeDetails: scenario === 'freeze-long' ? { wheat: Array.from({ length: 80 }, (_, index) => ({\n        kind: 'contract', sourceId: `long-${index}`, label: `供货合同 ${index} · 跨地区长期原材料采购与供应来源明细`, quantity: index === 0 ? 4 + freezeExtra : 4,\n      })) } : scenario === 'freeze-details' ?")

write('tests/browser/commodity-freeze-details.spec.ts', r'''
import { expect, test, type Page } from '@playwright/test';

const tooltipFor = (page: Page) => page.getByRole('tooltip').filter({ hasText: '冻结明细' });
async function layout(page: Page) {
  return page.evaluate(() => {
    const selectors = ['.market-detail-product-summary', '.market-detail-product-icon-card', '.market-detail-trade-summary', '.market-chart-card', '.market-immediate-trade-card'];
    return selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing layout element: ${selector}`);
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
  });
}
async function expectUnchanged(page: Page, before: Awaited<ReturnType<typeof layout>>) {
  const after = await layout(page);
  for (let index = 0; index < before.length; index += 1) {
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(after[index][key] - before[index][key])).toBeLessThanOrEqual(1);
  }
  await expect(page.locator('.commodity-freeze-disclosure__expanded')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '冻结明细', exact: true })).toHaveCount(0);
}
async function expectAligned(page: Page) {
  const metrics = await page.locator('.market-detail-trade-summary').evaluate((element) => {
    const items = element.querySelectorAll(':scope > span');
    const available = items[2]; const frozen = items[3];
    const top = (item: Element, selector: string) => item.querySelector(selector)!.getBoundingClientRect().top;
    return { titles: Math.abs(top(available, 'small') - top(frozen, 'small')), values: Math.abs(top(available, 'strong') - top(frozen, 'strong')) };
  });
  expect(metrics.titles).toBeLessThanOrEqual(1);
  expect(metrics.values).toBeLessThanOrEqual(1);
}

for (const width of [320, 390, 960]) {
  test(`frozen source tooltip keeps the existing layout at ${width}px`, async ({ page }) => {
    const errors: string[] = []; const writes: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (request.method() === 'POST') writes.push(request.url()); });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('market-runtime-test.html?scenario=freeze-details');
    const trigger = page.getByRole('button', { name: '查看冻结库存 320 的来源明细' });
    await expect(page.locator('.market-history-chart .economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
    await trigger.scrollIntoViewIfNeeded();
    await expectAligned(page);
    const before = await layout(page);
    const preview = tooltipFor(page);
    await trigger.hover();
    await expect(preview).toBeVisible();
    for (const text of ['生产冻结', '经营冻结', '合同冻结', '拍卖冻结', '磨坊', '120', '饲料厂', '80', 'supply-123', '70']) await expect(preview).toContainText(text);
    await expectUnchanged(page, before);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(preview).toHaveAttribute('data-pinned', 'true');
    await preview.hover();
    await expect(preview).toBeVisible();
    await expect(preview).not.toContainText('保障目标');
    await expect(preview).not.toContainText('缺口');
    await page.evaluate(() => window.__updateFreezeFixture?.());
    await expect(preview).toContainText('325');
    await expect(preview).toContainText('125');
    await expectUnchanged(page, before);
    const bounds = await preview.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await expect(preview).toContainText('冻结商品只供对应业务使用');
    await page.keyboard.press('Escape');
    await expect(preview).toHaveCount(0);
    await expectUnchanged(page, before);
    if (width <= 720) await expect(page.locator('[data-mobile-workspace-sheet-host="true"]')).toBeVisible();
    const updatedTrigger = page.getByRole('button', { name: '查看冻结库存 325 的来源明细' });
    await updatedTrigger.click();
    await expect(preview).toBeVisible();
    await updatedTrigger.click();
    await expect(preview).toHaveCount(0);
    expect(errors).toEqual([]); expect(writes).toEqual([]);
    await page.screenshot({ path: `test-results/commodity-freezes-${width}.png`, fullPage: false });
  });
}

test.describe('real touch frozen disclosures', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const width of [320, 390]) {
    test(`tap, long content and enlarged text remain floating at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('market-runtime-test.html?scenario=freeze-long');
      await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; window.dispatchEvent(new Event('resize')); });
      const trigger = page.getByRole('button', { name: '查看冻结库存 320 的来源明细' });
      await trigger.scrollIntoViewIfNeeded();
      await expectAligned(page);
      const before = await layout(page);
      await trigger.tap();
      const preview = tooltipFor(page);
      await expect(preview).toHaveAttribute('data-pinned', 'true');
      await expectUnchanged(page, before);
      const dimensions = await preview.evaluate((element) => ({ scroll: element.scrollHeight, height: element.clientHeight, hostEvents: getComputedStyle(element.parentElement!).pointerEvents }));
      expect(dimensions.scroll).toBeGreaterThan(dimensions.height);
      expect(dimensions.hostEvents).toBe('none');
      await preview.tap();
      await expect(preview).toBeVisible();
      await preview.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect.poll(() => preview.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expectUnchanged(page, before);
      await trigger.tap();
      await expect(preview).toHaveCount(0);
      await trigger.tap();
      await expect(preview).toBeVisible();
      await page.locator('.market-detail-product-icon-card').tap();
      await expect(preview).toHaveCount(0);
      await expectUnchanged(page, before);
    });
  }
});

test('unknown or zero frozen state never invents a source or a shortage target', async ({ page }) => {
  await page.goto('market-runtime-test.html?scenario=freeze-unknown');
  await page.getByRole('button', { name: '查看冻结库存 320 的来源明细' }).click();
  await expect(tooltipFor(page)).toContainText('冻结来源明细暂不可用');
  await expect(tooltipFor(page)).not.toContainText('生产冻结');
  await page.goto('market-runtime-test.html');
  await page.getByRole('button', { name: '查看冻结库存 0 的来源明细' }).click();
  await expect(tooltipFor(page)).toContainText('暂无冻结');
});
''')

write('tests/browser/market-chart-pointer.spec.ts', r'''
import { expect, test, type Locator, type Page } from '@playwright/test';

async function point(chart: Locator, ratio: number, volume = false) {
  return chart.evaluate((element, args) => {
    const el = element as HTMLElement; const r = el.getBoundingClientRect();
    const read = (key: string) => Number(el.dataset[key]);
    return { x: r.x + read('axisLeft') + (r.width - read('axisLeft') - read('axisRight')) * args.ratio,
      y: r.y + (args.volume ? (read('volumeTop') + read('volumeBottom')) / 2 : (read('priceTop') + read('priceBottom')) / 2) };
  }, { ratio, volume });
}
async function pointerLines(chart: Locator) {
  return chart.locator('svg [stroke-dasharray]').evaluateAll((elements) => elements.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, offset: Number(el.getAttribute('stroke-dashoffset') || 0) };
  }).filter((r) => r.width <= 2 && r.height >= 40).sort((a, b) => a.y - b.y));
}
async function expectPointers(chart: Locator) {
  await expect.poll(async () => (await pointerLines(chart)).length).toBe(2);
  const lines = await pointerLines(chart);
  expect(Math.abs(lines[0].x - lines[1].x)).toBeLessThanOrEqual(1);
  expect(Math.abs(lines[0].y + lines[0].height - lines[1].y)).toBeLessThanOrEqual(1);
}
async function expectForegroundTooltip(page: Page) {
  const tooltip = page.locator('.economy-chart-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveCount(1);
  const geometry = await tooltip.evaluate((element) => {
    const el = element as HTMLElement; const r = el.getBoundingClientRect();
    const host = el.parentElement!; const safe = host.getBoundingClientRect();
    // The normal tooltip intentionally ignores hit-testing. Temporarily probe only its
    // actual node, never the host, to detect a tooltip painted underneath the Sheet.
    const previous = el.style.getPropertyValue('pointer-events');
    const priority = el.style.getPropertyPriority('pointer-events');
    el.style.setProperty('pointer-events', 'auto', 'important');
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(r.height / 2, 20));
    const inFront = hit === el || el.contains(hit);
    if (previous) el.style.setProperty('pointer-events', previous, priority); else el.style.removeProperty('pointer-events');
    const status = document.querySelector('.asset-bar')!.getBoundingClientRect();
    return { inFront, host: host.dataset.workspaceTooltipLayer, hostEvents: getComputedStyle(host).pointerEvents,
      top: r.top, bottom: r.bottom, left: r.left, right: r.right, safeTop: safe.top, safeBottom: safe.bottom,
      statusBottom: status.bottom, viewportWidth: window.innerWidth };
  });
  expect(geometry.inFront).toBe(true);
  expect(geometry.host).toBe('true');
  expect(geometry.hostEvents).toBe('none');
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.statusBottom);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
}

for (const width of [320, 390, 960]) {
  test(`linked daily pointers and foreground tooltip at ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('market-runtime-test.html?scenario=active');
    const chart = page.locator('.market-history-chart.full');
    await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
    await chart.scrollIntoViewIfNeeded();
    for (const ratio of [0.03, 0.502, 0.97]) {
      const upper = await point(chart, ratio); await page.mouse.move(upper.x, upper.y);
      await expectForegroundTooltip(page); await expectPointers(chart);
      const date = await page.locator('.economy-chart-tooltip strong').innerText();
      const lower = await point(chart, ratio, true); await page.mouse.move(lower.x, lower.y);
      await expectPointers(chart);
      await expect(page.locator('.economy-chart-tooltip strong')).toHaveText(date);
    }
    await page.mouse.move(4, 4);
    await expect(page.locator('.economy-chart-tooltip')).toBeHidden();
    await expect.poll(async () => (await pointerLines(chart)).length).toBe(0);
    expect(errors).toEqual([]);
  });
}

test.describe('touch market tooltip inside the actual mobile Sheet', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 1000 } });
  test('first tap persists across a refresh and closes both pointers on outside tap or Escape', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=freeze-details');
    const chart = page.locator('.market-history-chart.full');
    const sheet = page.locator('[data-mobile-workspace-sheet-host="true"]');
    await expect(sheet).toBeVisible();
    await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
    await chart.scrollIntoViewIfNeeded();
    const selected = await point(chart, 0.502);
    await page.touchscreen.tap(selected.x, selected.y);
    await expectForegroundTooltip(page); await expectPointers(chart);
    const text = await page.locator('.economy-chart-tooltip').innerText();
    await page.evaluate(() => window.__updateFreezeFixture?.());
    await page.waitForTimeout(6_500);
    await expect(page.locator('.economy-chart-tooltip')).toHaveText(text);
    await expectPointers(chart);
    await page.keyboard.press('Escape');
    await expect(page.locator('.economy-chart-tooltip')).toBeHidden();
    await expect(sheet).toBeVisible();
    await expect.poll(async () => (await pointerLines(chart)).length).toBe(0);
    await page.touchscreen.tap(selected.x, selected.y);
    await expectForegroundTooltip(page);
    await page.locator('.market-detail-product-icon-card').tap();
    await expect(page.locator('.economy-chart-tooltip')).toBeHidden();
    await expect.poll(async () => (await pointerLines(chart)).length).toBe(0);
  });
});
''')

for p in ['src/components/market/CommodityFreezeDisclosure.tsx', 'src/styles/commodity-freezes.css']:
    assert 'commodity-freeze-disclosure__expanded' not in Path(p).read_text()
print('Reviewed market floating edits applied; normal PR CI remains the validation gate.')
