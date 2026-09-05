import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useWorkspaceTooltipLayer } from '../ui/WorkspaceFloatingLayer';
import { initECharts, type EChartsCoreOption, type EChartsType } from './echartsCore';
import { resolveEChartsCssColors } from './resolveEChartsCssColors';

let nextChartInstanceId = 1;

export type EconomyChartUpdateMode = 'replace' | 'merge';

export interface EconomyChartClickEvent {
  componentType?: string;
  seriesType?: string;
  name?: string;
  data?: unknown;
}

export interface EconomyChartDoubleClickEvent {
  target?: unknown;
  topTarget?: unknown;
  event?: {
    pointerType?: string;
    type?: string;
    timeStamp?: number;
  };
}

export interface EconomyChartCanvasClickEvent {
  target?: unknown;
  topTarget?: unknown;
  offsetX?: number;
  offsetY?: number;
  event?: {
    pointerType?: string;
    type?: string;
    timeStamp?: number;
  };
}

export interface EconomyChartSize {
  width: number;
  height: number;
}

function optionWithTooltipLayer(option: EChartsCoreOption, tooltipLayer: HTMLElement | null, container: HTMLElement) {
  if (!tooltipLayer || !option || typeof option !== 'object' || Array.isArray(option)) return option;
  const source = option as unknown as Record<string, unknown>;
  const tooltip = source.tooltip;
  if (!tooltip || typeof tooltip !== 'object' || Array.isArray(tooltip)) return option;
  const next = { ...source };
  const tooltipOption = tooltip as Record<string, unknown>;
  next.tooltip = {
    ...tooltipOption,
    appendTo: tooltipLayer,
    appendToBody: false,
    position: tooltipOption.position ?? ((point: number[], _params: unknown, node: HTMLElement, _rect: unknown,
      size: { contentSize: number[] }) => {
      const safe = tooltipLayer.getBoundingClientRect();
      const chart = container.getBoundingClientRect();
      const maxWidth = Math.max(1, Math.min(chart.width, safe.width) - 16);
      const maxHeight = Math.max(1, Math.min(chart.height, safe.height) - 16);
      node.style.maxWidth = `${maxWidth}px`;
      node.style.maxHeight = `${maxHeight}px`;
      node.style.overflow = 'auto';
      const width = Math.min(size.contentSize[0], maxWidth);
      const height = Math.min(size.contentSize[1], maxHeight);
      const left = Math.max(8, safe.left - chart.left + 8);
      const top = Math.max(8, safe.top - chart.top + 8);
      const right = Math.min(chart.width, safe.right - chart.left) - width - 8;
      const bottom = Math.min(chart.height, safe.bottom - chart.top) - height - 8;
      return [
        Math.max(left, Math.min(point[0] + 12, Math.max(left, right))),
        Math.max(top, Math.min(point[1] + 12, Math.max(top, bottom))),
      ];
    }),
  };
  return next as unknown as EChartsCoreOption;
}

function applyChartOption(
  chart: EChartsType,
  container: HTMLElement,
  option: EChartsCoreOption,
  updateMode: EconomyChartUpdateMode,
  lazyUpdate: boolean,
  tooltipLayer: HTMLElement | null,
) {
  const resolvedOption = resolveEChartsCssColors(option, container);
  // Callback refs publish the shared host one render after its DOM exists.
  // Recover it before the first setOption fixes the library-owned tooltip parent,
  // including charts rendered through the existing mobile dialog Portal.
  if (!tooltipLayer?.isConnected) {
    tooltipLayer = container.closest('.signed-in-shell')
      ?.querySelector<HTMLElement>('[data-workspace-tooltip-layer="true"]') ?? null;
  }
  chart.setOption(optionWithTooltipLayer(resolvedOption, tooltipLayer, container), {
    notMerge: updateMode !== 'merge',
    lazyUpdate,
  });
  container.dataset.echartsCssColorsResolved = 'true';
  container.dataset.echartsTooltipLayer = tooltipLayer ? 'workspace' : 'local';
}

function hasRenderableSize(container: HTMLElement) {
  return container.clientWidth > 0 && container.clientHeight > 0;
}

export function EconomyChart({
  option,
  ariaLabel,
  accessibleSummary = ariaLabel,
  className,
  style,
  testId,
  updateMode = 'replace',
  onChartReady,
  onOptionApplied,
  onResize,
  onClick,
  onCanvasClick,
  onDoubleClick,
}: {
  option: EChartsCoreOption;
  ariaLabel: string;
  accessibleSummary?: string;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  updateMode?: EconomyChartUpdateMode;
  onChartReady?: (chart: EChartsType) => void;
  onOptionApplied?: (chart: EChartsType) => void;
  onResize?: (chart: EChartsType, size: EconomyChartSize) => void;
  onClick?: (event: EconomyChartClickEvent) => void;
  onCanvasClick?: (event: EconomyChartCanvasClickEvent, chart: EChartsType) => void;
  onDoubleClick?: (event: EconomyChartDoubleClickEvent, chart: EChartsType) => void;
}) {
  const tooltipLayer = useWorkspaceTooltipLayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef(option);
  const tooltipLayerRef = useRef(tooltipLayer);
  const resizeFrameRef = useRef<number | null>(null);
  const optionAppliedRef = useRef(false);
  const chartReadyRef = useRef(false);
  const updateModeRef = useRef(updateMode);
  const onChartReadyRef = useRef(onChartReady);
  const onOptionAppliedRef = useRef(onOptionApplied);
  const onResizeRef = useRef(onResize);
  const onClickRef = useRef(onClick);
  const onCanvasClickRef = useRef(onCanvasClick);
  const onDoubleClickRef = useRef(onDoubleClick);
  const [ready, setReady] = useState(false);

  updateModeRef.current = updateMode;
  tooltipLayerRef.current = tooltipLayer;
  onChartReadyRef.current = onChartReady;
  onOptionAppliedRef.current = onOptionApplied;
  onResizeRef.current = onResize;
  onClickRef.current = onClick;
  onCanvasClickRef.current = onCanvasClick;
  onDoubleClickRef.current = onDoubleClick;

  useLayoutEffect(() => {
    optionRef.current = option;
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container || !hasRenderableSize(container)) return;
    applyChartOption(chart, container, option, updateMode, true, tooltipLayer);
    optionAppliedRef.current = true;
    if (!chartReadyRef.current) {
      chartReadyRef.current = true;
      setReady(true);
      onChartReadyRef.current?.(chart);
    }
    onOptionAppliedRef.current?.(chart);
  }, [option, tooltipLayer, updateMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const chart = initECharts(container, undefined, {
      renderer: 'svg',
      useDirtyRect: false,
    });
    const instanceId = nextChartInstanceId;
    nextChartInstanceId += 1;
    container.dataset.echartsInstanceId = String(instanceId);
    chartRef.current = chart;
    optionAppliedRef.current = false;
    chartReadyRef.current = false;
    setReady(false);
    const handleClick = (event: unknown) => {
      onClickRef.current?.(event as EconomyChartClickEvent);
    };
    const handleCanvasClick = (event: unknown) => {
      onCanvasClickRef.current?.(event as EconomyChartCanvasClickEvent, chart);
    };
    const handleDoubleClick = (event: unknown) => {
      onDoubleClickRef.current?.(event as EconomyChartDoubleClickEvent, chart);
    };
    chart.on('click', handleClick);
    chart.getZr().on('click', handleCanvasClick);
    chart.getZr().on('dblclick', handleDoubleClick);
    const applyCurrentOption = () => {
      if (!hasRenderableSize(container)) return false;
      applyChartOption(
        chart,
        container,
        optionRef.current,
        updateModeRef.current,
        false,
        tooltipLayerRef.current,
      );
      optionAppliedRef.current = true;
      if (!chartReadyRef.current) {
        chartReadyRef.current = true;
        setReady(true);
        onChartReadyRef.current?.(chart);
      }
      onOptionAppliedRef.current?.(chart);
      return true;
    };

    const scheduleResize = () => {
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        if (!hasRenderableSize(container)) return;
        chart.resize();
        onResizeRef.current?.(chart, {
          width: container.clientWidth,
          height: container.clientHeight,
        });
        if (!optionAppliedRef.current) applyCurrentOption();
      });
    };

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleResize);
    observer?.observe(container);
    window.addEventListener('resize', scheduleResize);
    void document.fonts?.ready.then(scheduleResize);
    applyCurrentOption();

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
      chart.off('click', handleClick);
      chart.getZr().off('click', handleCanvasClick);
      chart.getZr().off('dblclick', handleDoubleClick);
      chart.dispose();
      chartRef.current = null;
      optionAppliedRef.current = false;
      chartReadyRef.current = false;
    };
  }, []);

  return (
    <div
      className={className ? `economy-chart ${className}` : 'economy-chart'}
      style={style}
      role="img"
      aria-label={ariaLabel}
      data-echarts-ready={ready ? 'true' : 'false'}
      data-testid={testId}
    >
      <div ref={containerRef} className="economy-chart__canvas" aria-hidden="true" />
      <span className="economy-chart__accessible-summary">{accessibleSummary}</span>
    </div>
  );
}
