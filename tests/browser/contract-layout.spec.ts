import { expect, test, type Locator, type Page } from '@playwright/test';

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function gridTrackCount(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
}

async function expectUniformPageSectionGaps(page: Page) {
  const result = await page.locator('.ui-page-stack').evaluate((element) => {
    const stack = element as HTMLElement;
    const expected = Number.parseFloat(getComputedStyle(stack).rowGap);
    const children = Array.from(stack.children).filter((child) => {
      const style = getComputedStyle(child);
      const rect = child.getBoundingClientRect();
      return style.display !== 'none' && style.position !== 'absolute' && style.position !== 'fixed' && rect.width > 0 && rect.height > 0;
    });
    const actual = children.slice(1).map((child, index) => child.getBoundingClientRect().top - children[index].getBoundingClientRect().bottom);
    return { expected, actual };
  });
  expect(result.expected).toBeGreaterThan(0);
  for (const gap of result.actual) expect(Math.abs(gap - result.expected)).toBeLessThanOrEqual(1);
}

async function expectWorkspaceTabs(page: Page, columns: number) {
  const container = page.locator('.contract-workspace-tabs');
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(4);
  expect(await gridTrackCount(container)).toBe(columns);
  for (const name of ['工作台', '合同市场', '我的合同', '历史']) {
    const tab = page.getByRole('tab', { name: new RegExp(name) });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
  await page.getByRole('tab', { name: /工作台/ }).click();
}

async function mockContractAudit(page: Page) {
  let auditRequests = 0;
  const contract = {
    id: 'contract-history', kind: 'supply', supplyMode: 'daily', provinceId: '110000',
    publisherSide: 'buyer', publisherId: 123, publisherName: 'MEVIUS', publisherRole: 'buyer',
    buyerId: 123, buyerName: 'MEVIUS', supplierId: 456, supplierName: '历史供应商',
    productId: 'machinery', quantityPerDelivery: 60, dailyMaxQuantity: 60, dailyUsedQuantity: 0,
    dailyRemainingQuantity: 60, totalDeliveredQuantity: 480, completedDeliveryEvents: 8,
    unitPrice: 45, batchGross: 2_700, durationDays: 8, startDelayDays: 0,
    deliveryIntervalMs: 0, totalDeliveries: null, completedDeliveries: 8, firstDeliveryDelayMs: 0,
    createdAt: 1_768_000_000_000, acceptedAt: 1_768_003_600_000, status: 'completed',
    endedAt: 1_768_176_400_000, completedAt: 1_768_176_400_000, terminationReason: null,
    grossTotal: 21_600, feeTotal: 216, netTotal: 21_384, compensationTotal: 0,
    auditCompleteness: 'full', lastEventAt: 1_768_176_400_000,
    isPublisher: true, isBuyer: true, isSupplier: false,
    endSummary: {
      reasonCode: 'completed', endedAt: 1_768_176_400_000,
      completion: { completed: 480, total: null, unit: 'quantity', ratioBps: null },
      settlement: {
        grossTotal: 21_600, feeTotal: 216, netTotal: 21_384, goodsDelivered: 480,
        loanPrincipalDisbursed: 0, loanRepaid: 0, leaseRentPaid: 0,
        compensationPaidByMe: 0, compensationReceivedByMe: 0,
        refundedCreditsToMe: 0, refundedGoodsToMe: 0,
        collateralReceivedByMe: 0, collateralReturnedToMe: 0,
      },
    },
  };
  await page.route('**/economy-api/game/contracts/performance**', async (route) => {
    await route.fulfill({ json: { performance: {
      totalEnded: 1, completed: 1, abnormalEnded: 0, defaulted: 0, completionRateBps: 10_000,
      compensationPaid: 0, compensationReceived: 0,
      recent: [{ id: contract.id, kind: 'supply', status: 'completed', reasonCode: 'completed', endedAt: contract.endedAt }],
    } } });
  });
  await page.route('**/economy-api/game/contracts/history**', async (route) => {
    await route.fulfill({ json: { history: { items: [contract], nextCursor: null } } });
  });
  await page.route('**/api/game/contracts/performance**', async (route) => {
    await route.fulfill({ json: { performance: { totalEnded: 1, completed: 1, abnormalEnded: 0, defaulted: 0, completionRateBps: 10_000, compensationPaid: 0, compensationReceived: 0, recent: [] } } });
  });
  await page.route('**/api/game/community-link**', async (route) => {
    await route.fulfill({ json: { communityLink: null } });
  });
  await page.route('**/economy-api/game/contracts/*/audit**', async (route) => {
    auditRequests += 1;
    await route.fulfill({ status: 500, json: { error: 'player page must not request audit timeline' } });
  });
  return { auditRequestCount: () => auditRequests };
}

async function openContracts(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('runtime-test.html?view=contracts');
  await expect(page.getByRole('heading', { name: '合同', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: /工作台/ })).toHaveAttribute('aria-selected', 'true');
}

test('desktop contract page prioritizes workbench and master detail contract management', async ({ page }) => {
  const audit = await mockContractAudit(page);
  await openContracts(page, 1440, 900);

  const publishAction = page.locator('.contract-content-actions').getByRole('button', { name: '发布合同', exact: true });
  await expect(publishAction).toBeVisible();
  await expect(page.locator('.page-fixed-header').getByRole('button', { name: '发布合同', exact: true })).toHaveCount(0);
  expect(await gridTrackCount(page.locator('.ui-page-stack > .contract-summary-grid'))).toBe(4);
  expect(await gridTrackCount(page.locator('.contract-master-detail').first())).toBe(2);
  await expect(page.locator('.contract-master-list-item')).toHaveCount(1);
  await expect(page.locator('.contract-master-detail-panel .contract-card')).toHaveCount(1);
  await expect(page.getByText('我的履约档案', { exact: true })).toBeVisible();
  await expectWorkspaceTabs(page, 4);
  await expectUniformPageSectionGaps(page);

  await page.getByRole('tab', { name: /我的合同/ }).click();
  const activeCard = page.locator('.contract-master-detail-panel .contract-card');
  await expect(activeCard).toHaveClass(/contract-card--attention/);
  await expect(activeCard.getByText('待处理', { exact: true })).toBeVisible();
  const renewal = activeCard.locator('.contract-renewal-panel');
  await expect(renewal.getByText('旧合同续签', { exact: true })).toBeVisible();
  await expect(renewal.getByText('采购方确认', { exact: true })).toBeVisible();
  await expect(renewal.getByText('供应方确认', { exact: true })).toBeVisible();
  await expect(renewal.getByText('1/2 已同意', { exact: true })).toBeVisible();
  await expect(renewal.getByRole('button', { name: '同意续签', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /合同市场/ }).click();
  expect(await gridTrackCount(page.locator('.contract-market-master-detail'))).toBe(2);
  await expect(page.getByRole('combobox', { name: '合作方向' })).toBeVisible();
  await expect(page.locator('.contract-market-pane .contract-master-detail-panel .contract-card')).toHaveCount(1);

  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(2);
  await expect(page.locator('.contract-type-option')).toHaveCount(6);
  await expect(page.locator('.contract-type-option').filter({ hasText: '采购合同' })).toHaveAttribute('aria-pressed', 'true');
  await expectUniformPageSectionGaps(page);

  const quantity = page.getByLabel('每日最大供应量');
  const submit = page.locator('.contract-publish-panel').getByRole('button', { name: '发布合同', exact: true });
  await quantity.fill('');
  await expect(submit).toBeDisabled();
  await quantity.blur();
  await expect(quantity).toHaveValue('100');
  const duration = page.getByLabel('合同时间（天，可选）');
  await duration.fill('');
  await duration.blur();
  await expect(duration).toHaveValue('');
  await expect(page.getByLabel('开始延迟（天）')).toHaveValue('0');
  await expect(page.locator('.contract-publish-preview')).toContainText('长期合同');
  await expect(submit).toBeEnabled();

  await page.getByRole('tab', { name: '历史', exact: true }).click();
  await expect(page.locator('.contract-history-entry')).toHaveCount(1);
  const targetSelect = page.getByRole('combobox', { name: '合同标的' });
  await targetSelect.click();
  const targetList = page.getByRole('listbox', { name: '合同标的' });
  await expect(targetList.getByRole('option', { name: '普通货币', exact: true })).toBeVisible();
  await expect(targetList.getByRole('option', { name: '机械工厂', exact: true })).toBeVisible();
  await targetSelect.press('Escape');
  await expect(page.getByText('合同内容', { exact: true })).toBeVisible();
  await expect(page.getByText('完成事实', { exact: true })).toBeVisible();
  await expect(page.getByText('实际交付数量', { exact: true })).toBeVisible();
  await expect(page.getByText('实际交付事件', { exact: true })).toBeVisible();
  await expect(page.getByText('结束原因', { exact: true })).toBeVisible();
  await expect(page.getByText('结束时间', { exact: true })).toBeVisible();
  await expect(page.getByText('结束统计', { exact: true })).toBeVisible();
  await expect(page.locator('.contract-audit-timeline')).toHaveCount(0);
  expect(audit.auditRequestCount()).toBe(0);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重新拟定', exact: true }).click();
  await expect(page.getByLabel('每日最大供应量')).toHaveValue('60');
  await expect(page.getByLabel('固定价格')).toHaveValue('45');
  await expect(page.getByLabel('合同时间（天，可选）')).toHaveValue('8');
  await expect(page.getByLabel('开始延迟（天）')).toHaveValue('0');
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('tablet contract page keeps compact master detail and two-column publish fields', async ({ page }) => {
  await mockContractAudit(page);
  await openContracts(page, 1100, 900);
  expect(await gridTrackCount(page.locator('.contract-master-detail').first())).toBe(2);
  await page.getByRole('tab', { name: /合同市场/ }).click();
  expect(await gridTrackCount(page.locator('.contract-market-filters'))).toBe(2);
  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-publish-grid'))).toBe(2);
  await expectUniformPageSectionGaps(page);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('mobile contract page keeps two-column summaries, two-by-two workspace tabs and full-size inputs', async ({ page }) => {
  const audit = await mockContractAudit(page);
  await openContracts(page, 390, 844);
  expect(await gridTrackCount(page.locator('.ui-page-stack > .contract-summary-grid'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-workspace-tabs'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-master-detail').first())).toBe(1);
  await expectUniformPageSectionGaps(page);

  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-publish-grid'))).toBe(1);
  const quantity = page.getByLabel('每日最大供应量');
  const quantityBox = await requireBox(quantity);
  expect(quantityBox.height).toBeGreaterThanOrEqual(48);
  expect(await quantity.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);

  await page.getByRole('tab', { name: '历史', exact: true }).click();
  await expect(page.locator('.contract-history-result-grid')).toBeVisible();
  await expect(page.locator('.contract-audit-timeline')).toHaveCount(0);
  expect(audit.auditRequestCount()).toBe(0);
  const republish = page.getByRole('button', { name: '重新拟定', exact: true });
  expect((await requireBox(republish)).width).toBeGreaterThanOrEqual(250);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('narrow mobile contract workspace keeps four stable two-by-two hit areas', async ({ page }) => {
  await mockContractAudit(page);
  await openContracts(page, 320, 844);
  expect(await gridTrackCount(page.locator('.contract-workspace-tabs'))).toBe(2);
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expectUniformPageSectionGaps(page);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
