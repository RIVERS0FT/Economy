import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { initECharts, type EChartsCoreOption, type EChartsType } from './echartsCore';

let nextChartInstanceId = 1;

export type EconomyChartUpdateMode = 'replace' | 'merge';

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
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef(option);
  const resizeFrameRef = useRef<number | null>(null);
  const updateModeRef = useRef(updateMode);
  const onChartReadyRef = useRef(onChartReady);
  const onOptionAppliedRef = useRef(onOptionApplied);
  const [ready, setReady] = useState(false);

  updateModeRef.current = updateMode;
  onChartReadyRef.current = onChartReady;
  onOptionAppliedRef.current = onOptionApplied;

  useLayoutEffect(() => {
    optionRef.current = option;
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, {
      notMerge: updateMode !== 'merge',
      lazyUpdate: true,
    });
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
    chart.setOption(optionRef.current, {
      notMerge: updateModeRef.current !== 'merge',
      lazyUpdate: false,
    });
    setReady(true);
    onChartReadyRef.current?.(chart);
    onOptionAppliedRef.current?.(chart);

    const scheduleResize = () => {
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        chart.resize();
      });
    };

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleResize);
    observer?.observe(container);
    window.addEventListener('resize', scheduleResize);
    void document.fonts?.ready.then(scheduleResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
      chart.dispose();
      chartRef.current = null;
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
