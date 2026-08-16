import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
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
}

export interface EconomyChartSize {
  width: number;
  height: number;
}

function applyChartOption(
  chart: EChartsType,
  container: HTMLElement,
  option: EChartsCoreOption,
  updateMode: EconomyChartUpdateMode,
  lazyUpdate: boolean,
) {
  chart.setOption(resolveEChartsCssColors(option, container), {
    notMerge: updateMode !== 'merge',
    lazyUpdate,
  });
  container.dataset.echartsCssColorsResolved = 'true';
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
  onDoubleClick?: (event: EconomyChartDoubleClickEvent, chart: EChartsType) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef(option);
  const resizeFrameRef = useRef<number | null>(null);
  const optionAppliedRef = useRef(false);
  const chartReadyRef = useRef(false);
  const updateModeRef = useRef(updateMode);
  const onChartReadyRef = useRef(onChartReady);
  const onOptionAppliedRef = useRef(onOptionApplied);
  const onResizeRef = useRef(onResize);
  const onClickRef = useRef(onClick);
  const onDoubleClickRef = useRef(onDoubleClick);
  const [ready, setReady] = useState(false);

  updateModeRef.current = updateMode;
  onChartReadyRef.current = onChartReady;
  onOptionAppliedRef.current = onOptionApplied;
  onResizeRef.current = onResize;
  onClickRef.current = onClick;
  onDoubleClickRef.current = onDoubleClick;

  useLayoutEffect(() => {
    optionRef.current = option;
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container || !hasRenderableSize(container)) return;
    applyChartOption(chart, container, option, updateMode, true);
    optionAppliedRef.current = true;
    if (!chartReadyRef.current) {
      chartReadyRef.current = true;
      setReady(true);
      onChartReadyRef.current?.(chart);
    }
    onOptionAppliedRef.current?.(chart);
  }, [option, updateMode]);

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
    const handleDoubleClick = (event: unknown) => {
      onDoubleClickRef.current?.(event as EconomyChartDoubleClickEvent, chart);
    };
    chart.on('click', handleClick);
    chart.getZr().on('dblclick', handleDoubleClick);
    const applyCurrentOption = () => {
      if (!hasRenderableSize(container)) return false;
      applyChartOption(chart, container, optionRef.current, updateModeRef.current, false);
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
