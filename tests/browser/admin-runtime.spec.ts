import { expect, test, type Page, type Route } from '@playwright/test';

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function configureAdminRoutes(page: Page) {
  await page.route('**/economy-api/me', (route) => json(route, {
    user: { id: 1, email: 'admin@example.com', name: '管理员', role: 'admin' },
  }));
  await page.route('**/economy-api/game/session', (route) => json(route, {
    playerCreated: false,
    banned: false,
    invitationBound: false,
    invalidInvite: false,
  }));
  await page.route('**/economy-api/game/admin/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/economy-api/game/admin', '');
    if (path === '/summary' || path === '/population-economy') {
      await json(route, { summary: {
        playerCount: 10,
        openOrderCount: 29,
        commodityOrderCount: 29,
        facilityOrderCount: 0,
        openAuctionCount: 2,
        openContractCount: 3,
        worldVersion: 15,
        revision: 120,
        lastProcessedAt: Date.UTC(2026, 6, 19, 10),
        apiStatus: 'ok',
        populationEconomy: {
          credits: 5_000, frozenCredits: 500, pendingIncome: 300, lastIncome: 200, lastBudget: 1_000,
          totalIncome: 10_000, totalSpent: 5_000, constructionEscrow: 250, totalEmploymentIncome: 8_000, totalConsumption: 5_000,
          models: {
            basic: { id: 'basic', name: '基础人口', consumptionState: 'lavish', stateReason: 'lavish-qualified', stateCycles: 5, incomeHealthBps: 9_800, walletCoverageBps: 17_000, incomeCoverageBps: 16_000, credits: 3_000, frozenCredits: 300, pendingIncome: { production: 100, construction: 50, warehouse: 20, marketService: 10 }, lastIncome: 120, incomeEma: 110, recentPeakIncome: 112, noIncomeCycles: 0, lastBudget: 600, foodBudget: 390, householdBudget: 210, stabilizationBudget: 69, lastStabilizationIssued: 0, lastAdminPopulationIssued: 0, totalIncome: 6_000, totalSpent: 3_000 },
            skilled: { id: 'skilled', name: '技术人口', consumptionState: 'prosperous', stateReason: 'prosperous-qualified', stateCycles: 3, incomeHealthBps: 9_000, walletCoverageBps: 12_000, incomeCoverageBps: 12_000, credits: 1_500, frozenCredits: 150, pendingIncome: { production: 60, construction: 20, warehouse: 10, marketService: 10 }, lastIncome: 60, incomeEma: 70, recentPeakIncome: 78, noIncomeCycles: 0, lastBudget: 300, foodBudget: 150, householdBudget: 150, stabilizationBudget: 58, lastStabilizationIssued: 0, lastAdminPopulationIssued: 0, totalIncome: 3_000, totalSpent: 1_500 },
            professional: { id: 'professional', name: '专业人口', consumptionState: 'strained', stateReason: 'income-strained', stateCycles: 2, incomeHealthBps: 5_000, walletCoverageBps: 8_000, incomeCoverageBps: 6_000, credits: 500, frozenCredits: 50, pendingIncome: { production: 10, construction: 5, warehouse: 3, marketService: 2 }, lastIncome: 20, incomeEma: 20, recentPeakIncome: 40, noIncomeCycles: 1, lastBudget: 100, foodBudget: 58, householdBudget: 42, stabilizationBudget: 33, lastStabilizationIssued: 0, lastAdminPopulationIssued: 0, totalIncome: 1_000, totalSpent: 500 },
          },
          sources: { production: 10_000, construction: 2_000, warehouse: 0, marketService: 1 },
          productionByComplexity: { C1: 10_000, C2: 5_000, C3: 1_000, C4: 500, C5: 100, C6: 1, C7: 0 },
          productionWageAdjustment: { subsidyIssued: 0, withheld: 0 },
          issuance: { work: 20_000, exchange: 5_000, gift: 1_000, legacyPopulation: 0, migration: 5_700, stabilization: 684, adminPopulation: 0, productionWageSubsidy: 0, total: 32_384 },
          policy: {
            stabilizationShareBps: 1_200, targetWalletCycles: 3, refillCapBps: 10_000, productionWageMultiplierBps: 10_000,
            modelMultipliersBps: { basic: 10_000, skilled: 10_000, professional: 10_000 },
            effectiveCycleId: 0, expiresAfterCycleId: null, updatedAt: null, updatedBy: null,
            isDefault: true, currentCycleId: 100, durationCycles: null, elapsedCycles: null, remainingCycles: null,
            effectiveAt: null, expiresAt: null, nextCycleAt: Date.UTC(2026, 6, 19, 10, 5),
            currentCycleIssued: {
              issuedByModel: { basic: 120, skilled: 60, professional: 20 },
              automaticByModel: { basic: 120, skilled: 60, professional: 20 },
              adminByModel: { basic: 0, skilled: 0, professional: 0 },
            },
          },
          policyLimits: {
            stabilizationShareBps: { min: 0 }, targetWalletCycles: { min: 1 },
            refillCapBps: { min: 0 }, productionWageMultiplierBps: { min: 5_000 }, modelMultiplierBps: { min: 5_000 },
            durationCycles: { min: 1 },
          },
          policyBaseBudget: 5_700,
          policyProjectedStabilizationTotal: 684,
        },
      } });
      return;
    }
    if (path === '/player-statistics') {
      const generatedAt = Date.UTC(2026, 6, 19, 10);
      await json(route, { playerStatistics: {
        generatedAt,
        coverageStartsAt: Date.UTC(2026, 6, 18, 4),
        revision: 120,
        range: { key: '30d', days: 30, startsAt: Date.UTC(2026, 5, 20, 16), endsAt: generatedAt, timeZone: 'Asia/Shanghai', completeHistory: false },
        snapshot: { totalPlayers: 10, newToday: 2, active24h: 4, active7d: 7, active30d: 9, activeRate7dBps: 7_000, registeredInRange: 6, activatedInRange: 5, activationRateBps: 8_333, dormant30d: 1 },
        acquisition: { total: 6, direct: 3, shareLink: 2, manualCode: 1, blocked: 0 },
        activity: { activePlayersInRange: 9, averageDailyActive: 5, peakDailyActive: 8, peakDay: '2026-07-18', productionParticipantsInRange: 6, tradeParticipantsInRange: 4 },
        retention: {
          d1: { eligible: 5, retained: 4, rateBps: 8_000 },
          d7: { eligible: 3, retained: 2, rateBps: 6_667 },
          d30: { eligible: 0, retained: 0, rateBps: 0 },
        },
        funnel: {
          stages: [
            { id: 'registered', label: '完成建档', count: 10, medianHours: 0, conversionBps: 10_000 },
            { id: 'activated', label: '首次经济操作', count: 8, medianHours: 0.4, conversionBps: 8_000 },
            { id: 'facility', label: '第一座工厂', count: 6, medianHours: 3.2, conversionBps: 7_500 },
            { id: 'production', label: '首次生产', count: 5, medianHours: 4.1, conversionBps: 8_333 },
            { id: 'trade', label: '首次订单簿成交', count: 4, medianHours: 8.5, conversionBps: 8_000 },
          ],
          retained7d: { eligible: 3, retained: 2, rateBps: 6_667 },
        },
        participation: {
          active7d: 7,
          rows: [
            { id: 'has-facility', label: '持有工厂', count: 6, shareBps: 6_000 },
            { id: 'current-trade', label: '本周有订单簿成交', count: 4, shareBps: 4_000 },
          ],
        },
        wealth: {
          total: 80_000, average: 8_000, median: 5_000, p25: 2_000, p75: 9_000, p90: 18_000, p99: 28_000,
          top1ShareBps: 3_500, top10ShareBps: 3_500, frozenShareBps: 1_200, unpricedAssetPlayers: 1,
          composition: { cash: 40_000, commodities: 25_000, facilities: 15_000, frozen: 9_600, total: 80_000 },
          brackets: [
            { id: '0-499', label: '0～499', count: 1 },
            { id: '500-1999', label: '500～1,999', count: 2 },
            { id: '2000-9999', label: '2,000～9,999', count: 4 },
            { id: '10000-49999', label: '10,000～49,999', count: 3 },
            { id: '50000+', label: '50,000 以上', count: 0 },
          ],
        },
        attention: [
          { id: 'unactivated-new', label: '注册超过 24 小时仍未激活', count: 1, tone: 'warning' },
          { id: 'production-blocked', label: '全部开启工厂均受阻', count: 0, tone: 'danger' },
        ],
        series: [
          { day: '2026-07-18', startsAt: Date.UTC(2026, 6, 17, 16), covered: true, partialCoverage: false, newPlayers: 1, activePlayers: 8, firstActivities: 1, productionParticipants: 5, tradeParticipants: 3 },
          { day: '2026-07-19', startsAt: Date.UTC(2026, 6, 18, 16), covered: true, partialCoverage: true, newPlayers: 2, activePlayers: 4, firstActivities: 2, productionParticipants: 2, tradeParticipants: 1 },
        ],
      } });
      return;
    }
    if (path === '/community-link') {
      await json(route, { communityLink: { qqGroupUrl: 'https://qm.qq.com/q/admin-test', updatedAt: Date.now() } });
      return;
    }
    if (path === '/gift-codes') {
      await json(route, { giftCodes: [], total: 0, nextCursor: null });
      return;
    }
    if (path === '/bans') {
      await json(route, { incidents: [{
        id: 7,
        status: 'active',
        detected_at: Date.UTC(2026, 6, 18, 8),
        updated_at: Date.UTC(2026, 6, 18, 8),
        detected_user_count: 2,
        fingerprint_preview: 'family-network',
        active_ban_count: 1,
      }] });
      return;
    }
    if (path === '/bans/7') {
      await json(route, {
        incident: {
          id: 7,
          status: 'active',
          detected_at: Date.UTC(2026, 6, 18, 8),
          updated_at: Date.UTC(2026, 6, 18, 8),
          detected_user_count: 2,
          fingerprint_preview: 'family-network',
          active_ban_count: 1,
          created_reason: 'duplicate_ip',
        },
        members: [
          { user_id: 11, registered_at: Date.UTC(2026, 6, 17), registration_source: 'email_verification', email: 'one@example.com', ban_status: 'active', banned_at: Date.UTC(2026, 6, 18), unbanned_at: null, admin_note: null },
          { user_id: 12, registered_at: Date.UTC(2026, 6, 17), registration_source: 'email_verification', email: 'two@example.com', ban_status: 'lifted', banned_at: Date.UTC(2026, 6, 18), unbanned_at: Date.UTC(2026, 6, 19), admin_note: '已核验' },
        ],
      });
      return;
    }
    if (path === '/bans/users/11/unban') {
      await json(route, { ok: true, message: '账号已解禁' });
      return;
    }
    if (path === '/bans/users/12/reban') {
      await json(route, { ok: true, message: '账号已重新封禁' });
      return;
    }
    if (path === '/bans/7/unban-all') {
      await json(route, { ok: true, message: '事件账号已全部解禁', changedCount: 1 });
      return;
    }
    await json(route, { message: `未模拟管理员接口 ${path}` }, 404);
  });
}

test('admin desktop shares the game shell gutter, command bar and edge scrollbar', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1144 });
  await configureAdminRoutes(page);
  await page.goto('/economy/admin');

  await expect(page.getByRole('heading', { name: '世界概览', exact: true })).toBeVisible();
await expect(page.locator('.admin-command-bar')).toBeVisible();
await expect(page.locator('.admin-command-bar .liquid-glass-surface--desktopStatusBar')).toHaveCount(1);
await expect(page.locator('.admin-summary-grid .ui-metric-card')).toHaveCount(6);
await expect(page.getByRole('heading', { name: '玩家社区入口', exact: true })).toBeVisible();
await expect(page.getByLabel('QQ群跳转链接', { exact: true })).toHaveValue('https://qm.qq.com/q/admin-test');
await expect(page.getByRole('heading', { name: '玩家运营分析', exact: true })).toHaveCount(0);
await expect(page.getByRole('heading', { name: '人口经济总览', exact: true })).toHaveCount(0);
await expect(page.locator('.admin-page-frame .page-heading')).toHaveCSS('display', 'none');

const desktopNavigationLabels = await page.locator('.admin-sidebar .sidebar-nav-button strong').allTextContents();
expect(desktopNavigationLabels).toEqual(['概览', '玩家', '人口', '礼品', '封禁']);

  const geometry = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>('.admin-workspace');
    const sidebar = document.querySelector<HTMLElement>('.admin-sidebar');
    const commandBar = document.querySelector<HTMLElement>('.admin-command-bar');
    const summary = document.querySelector<HTMLElement>('.admin-summary-grid');
    const pageFrame = document.querySelector<HTMLElement>('.admin-page-frame');
    const rail = document.querySelector<HTMLElement>('.admin-shell .page-scroll-area > .ui-scrollbar--vertical');
    const thumb = document.querySelector<HTMLElement>('.admin-shell .page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb');
    if (!workspace || !sidebar || !commandBar || !summary || !pageFrame || !rail || !thumb) {
      throw new Error('管理员共享桌面外壳结构缺失');
    }
    const workspaceRect = workspace.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const commandRect = commandBar.getBoundingClientRect();
    const summaryRect = summary.getBoundingClientRect();
    const frameRect = pageFrame.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      sidebarLeft: sidebarRect.left,
      sidebarWorkspaceGap: workspaceRect.left - sidebarRect.right,
      commandTop: commandRect.top,
      commandRightGap: window.innerWidth - commandRect.right,
      commandHeight: commandRect.height,
      contentRightDifference: Math.abs(commandRect.right - summaryRect.right),
      frameWorkspaceWidthDifference: Math.abs(frameRect.width - workspaceRect.width),
      railRight: railRect.right,
      thumbRight: thumbRect.right,
    };
  });
  expect(geometry.sidebarLeft).toBeCloseTo(12, 0);
  expect(geometry.sidebarWorkspaceGap).toBeCloseTo(12, 0);
  expect(geometry.commandTop).toBeCloseTo(12, 0);
  expect(geometry.commandRightGap).toBeCloseTo(12, 0);
  expect(geometry.commandHeight).toBeCloseTo(76, 0);
  expect(geometry.contentRightDifference).toBeLessThanOrEqual(1);
  expect(geometry.frameWorkspaceWidthDifference).toBeLessThanOrEqual(1);
  expect(geometry.railRight).toBeCloseTo(geometry.viewportWidth, 0);
  expect(geometry.thumbRight).toBeCloseTo(geometry.viewportWidth, 0);
  const metricColumns = await page.locator('.admin-summary-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(metricColumns).toBe(6);

  await page.getByRole('button', { name: '玩家', exact: true }).click();
await expect(page.getByRole('heading', { name: '玩家运营', exact: true })).toBeVisible();
await expect(page.getByRole('heading', { name: '玩家运营分析', exact: true })).toBeVisible();
await expect(page.getByRole('group', { name: '玩家统计时间范围' })).toBeVisible();
await expect(page.getByRole('button', { name: '30 日', exact: true })).toHaveAttribute('aria-pressed', 'true');
await expect(page.getByText('24 小时经济活跃', { exact: true })).toBeVisible();
await expect(page.getByRole('heading', { name: '新增与经济活跃趋势', exact: true })).toBeVisible();
await expect(page.getByRole('heading', { name: '财富分布', exact: true })).toBeVisible();
await expect(page.getByRole('heading', { name: '需要关注的玩家群体', exact: true })).toBeVisible();

await page.getByRole('button', { name: '人口', exact: true }).click();
await expect(page.getByRole('heading', { name: '人口经济', exact: true })).toBeVisible();
await expect(page.getByRole('heading', { name: '人口经济总览', exact: true })).toBeVisible();
await expect(page.getByRole('table', { name: '人口需求比较矩阵' })).toBeVisible();
await expect(page.getByText('当前钱包总缺口', { exact: true })).toBeVisible();
await expect(page.locator('.admin-population-ledger').getByText('累计稳定需求补充', { exact: true })).toBeVisible();
await expect(page.locator('.admin-population-ledger').getByText('累计管理员人口补充', { exact: true })).toBeVisible();
await expect(page.locator('.admin-population-matrix').getByText('稳定预算／自动补充', { exact: true })).toBeVisible();
await expect(page.locator('.admin-population-matrix').getByText('奢靡', { exact: true })).toBeVisible();
await expect(page.locator('.admin-population-matrix').getByText('繁荣', { exact: true })).toBeVisible();
await expect(page.locator('.admin-population-matrix').getByText('拮据', { exact: true })).toBeVisible();
await expect(page.locator('.admin-population-matrix').getByText('状态判定指标', { exact: true })).toBeVisible();
await expect(page.locator('.admin-population-matrix').getByText('健康 98%', { exact: true })).toBeVisible();
await expect(page.locator('.admin-population-matrix').getByText('收入覆盖 160% · 判定钱包 170%', { exact: true })).toBeVisible();
await expect(page.getByRole('heading', { name: '人口政策调控', exact: true })).toBeVisible();
await expect(page.getByRole('heading', { name: '当前政策', exact: true })).toBeVisible();
await expect(page.getByText('稳定需求比例／目标钱包', { exact: true })).toBeVisible();
await expect(page.getByText('基础／技术／专业人口倍率', { exact: true })).toBeVisible();
await expect(page.getByText('总持续时间', { exact: true })).toBeVisible();
await expect(page.locator('.admin-population-policy-current--summary').getByText('长期', { exact: true }).first()).toBeVisible();
await expect(page.getByRole('button', { name: '展开拟应用政策', exact: true })).toBeVisible();
await page.getByRole('button', { name: '展开拟应用政策', exact: true }).click();
await expect(page.getByLabel('生产工资系数（%）', { exact: true })).toHaveValue('100');
await expect(page.getByLabel('稳定需求比例（%）', { exact: true })).not.toHaveAttribute('max');
await expect(page.getByLabel('政策有效周期', { exact: true })).not.toHaveAttribute('max');
await expect(page.getByRole('button', { name: '预览政策', exact: true })).toBeVisible();
await expect(page.getByText('人口调控记录', { exact: true })).toHaveCount(0);
await expect(page.getByText('管理备注', { exact: true })).toHaveCount(0);

const visiblePositiveBarWidth = await page.locator('.admin-population-distribution-list > div').filter({ hasText: '市场服务' }).locator('.admin-population-bar > span').evaluate((element) => element.getBoundingClientRect().width);
const zeroBarWidth = await page.locator('.admin-population-distribution-list > div').filter({ hasText: '仓库扩容' }).locator('.admin-population-bar > span').evaluate((element) => element.getBoundingClientRect().width);
expect(visiblePositiveBarWidth).toBeGreaterThanOrEqual(3.5);
expect(zeroBarWidth).toBe(0);

await page.getByLabel('生产工资系数（%）', { exact: true }).fill('135');
await page.getByRole('button', { name: '玩家', exact: true }).click();
await page.getByRole('button', { name: '人口', exact: true }).click();
await expect(page.getByLabel('生产工资系数（%）', { exact: true })).toHaveValue('135');

await page.getByRole('button', { name: '礼品', exact: true }).click();
await expect(page.getByRole('heading', { name: '创建礼品码', exact: true })).toBeVisible();
await expect(page.getByText('暂无礼品码。', { exact: true })).toBeVisible();
const giftColumns = await page.locator('.admin-gift-console').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
expect(giftColumns).toBe(2);

await page.getByRole('button', { name: '封禁', exact: true }).click();
await expect(page.getByRole('heading', { name: '同 IP 账号封禁', exact: true })).toBeVisible();
const incident = page.locator('.admin-ban-incidents .virtual-list__item > button');
await expect(page.locator('.admin-ban-incidents .virtual-list__canvas')).toHaveCount(1);
await expect(incident).toHaveCount(1);
await incident.click();
await expect(page.getByText('one@example.com', { exact: false })).toBeVisible();
await expect(page.getByRole('button', { name: '解禁', exact: true })).toBeVisible();
await expect(page.getByRole('button', { name: '重新封禁', exact: true })).toBeVisible();
await page.getByRole('button', { name: '解禁', exact: true }).click();
await expect(page.getByText('账号已解禁', { exact: true })).toBeVisible();

  const adminSidebar = page.locator('.admin-sidebar');
  await page.getByRole('button', { name: '折叠侧栏' }).click();
  await expect(adminSidebar).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByRole('button', { name: '展开侧栏' })).toBeFocused();
});

test('admin navigation uses the shared mobile overlay and stays above page cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await configureAdminRoutes(page);
  await page.goto('/economy/admin');

  await expect(page.locator('.admin-sidebar')).toBeHidden();
  await expect(page.locator('.admin-command-bar')).toBeHidden();
  const navigation = page.getByRole('navigation', { name: '管理员移动导航' });
  const mobileBottomNavigation = page.locator('.admin-mobile-bottom-navigation');
  await expect(navigation).toBeVisible();
  await expect(mobileBottomNavigation).toBeVisible();
  await expect(page.locator('.admin-mobile-navigation')).toHaveCount(0);
  await expect(page.locator('.admin-mobile-chrome-layer')).toHaveCount(1);
  await expect(mobileBottomNavigation.locator('.liquid-glass-surface')).toHaveCount(1);
  await expect(mobileBottomNavigation.locator('.mobile-bottom-navigation__viewport')).toHaveCount(1);

  const mobileNavigationLabels = await mobileBottomNavigation.locator('.sidebar-nav-button strong').allTextContents();
  expect(mobileNavigationLabels).toEqual(['概览', '玩家', '人口', '礼品', '封禁']);

  const geometry = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>('.admin-mobile-bottom-navigation');
    const scroll = document.querySelector<HTMLElement>('.admin-page-scroll');
    const pageLayer = document.querySelector<HTMLElement>('.mobile-page-overlay');
    const layer = document.querySelector<HTMLElement>('.admin-mobile-chrome-layer');
    const workspace = document.querySelector<HTMLElement>('.admin-workspace');
    if (!nav || !scroll || !pageLayer || !layer || !workspace) throw new Error('管理员移动导航结构缺失');
    const navRect = nav.getBoundingClientRect();
    const scrollStyle = getComputedStyle(scroll);
    const pageLayerStyle = getComputedStyle(pageLayer);
    const layerStyle = getComputedStyle(layer);
    const workspaceStyle = getComputedStyle(workspace);
    const topmost = document.elementFromPoint(
      navRect.left + navRect.width / 2,
      navRect.top + navRect.height / 2,
    );
    return {
      navHeight: navRect.height,
      navBottomGap: window.innerHeight - navRect.bottom,
      scrollPaddingBottom: Number.parseFloat(scrollStyle.paddingBottom),
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      chromeLayerInsideWorkspace: workspace.contains(layer),
      chromeLayerOrder: Number.parseInt(layerStyle.order, 10),
      pageLayerOrder: Number.parseInt(pageLayerStyle.order, 10),
      topmostInsideNavigation: Boolean(topmost && nav.contains(topmost)),
      workspaceDisplay: workspaceStyle.display,
      layerPosition: layerStyle.position,
      layerZIndex: layerStyle.zIndex,
    };
  });
  expect(geometry.navHeight).toBe(68);
  expect(geometry.navBottomGap).toBeGreaterThanOrEqual(0);
  expect(geometry.navBottomGap).toBeLessThanOrEqual(20);
  expect(geometry.scrollPaddingBottom).toBeGreaterThan(geometry.navHeight);
  expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
  expect(geometry.chromeLayerInsideWorkspace).toBe(true);
  expect(geometry.chromeLayerOrder).toBeGreaterThan(geometry.pageLayerOrder);
  expect(geometry.topmostInsideNavigation).toBe(true);
  expect(geometry.workspaceDisplay).toBe('grid');
  expect(geometry.layerPosition).toBe('relative');
  expect(geometry.layerZIndex).toBe('auto');

  await page.getByRole('button', { name: '封禁', exact: true }).click();
  await expect(page.getByRole('heading', { name: '同 IP 账号封禁', exact: true })).toBeVisible();
  await expect(page.locator('.admin-ban-incidents .virtual-list__canvas')).toHaveCount(1);
});
