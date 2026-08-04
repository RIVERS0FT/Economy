import { expect, test, type Page, type Route } from '@playwright/test';

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

type ServerRange = '1h' | '1d' | '30d';

const RANGE_CONFIG: Record<ServerRange, { milliseconds: number; bucketMilliseconds: number; granularity: 'minute' | 'hour' | 'day' }> = {
  '1h': { milliseconds: 3_600_000, bucketMilliseconds: 60_000, granularity: 'minute' },
  '1d': { milliseconds: 86_400_000, bucketMilliseconds: 3_600_000, granularity: 'hour' },
  '30d': { milliseconds: 30 * 86_400_000, bucketMilliseconds: 86_400_000, granularity: 'day' },
};

function serverStatus(range: ServerRange) {
  const generatedAt = Date.UTC(2026, 7, 4, 9, 0);
  const config = RANGE_CONFIG[range];
  return {
    generatedAt,
    range: { key: range, ...config, startsAt: generatedAt - config.milliseconds },
    health: { level: 'healthy', reasons: ['当前指标未达到警告阈值'] },
    thresholds: {},
    process: {
      startedAt: generatedAt - 3_600_000,
      uptimeSeconds: 3_600,
      cpuPercent: 18.5,
      rssBytes: 180 * 1024 ** 2,
      heapUsedBytes: 48 * 1024 ** 2,
      heapTotalBytes: 96 * 1024 ** 2,
      externalBytes: 4 * 1024 ** 2,
      arrayBuffersBytes: 2 * 1024 ** 2,
      nodeVersion: 'v24.4.0',
      releaseSha: 'abcdef123456',
    },
    system: {
      platform: 'linux', cpuCount: 4, loadAverage1m: 0.42,
      totalMemoryBytes: 8 * 1024 ** 3, freeMemoryBytes: 5 * 1024 ** 3,
      diskTotalBytes: 80 * 1024 ** 3, diskFreeBytes: 42 * 1024 ** 3, diskFreeRatioBps: 5_250,
    },
    requests: {
      windowStartedAt: generatedAt - config.milliseconds,
      windowEndedAt: generatedAt,
      requestCount: range === '1h' ? 420 : range === '1d' ? 4_200 : 42_000,
      requestsPerSecond: 0.47,
      clientErrorCount: 8,
      serverErrorCount: 1,
      serverErrorRateBps: 24,
      averageDurationMs: 42,
      p50DurationMs: 24,
      p95DurationMs: 118,
      p99DurationMs: 190,
      maxDurationMs: 240,
      averageResponseBytes: 4_096,
      maxResponseBytes: 18_000,
      eventLoop: { p50Ms: 1.2, p95Ms: 4.8, p99Ms: 8.1, maxMs: 12.4 },
      routes: [{
        method: 'GET', route: '/api/game/state', count: 300,
        clientErrorCount: 2, serverErrorCount: 1,
        averageDurationMs: 55, p95DurationMs: 140, maxDurationMs: 240,
        averageResponseBytes: 8_000, maxResponseBytes: 18_000,
        phases: { stateProjectionMs: 62, partitionHashMs: 21 },
      }],
    },
    scheduler: {
      schedules: 14, wakeups: 12, processedWakeups: 8, staleWakeups: 4,
      transactions: 8, lastLagMs: 28, nextDueAt: generatedAt + 42_000,
    },
    database: {
      databaseBytes: 72 * 1024 ** 2, walBytes: 4 * 1024 ** 2, shmBytes: 32 * 1024,
      pageCount: 18_000, pageSize: 4_096, freelistCount: 400,
      reclaimableBytes: 400 * 4_096, reclaimableRatioBps: 222,
      journalMode: 'wal', synchronous: 1, lockTimeoutMs: 5_000,
      worldRevision: 120, worldUpdatedAt: generatedAt - 2_000, worldJsonBytes: 2 * 1024 ** 2,
      diskTotalBytes: 80 * 1024 ** 3, diskFreeBytes: 42 * 1024 ** 3, diskFreeRatioBps: 5_250,
    },
    history: [0, 1, 2].map((index) => ({
      startsAt: generatedAt - (2 - index) * config.bucketMilliseconds,
      endsAt: generatedAt - (1 - index) * config.bucketMilliseconds,
      requestCount: 120 + index * 10,
      serverErrorCount: index === 1 ? 1 : 0,
      p50DurationMs: 20 + index,
      p95DurationMs: 100 + index * 9,
      p99DurationMs: 170 + index * 10,
      eventLoopP50Ms: 2 + index * 0.2,
      eventLoopP95Ms: 4 + index * 0.4,
      eventLoopP99Ms: 7 + index * 0.5,
      eventLoopMaxMs: 10 + index,
      cpuAveragePercent: 15 + index * 2,
      cpuMaxPercent: 24 + index * 2,
      rssMaxBytes: (170 + index * 5) * 1024 ** 2,
      heapUsedMaxBytes: (44 + index * 2) * 1024 ** 2,
      heapTotalMaxBytes: 96 * 1024 ** 2,
    })),
  };
}

async function configureAdminRoutes(page: Page, requestedRanges: ServerRange[] = []) {
  await page.route('**/economy-api/me', (route) => json(route, {
    user: { id: 1, email: 'admin@example.com', name: '管理员', role: 'admin' },
  }));
  await page.route('**/economy-api/game/session', (route) => json(route, {
    playerCreated: false, banned: false, invitationBound: false, invalidInvite: false,
  }));
  await page.route('**/economy-api/game/admin/summary', (route) => json(route, {
    summary: {
      playerCount: 10, openOrderCount: 20, commodityOrderCount: 18, facilityOrderCount: 2,
      openAuctionCount: 1, openContractCount: 3, worldVersion: 22, revision: 120,
      lastProcessedAt: Date.UTC(2026, 7, 4, 9), apiStatus: 'ok', populationEconomy: {},
    },
  }));
  await page.route('**/economy-api/game/admin/server-status?**', (route) => {
    const range = new URL(route.request().url()).searchParams.get('range') as ServerRange;
    requestedRanges.push(range);
    return json(route, { serverStatus: serverStatus(range) });
  });
}

test('admin server status switches hour, day, and month trend granularity', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requestedRanges: ServerRange[] = [];
  await configureAdminRoutes(page, requestedRanges);
  await page.goto('/economy/admin');
  await page.getByRole('button', { name: '服务器', exact: true }).click();

  await expect(page.locator('.admin-server-health-panel h2')).toHaveText('服务器运行状态');
  await expect(page.getByText('运行正常', { exact: true })).toBeVisible();
  await expect(page.getByText('最近 1 小时 · 按分钟聚合 · 延迟 P50／P95／P99', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '1 天', exact: true }).click();
  await expect(page.getByText('最近 1 天 · 按小时聚合 · 延迟 P50／P95／P99', { exact: true })).toBeVisible();
  await expect.poll(() => requestedRanges.at(-1)).toBe('1d');

  await page.getByRole('button', { name: '1 个月', exact: true }).click();
  await expect(page.getByText('最近 1 个月 · 按天聚合 · 延迟 P50／P95／P99', { exact: true })).toBeVisible();
  await expect.poll(() => requestedRanges.at(-1)).toBe('30d');

  await expect(page.getByText('高负载接口', { exact: true })).toBeVisible();
  await expect(page.locator('.admin-server-route-table code').getByText('/api/game/state', { exact: true })).toBeVisible();
  await expect(page.locator('.admin-server-chart-grid .economy-chart__canvas svg')).toHaveCount(4);
  await expect(page.getByText('此页面只执行轻量只读查询，不运行 quick_check、WAL checkpoint、VACUUM、优化或备份。')).toBeVisible();
});

test('admin server status uses mobile cards without a page-level horizontal table', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await configureAdminRoutes(page);
  await page.goto('/economy/admin');
  const navigation = page.locator('.admin-mobile-bottom-navigation');
  await navigation.getByRole('button', { name: '服务器', exact: true }).click();

  await expect(page.locator('.admin-server-health-panel h2')).toHaveText('服务器运行状态');
  await expect(page.locator('.admin-server-route-cards')).toBeVisible();
  await expect(page.locator('.admin-server-route-table-wrap')).toBeHidden();
  await expect(page.locator('.admin-server-chart-grid')).toHaveCSS('grid-template-columns', /.+/);
});
