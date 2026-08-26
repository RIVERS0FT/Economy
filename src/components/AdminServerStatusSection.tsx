import { CompactNumber } from './ui/CompactNumber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  adminApi,
  type AdminServerStatus,
  type AdminServerStatusRange,
} from '../api/admin';
import { chartColor } from './charts/chartOptions';
import { AdminServerTrendChart } from './charts/AdminServerStatusCharts';
import {
  Button,
  DataList,
  DataRow,
  MetricCard,
  Panel,
  ScrollableTable,
  StatusTag,
  WidgetHeading,
  type StatusTone,
} from './ui/layout';
import { formatNumber, formatTime } from '../utils/formatters';

const RANGES: AdminServerStatusRange[] = ['1h', '1d', '30d'];
const RANGE_LABELS: Record<AdminServerStatusRange, string> = {
  '1h': '1 小时',
  '1d': '1 天',
  '30d': '1 个月',
};
const RANGE_GRANULARITY = {
  '1h': 'minute',
  '1d': 'hour',
  '30d': 'day',
} as const;
const GRANULARITY_LABELS = { minute: '分钟', hour: '小时', day: '天' } as const;
const HEALTH_COPY: Record<AdminServerStatus['health']['level'], { label: string; tone: StatusTone }> = {
  healthy: { label: '运行正常', tone: 'success' },
  warning: { label: '负载较高', tone: 'warning' },
  critical: { label: '严重异常', tone: 'danger' },
  collecting: { label: '数据积累中', tone: 'info' },
};

function formatBytes(value: number) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(bytes >= 10 * 1024 ** 3 ? 0 : 1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(bytes >= 10 * 1024 ** 2 ? 0 : 1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${Math.round(bytes)} B`;
}

function formatPercent(value: number) {
  const normalized = Math.max(0, Number(value) || 0);
  return `${normalized < 10 ? normalized.toFixed(1) : Math.round(normalized)}%`;
}

function formatBps(value: number) {
  return formatPercent((Math.max(0, Number(value) || 0)) / 100);
}

function formatMilliseconds(value: number) {
  const normalized = Math.max(0, Number(value) || 0);
  if (normalized < 10) return `${normalized.toFixed(1)}ms`;
  return `${Math.round(normalized)}ms`;
}

function formatUptime(seconds: number) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
  return `${minutes} 分钟`;
}

function nextDueCopy(nextDueAt: number | null, generatedAt: number) {
  if (nextDueAt === null) return '当前没有计划任务';
  const difference = nextDueAt - generatedAt;
  if (difference <= 0) return `已到期 ${formatMilliseconds(Math.abs(difference))}`;
  if (difference < 60_000) return `${Math.ceil(difference / 1_000)} 秒后`;
  return `${Math.ceil(difference / 60_000)} 分钟后`;
}

function phaseCopy(phases: Record<string, number>) {
  const entries = Object.entries(phases);
  if (entries.length === 0) return '—';
  return entries.map(([name, value]) => `${name} ${formatMilliseconds(value)}`).join(' · ');
}

export function AdminServerStatusSection({
  active,
  refreshToken,
  onError,
}: {
  active: boolean;
  refreshToken: number;
  onError: (message: string) => void;
}) {
  const [statuses, setStatuses] = useState<Partial<Record<AdminServerStatusRange, AdminServerStatus>>>({});
  const [range, setRange] = useState<AdminServerStatusRange>('1h');
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);

  const loadStatus = useCallback(async (nextRange: AdminServerStatusRange) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    requestRef.current = controller;
    setLoading(true);
    try {
      const nextStatus = await adminApi.serverStatus(nextRange, controller.signal);
      if (controller.signal.aborted || requestSequenceRef.current !== requestSequence) return;
      if (nextStatus.range.key !== nextRange) {
        throw new Error(`服务器返回了错误的时间范围：${nextStatus.range.key}`);
      }
      setStatuses((current) => ({ ...current, [nextRange]: nextStatus }));
      onError('');
    } catch (reason) {
      if (controller.signal.aborted) return;
      onError(reason instanceof Error ? reason.message : '无法加载服务器状态');
    } finally {
      if (requestRef.current === controller && requestSequenceRef.current === requestSequence) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [onError]);

  useEffect(() => {
    if (!active) {
      requestRef.current?.abort();
      requestSequenceRef.current += 1;
      return undefined;
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadStatus(range);
    };
    refreshWhenVisible();
    const timer = window.setInterval(refreshWhenVisible, 10_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      requestRef.current?.abort();
      requestSequenceRef.current += 1;
    };
  }, [active, loadStatus, range, refreshToken]);

  const status = statuses[range] ?? null;
  const history = status?.history ?? [];
  const granularity = status?.range.granularity ?? RANGE_GRANULARITY[range];
  const rangeSummary = `最近 ${RANGE_LABELS[range]} · 按${GRANULARITY_LABELS[granularity]}聚合 · 延迟 P50／P95／P99`;
  const chartSeries = useMemo(() => ({
    requests: [
      { name: '请求数', values: history.map((bucket) => bucket.requestCount), color: chartColor.info, format: (value: number) => formatNumber(value) },
      { name: '5xx', values: history.map((bucket) => bucket.serverErrorCount), color: chartColor.danger, format: (value: number) => formatNumber(value) },
    ],
    latency: [
      { name: 'P50', values: history.map((bucket) => bucket.p50DurationMs), color: chartColor.success, format: formatMilliseconds },
      { name: 'P95', values: history.map((bucket) => bucket.p95DurationMs), color: chartColor.warning, format: formatMilliseconds },
      { name: 'P99', values: history.map((bucket) => bucket.p99DurationMs), color: chartColor.danger, format: formatMilliseconds },
    ],
    runtime: [
      { name: 'CPU', values: history.map((bucket) => bucket.cpuAveragePercent), color: chartColor.info, format: formatPercent },
      {
        name: 'Heap',
        values: history.map((bucket) => (
          bucket.heapUsedMaxBytes !== null && bucket.heapTotalMaxBytes
            ? (bucket.heapUsedMaxBytes / bucket.heapTotalMaxBytes) * 100
            : null
        )),
        color: chartColor.warning,
        format: formatPercent,
      },
    ],
    eventLoop: [
      { name: 'P50', values: history.map((bucket) => bucket.eventLoopP50Ms), color: chartColor.success, format: formatMilliseconds },
      { name: 'P95', values: history.map((bucket) => bucket.eventLoopP95Ms), color: chartColor.warning, format: formatMilliseconds },
      { name: 'P99', values: history.map((bucket) => bucket.eventLoopP99Ms), color: chartColor.danger, format: formatMilliseconds },
    ],
  }), [history]);

  const health = HEALTH_COPY[status?.health.level ?? 'collecting'];
  const heapBps = status && status.process.heapTotalBytes > 0
    ? Math.round((status.process.heapUsedBytes / status.process.heapTotalBytes) * 10_000)
    : 0;

  return (
    <div className="admin-section-stack admin-server-console">
      <Panel className="admin-panel admin-server-health-panel">
        <div className="admin-server-health-panel__copy">
          <div className="admin-server-health-panel__title">
            <h2>服务器运行状态</h2>
            <StatusTag tone={health.tone}>{health.label}</StatusTag>
          </div>
          <p>{status?.health.reasons.join('；') || '正在读取服务器运行指标。'}</p>
          <small>
            {status
              ? `更新于 ${formatTime(status.generatedAt)} · 进程已运行 ${formatUptime(status.process.uptimeSeconds)}`
              : '尚未取得服务器状态'}
          </small>
        </div>
        <div className="admin-server-range" role="group" aria-label="服务器状态时间范围">
          {RANGES.map((option) => (
            <Button
              key={option}
              variant="compact"
              className={option === range ? 'is-active' : ''}
              disabled={loading && option === range}
              aria-pressed={option === range}
              onClick={() => setRange(option)}
            >
              {RANGE_LABELS[option]}
            </Button>
          ))}
        </div>
      </Panel>

      <section className="admin-server-summary-grid" aria-label="服务器即时负载">
        <MetricCard
          label="进程 CPU"
          value={status ? formatPercent(status.process.cpuPercent) : '--'}
          detail={status ? `主机 1m 负载 ${status.system.loadAverage1m.toFixed(2)}` : undefined}
          tone={status && status.process.cpuPercent >= 70 ? 'warning' : 'neutral'}
        />
        <MetricCard
          label="内存"
          value={status ? formatBytes(status.process.rssBytes) : '--'}
          detail={status ? `Heap ${formatBytes(status.process.heapUsedBytes)} · ${formatBps(heapBps)}` : undefined}
          tone={heapBps >= 7_500 ? 'warning' : 'neutral'}
        />
        <MetricCard
          label="API 请求"
          value={status ? formatNumber(status.requests.requestCount) : '--'}
          detail={status ? `${status.requests.requestsPerSecond.toFixed(2)} req/s` : undefined}
        />
        <MetricCard
          label="API 延迟"
          value={status ? formatMilliseconds(status.requests.p95DurationMs) : '--'}
          detail={status ? `P50 ${formatMilliseconds(status.requests.p50DurationMs)} · P99 ${formatMilliseconds(status.requests.p99DurationMs)}` : undefined}
          tone={status && status.requests.p95DurationMs >= 500 ? 'warning' : 'neutral'}
        />
        <MetricCard
          label="5xx 错误"
          value={status ? formatNumber(status.requests.serverErrorCount) : '--'}
          detail={status ? `比例 ${formatBps(status.requests.serverErrorRateBps)}` : undefined}
          tone={status && status.requests.serverErrorRateBps >= 100 ? 'danger' : 'neutral'}
        />
        <MetricCard
          label="事件循环"
          value={status ? formatMilliseconds(status.requests.eventLoop.p95Ms) : '--'}
          detail={status ? `最大 ${formatMilliseconds(status.requests.eventLoop.maxMs)}` : undefined}
          tone={status && status.requests.eventLoop.p95Ms >= 50 ? 'warning' : 'neutral'}
        />
      </section>

      <p className="admin-server-note admin-server-range-summary" aria-live="polite">{rangeSummary}</p>

      <section className="admin-server-chart-grid" aria-label={`服务器近期趋势，${rangeSummary}`}>
        <Panel className="admin-panel admin-server-chart-panel">
          <WidgetHeading title="请求负载" />
          <AdminServerTrendChart history={history} series={chartSeries.requests} granularity={granularity} ariaLabel={`服务器按${GRANULARITY_LABELS[granularity]}请求数与 5xx 趋势`} />
        </Panel>
        <Panel className="admin-panel admin-server-chart-panel">
          <WidgetHeading title="响应延迟 P50／P95／P99" />
          <AdminServerTrendChart history={history} series={chartSeries.latency} granularity={granularity} ariaLabel={`服务器按${GRANULARITY_LABELS[granularity]}响应 P50、P95 与 P99 延迟趋势`} />
        </Panel>
        <Panel className="admin-panel admin-server-chart-panel">
          <WidgetHeading title="运行时负载" />
          <AdminServerTrendChart history={history} series={chartSeries.runtime} granularity={granularity} ariaLabel={`Node 进程按${GRANULARITY_LABELS[granularity]} CPU 与 Heap 使用率趋势`} />
        </Panel>
        <Panel className="admin-panel admin-server-chart-panel">
          <WidgetHeading title="事件循环" />
          <AdminServerTrendChart history={history} series={chartSeries.eventLoop} granularity={granularity} ariaLabel={`Node 事件循环按${GRANULARITY_LABELS[granularity]} P50、P95 与 P99 延迟趋势`} />
        </Panel>
      </section>

      <Panel className="admin-panel admin-server-routes-panel">
        <WidgetHeading title="高负载接口" />
        {status?.requests.routes.length ? (
          <>
            <ScrollableTable className="admin-server-route-table-wrap">
              <table className="admin-table admin-server-route-table">
                <thead>
                  <tr>
                    <th>接口</th>
                    <th>请求</th>
                    <th>5xx</th>
                    <th>平均</th>
                    <th>P95</th>
                    <th>最大</th>
                    <th>响应</th>
                    <th>主要阶段 P95</th>
                  </tr>
                </thead>
                <tbody>
                  {status.requests.routes.map((route) => (
                    <tr key={`${route.method}-${route.route}`}>
                      <td><strong>{route.method}</strong><code>{route.route}</code></td>
                      <td>{<CompactNumber value={route.count} />}</td>
                      <td>{<CompactNumber value={route.serverErrorCount} />}</td>
                      <td>{formatMilliseconds(route.averageDurationMs)}</td>
                      <td>{formatMilliseconds(route.p95DurationMs)}</td>
                      <td>{formatMilliseconds(route.maxDurationMs)}</td>
                      <td>{formatBytes(route.averageResponseBytes)}</td>
                      <td>{phaseCopy(route.phases)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
            <div className="admin-server-route-cards" aria-label="移动端高负载接口">
              {status.requests.routes.map((route) => (
                <article key={`${route.method}-${route.route}`}>
                  <header><strong>{route.method}</strong><code>{route.route}</code></header>
                  <dl>
                    <div><dt>请求</dt><dd>{<CompactNumber value={route.count} />}</dd></div>
                    <div><dt>5xx</dt><dd>{<CompactNumber value={route.serverErrorCount} />}</dd></div>
                    <div><dt>P95</dt><dd>{formatMilliseconds(route.p95DurationMs)}</dd></div>
                    <div><dt>响应</dt><dd>{formatBytes(route.averageResponseBytes)}</dd></div>
                  </dl>
                  <small>{phaseCopy(route.phases)}</small>
                </article>
              ))}
            </div>
          </>
        ) : <p className="admin-server-empty">当前范围内没有 API 请求指标。</p>}
      </Panel>

      <section className="admin-server-diagnostics-grid">
        <Panel className="admin-panel">
          <WidgetHeading title="世界调度" />
          <DataList>
            <DataRow label="下一次调度" value={status ? nextDueCopy(status.scheduler.nextDueAt, status.generatedAt) : '--'} />
            <DataRow label="最近调度延迟" value={status ? formatMilliseconds(status.scheduler.lastLagMs) : '--'} tone={status && status.scheduler.lastLagMs >= 1_000 ? 'warning' : 'neutral'} />
            <DataRow label="计划／唤醒" value={status ? `${formatNumber(status.scheduler.schedules)}／${formatNumber(status.scheduler.wakeups)}` : '--'} />
            <DataRow label="实际处理／过期唤醒" value={status ? `${formatNumber(status.scheduler.processedWakeups)}／${formatNumber(status.scheduler.staleWakeups)}` : '--'} />
            <DataRow label="世界写事务" value={status ? formatNumber(status.scheduler.transactions) : '--'} />
            <DataRow label="世界修订号" value={status ? formatNumber(status.database.worldRevision) : '--'} />
          </DataList>
          <p className="admin-server-note">计划唤醒没有产生事务属于正常空闲行为；调度延迟持续升高或空闲事务持续增长才需要处理。</p>
        </Panel>

        <Panel className="admin-panel">
          <WidgetHeading title="SQLite 与磁盘" />
          <DataList>
            <DataRow label="数据库／WAL" value={status ? `${formatBytes(status.database.databaseBytes)}／${formatBytes(status.database.walBytes)}` : '--'} tone={status && status.database.walBytes >= 128 * 1024 ** 2 ? 'warning' : 'neutral'} />
            <DataRow label="世界 JSON" value={status ? formatBytes(status.database.worldJsonBytes) : '--'} />
            <DataRow label="空闲页／可回收" value={status ? `${formatNumber(status.database.freelistCount)}／${formatBytes(status.database.reclaimableBytes)}` : '--'} />
            <DataRow label="磁盘剩余" value={status ? `${formatBytes(status.system.diskFreeBytes)} · ${formatBps(status.system.diskFreeRatioBps)}` : '--'} tone={status && status.system.diskFreeRatioBps <= 2_000 ? 'warning' : 'neutral'} />
            <DataRow label="Journal／同步" value={status ? `${status.database.journalMode.toUpperCase()}／${status.database.synchronous}` : '--'} />
            <DataRow label="锁等待上限" value={status ? `${status.database.lockTimeoutMs}ms` : '--'} />
          </DataList>
          <p className="admin-server-note">此页面只执行轻量只读查询，不运行 quick_check、WAL checkpoint、VACUUM、优化或备份。</p>
        </Panel>

        <Panel className="admin-panel admin-server-process-panel">
          <WidgetHeading title="进程与主机" />
          <DataList>
            <DataRow label="Node" value={status?.process.nodeVersion ?? '--'} />
            <DataRow label="部署提交" value={status?.process.releaseSha ?? '未提供'} />
            <DataRow label="平台／CPU" value={status ? `${status.system.platform}／${status.system.cpuCount} 核` : '--'} />
            <DataRow label="主机内存剩余" value={status ? formatBytes(status.system.freeMemoryBytes) : '--'} />
            <DataRow label="外部内存" value={status ? formatBytes(status.process.externalBytes) : '--'} />
            <DataRow label="ArrayBuffer" value={status ? formatBytes(status.process.arrayBuffersBytes) : '--'} />
          </DataList>
        </Panel>
      </section>
    </div>
  );
}
