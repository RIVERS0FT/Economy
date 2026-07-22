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
    if (path === '/summary') {
      await json(route, { summary: {
        playerCount: 10,
        openOrderCount: 29,
        commodityOrderCount: 29,
        facilityOrderCount: 0,
        collectibleCount: 4,
        openAuctionCount: 2,
        worldVersion: 14,
        revision: 120,
        lastProcessedAt: Date.UTC(2026, 6, 19, 10),
        apiStatus: 'ok',
        populationEconomy: {
          credits: 5_000, frozenCredits: 500, pendingIncome: 300, lastIncome: 200, lastBudget: 1_000,
          totalIncome: 10_000, totalSpent: 5_000, constructionEscrow: 250, totalEmploymentIncome: 8_000, totalConsumption: 5_000,
          models: {
            basic: { id: 'basic', name: '基础人口', consumptionState: 'normal', credits: 3_000, frozenCredits: 300, pendingIncome: { production: 100, construction: 50, warehouse: 20, marketService: 10 }, lastIncome: 120, incomeEma: 110, recentPeakIncome: 130, noIncomeCycles: 0, lastBudget: 600, foodBudget: 468, householdBudget: 132, totalIncome: 6_000, totalSpent: 3_000 },
            skilled: { id: 'skilled', name: '技术人口', consumptionState: 'cautious', credits: 1_500, frozenCredits: 150, pendingIncome: { production: 60, construction: 20, warehouse: 10, marketService: 10 }, lastIncome: 60, incomeEma: 70, recentPeakIncome: 100, noIncomeCycles: 1, lastBudget: 300, foodBudget: 219, householdBudget: 81, totalIncome: 3_000, totalSpent: 1_500 },
            professional: { id: 'professional', name: '专业人口', consumptionState: 'subsistence', credits: 500, frozenCredits: 50, pendingIncome: { production: 10, construction: 5, warehouse: 3, marketService: 2 }, lastIncome: 20, incomeEma: 20, recentPeakIncome: 100, noIncomeCycles: 2, lastBudget: 100, foodBudget: 85, householdBudget: 15, totalIncome: 1_000, totalSpent: 500 },
          },
          sources: { production: 4_000, construction: 2_000, warehouse: 1_000, marketService: 1_000 },
          productionByComplexity: { C1: 500, C2: 500, C3: 500, C4: 500, C5: 500, C6: 500, C7: 1_000 },
          issuance: { work: 20_000, exchange: 5_000, gift: 1_000, legacyPopulation: 0, migration: 5_700, total: 31_700 },
        },
      } });
      return;
    }
    if (path === '/community-link') {
      await json(route, { communityLink: { qqGroupUrl: 'https://qm.qq.com/q/admin-test', updatedAt: Date.now() } });
      return;
    }
    if (path === '/collectibles') {
      await json(route, { collectibles: [] });
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

test('admin backend uses unified sections and embeds ban review', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1144 });
  await configureAdminRoutes(page);
  await page.goto('/economy/admin');

  await expect(page.getByRole('heading', { name: '世界概况', exact: true })).toBeVisible();
  await expect(page.locator('.admin-summary-grid .ui-metric-card')).toHaveCount(8);
  await expect(page.getByRole('heading', { name: '人口经济', exact: true })).toBeVisible();
  await expect(page.locator('.admin-population-model-card')).toHaveCount(3);
  const contentWidth = await page.locator('.admin-page-frame').evaluate((element) => element.getBoundingClientRect().width);
  expect(contentWidth).toBeLessThanOrEqual(1600);
  expect(contentWidth).toBeGreaterThan(1440);
  const metricColumns = await page.locator('.admin-summary-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(metricColumns).toBe(4);
  await expect(page.locator('.admin-page-frame .page-heading')).toHaveCSS('position', 'sticky');

  await page.getByRole('button', { name: '社区', exact: true }).click();
  await expect(page.getByRole('heading', { name: '玩家社区入口', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '世界概况', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '藏品', exact: true }).click();
  await expect(page.getByRole('heading', { name: '上传藏品', exact: true })).toBeVisible();
  await expect(page.getByText('暂无藏品。', { exact: true })).toBeVisible();
  const collectibleColumns = await page.locator('.admin-section-stack').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(collectibleColumns).toBe(2);

  await page.getByRole('button', { name: '礼品码', exact: true }).click();
  await expect(page.getByRole('heading', { name: '创建礼品码', exact: true })).toBeVisible();
  await expect(page.getByText('暂无礼品码。', { exact: true })).toBeVisible();
  const giftColumns = await page.locator('.admin-section-stack').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(giftColumns).toBe(2);

  await page.getByRole('button', { name: '账号封禁', exact: true }).click();
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

test('admin navigation becomes a horizontal client-style bar on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await configureAdminRoutes(page);
  await page.goto('/economy/admin');

  await expect(page.locator('.admin-sidebar')).toBeHidden();
  const navigation = page.getByRole('navigation', { name: '管理员移动导航' });
  const mobileBottomNavigation = page.locator('.admin-mobile-bottom-navigation');
  await expect(navigation).toBeVisible();
  await expect(mobileBottomNavigation).toBeVisible();
  await expect(page.locator('.admin-mobile-navigation')).toHaveCount(0);
  await expect(mobileBottomNavigation.locator('.liquid-glass-surface')).toHaveCount(1);
  await expect(mobileBottomNavigation.locator('.mobile-bottom-navigation__viewport')).toHaveCount(1);

  const geometry = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>('.admin-mobile-bottom-navigation');
    const scroll = document.querySelector<HTMLElement>('.admin-page-scroll');
    if (!nav || !scroll) throw new Error('管理员移动导航结构缺失');
    const navRect = nav.getBoundingClientRect();
    const scrollStyle = getComputedStyle(scroll);
    return {
      navHeight: navRect.height,
      navBottomGap: window.innerHeight - navRect.bottom,
      scrollPaddingBottom: Number.parseFloat(scrollStyle.paddingBottom),
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(geometry.navHeight).toBe(68);
  expect(geometry.navBottomGap).toBeGreaterThanOrEqual(0);
  expect(geometry.navBottomGap).toBeLessThanOrEqual(20);
  expect(geometry.scrollPaddingBottom).toBeGreaterThan(geometry.navHeight);
  expect(geometry.documentOverflow).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: '账号封禁', exact: true }).click();
  await expect(page.getByRole('heading', { name: '同 IP 账号封禁', exact: true })).toBeVisible();
  await expect(page.locator('.admin-ban-incidents .virtual-list__canvas')).toHaveCount(1);
});
