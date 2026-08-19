import { expect, test, type Locator, type Page } from '@playwright/test';

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function gridTrackCount(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).gridTemplateColumns
    .split(' ')
    .filter(Boolean)
    .length);
}

async function expectUniformPageSectionGaps(page: Page) {
  const result = await page.locator('.ui-page-stack').evaluate((element) => {
    const stack = element as HTMLElement;
    const expected = Number.parseFloat(getComputedStyle(stack).rowGap);
    const children = Array.from(stack.children).filter((child) => {
      const style = getComputedStyle(child);
      const rect = child.getBoundingClientRect();
      return style.display !== 'none'
        && style.position !== 'absolute'
        && style.position !== 'fixed'
        && rect.width > 0
        && rect.height > 0;
    });
    const actual = children.slice(1).map((child, index) => {
      const previous = children[index];
      return child.getBoundingClientRect().top - previous.getBoundingClientRect().bottom;
    });
    return { expected, actual };
  });

  expect(result.expected).toBeGreaterThan(0);
  expect(result.actual.length).toBeGreaterThan(0);
  for (const gap of result.actual) {
    expect(Math.abs(gap - result.expected)).toBeLessThanOrEqual(1);
  }
}

async function expectPersonalContractTabs(page: Page) {
  const container = page.locator('.contract-personal-tabs');
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(2);
  expect(await gridTrackCount(container)).toBe(2);
  for (let index = 0; index < 2; index += 1) {
    const tab = tabs.nth(index);
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
}

async function mockContractAudit(page: Page) {
  const contract = {
    id: 'contract-history',
    kind: 'supply',
    publisherSide: 'buyer',
    publisherId: 123,
    publisherName: 'MEVIUS',
    publisherRole: 'buyer',
    buyerId: 123,
    buyerName: 'MEVIUS',
    supplierId: 456,
    supplierName: '历史供应商',
    productId: 'machinery',
    quantityPerDelivery: 60,
    unitPrice: 45,
    batchGross: 2_700,
    deliveryIntervalMs: 6 * 60 * 60_000,
    totalDeliveries: 8,
    completedDeliveries: 8,
    firstDeliveryDelayMs: 60 * 60_000,
    createdAt: 1_768_000_000_000,
    acceptedAt: 1_768_003_600_000,
    status: 'completed',
    endedAt: 1_768_176_400_000,
    completedAt: 1_768_176_400_000,
    terminationReason: null,
    defaultParty: null,
    grossTotal: 21_600,
    feeTotal: 216,
    netTotal: 21_384,
    compensationTotal: 0,
    auditCompleteness: 'full',
    lastEventAt: 1_768_176_400_000,
    isPublisher: true,
    isBuyer: true,
    isSupplier: false,
    endSummary: {
      reasonCode: 'completed',
      endedAt: 1_768_176_400_000,
      completion: { completed: 8, total: 8, unit: 'delivery', ratioBps: 10_000 },
      settlement: {
        grossTotal: 21_600, feeTotal: 216, netTotal: 21_384, goodsDelivered: 480,
        loanPrincipalDisbursed: 0, loanRepaid: 0, leaseRentPaid: 0,
        compensationPaidByMe: 0, compensationReceivedByMe: 0,
        refundedCreditsToMe: 0, refundedGoodsToMe: 0,
        collateralReceivedByMe: 0, collateralReturnedToMe: 0,
      },
    },
  };
  const events = [
    {
      sequence: 1,
      eventType: 'contract_published',
      actorType: 'player',
      actorUserId: 123,
      triggerType: 'player_action',
      occurredAt: 1_768_000_000_000,
      batchNumber: null,
      reasonCode: null,
      beforeSnapshot: null,
      afterSnapshot: {},
      metadata: {},
      transfers: [],
    },
    {
      sequence: 2,
      eventType: 'contract_accepted',
      actorType: 'player',
      actorUserId: 456,
      triggerType: 'player_action',
      occurredAt: 1_768_003_600_000,
      batchNumber: 1,
      reasonCode: null,
      beforeSnapshot: {},
      afterSnapshot: {},
      metadata: {},
      transfers: [],
    },
    {
      sequence: 3,
      eventType: 'delivery_completed',
      actorType: 'system',
      actorUserId: null,
      triggerType: 'scheduled_processing',
      occurredAt: 1_768_090_000_000,
      batchNumber: 1,
      reasonCode: null,
      beforeSnapshot: {},
      afterSnapshot: {},
      metadata: { gross: 2_700, fee: 27, plannedAt: 1_768_090_000_000, deliveredAt: 1_768_090_000_000 },
      transfers: [
        { assetType: 'commodity', productId: 'machinery', quantity: 60, fromType: 'player', fromId: 456, fromAccount: 'inventory_frozen', toType: 'player', toId: 123, toAccount: 'inventory_available', purpose: 'delivery_goods' },
        { assetType: 'credits', productId: null, quantity: 2_673, fromType: 'player', fromId: 123, fromAccount: 'credits_frozen', toType: 'player', toId: 456, toAccount: 'credits_available', purpose: 'delivery_net_payment' },
        { assetType: 'credits', productId: null, quantity: 27, fromType: 'player', fromId: 123, fromAccount: 'credits_frozen', toType: 'system', toId: null, toAccount: 'population_employment', purpose: 'market_service_fee' },
      ],
    },
    {
      sequence: 4,
      eventType: 'contract_completed',
      actorType: 'system',
      actorUserId: null,
      triggerType: 'scheduled_processing',
      occurredAt: 1_768_176_400_000,
      batchNumber: 8,
      reasonCode: null,
      beforeSnapshot: {},
      afterSnapshot: {},
      metadata: {},
      transfers: [],
    },
  ];

  await page.route('**/economy-api/game/contracts/history**', async (route) => {
    await route.fulfill({ json: { history: { items: [contract], nextCursor: null } } });
  });
  await page.route('**/economy-api/game/contracts/contract-history/audit**', async (route) => {
    await route.fulfill({ json: { audit: { contract, events, nextCursor: null } } });
  });
}

async function openContracts(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('runtime-test.html?view=contracts');
  await expect(page.getByRole('heading', { name: '合同', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: /进行中的合同/ })).toHaveAttribute('aria-selected', 'true');
}

test('desktop contract workspace uses shared controls and dense two-column layouts', async ({ page }) => {
  await mockContractAudit(page);
  await openContracts(page, 1440, 900);

  const publishAction = page.locator('.contract-content-actions').getByRole('button', { name: '发布合同', exact: true });
  await expect(publishAction).toBeVisible();
  await expect(page.locator('.page-fixed-header').getByRole('button', { name: '发布合同', exact: true })).toHaveCount(0);
  expect(await gridTrackCount(page.locator('.contract-summary-grid'))).toBe(4);
  expect(await gridTrackCount(page.locator('.contract-workspace'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-market-grid'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-active-grid'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-detail-layout').first())).toBe(1);
  const autoFundToggles = page.getByRole('checkbox', { name: '自动补充货款' });
  await expect(autoFundToggles).toHaveCount(2);
  await expect(autoFundToggles.first()).toBeVisible();
  await expect(page.locator('.contract-active-grid .contract-card h2 .product-icon')).toHaveCount(2);
  await expect(page.getByText('采购 机械', { exact: true })).toBeVisible();
  await expect(page.locator('.contract-active-grid .contract-card').first()).toHaveClass(/contract-card--attention/);
  await expect(page.locator('.contract-active-grid .contract-card').first().getByText('待处理', { exact: true })).toBeVisible();
  const renewal = page.locator('.contract-active-grid .contract-card').first().locator('.contract-renewal-panel');
  await expect(renewal.getByText('采购方确认', { exact: true })).toBeVisible();
  await expect(renewal.getByText('供应方确认', { exact: true })).toBeVisible();
  await expect(renewal.getByText('1/2 已同意', { exact: true })).toBeVisible();
  await expect(renewal.getByRole('button', { name: '同意续签', exact: true })).toBeVisible();
  await expectPersonalContractTabs(page);
  await expectUniformPageSectionGaps(page);

  await page.getByRole('tab', { name: /进行中的合同/ }).click();
  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(2);
  await expect(page.locator('.contract-type-grid')).toBeVisible();
  await expect(page.locator('.contract-type-option')).toHaveCount(6);
  const purchaseType = page.locator('.contract-type-option').filter({ hasText: '采购合同' });
  await expect(purchaseType).toHaveCount(1);
  await expect(purchaseType).toHaveAttribute('aria-pressed', 'true');
  await expectUniformPageSectionGaps(page);

  const quantity = page.getByLabel('每批数量');
  const submit = page.locator('.contract-publish-preview').getByRole('button', { name: '发布合同', exact: true });
  await quantity.fill('');
  await expect(quantity).toHaveValue('');
  await expect(submit).toBeDisabled();
  await quantity.blur();
  await expect(quantity).toHaveValue('100');

  const totalDeliveries = page.getByLabel('总交付批次（可选）');
  await totalDeliveries.fill('');
  await totalDeliveries.blur();
  await expect(totalDeliveries).toHaveValue('');
  await expect(page.locator('.contract-publish-preview').getByText('长期', { exact: true })).toBeVisible();
  await expect(submit).toBeEnabled();

  await page.getByRole('tab', { name: /历史合同/ }).click();
  await expect(page.locator('.contract-history-panel')).toHaveCount(1);
  await expect(page.locator('.contract-history-entry')).toHaveCount(1);
  await expect(page.getByText('合同内容', { exact: true })).toBeVisible();
  await expect(page.getByText('完成情况', { exact: true })).toBeVisible();
  await expect(page.getByText('结束原因', { exact: true })).toBeVisible();
  await expect(page.getByText('结束时间', { exact: true })).toBeVisible();
  await expect(page.getByText('结束统计', { exact: true })).toBeVisible();
  await expect(page.getByText('正常完成', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/21,600/).first()).toBeVisible();
  await expect(page.locator('.contract-audit-timeline')).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重新拟定', exact: true }).click();
  await expect(page.locator('.contract-publish-panel')).toBeVisible();
  await expect(page.locator('.contract-type-option').filter({ hasText: '采购合同' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('每批数量')).toHaveValue('60');
  await expect(page.getByLabel('单位价格')).toHaveValue('45');
  await expect(page.getByLabel('总交付批次（可选）')).toHaveValue('8');
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('tablet contract publish form keeps two-column fields', async ({ page }) => {
  await mockContractAudit(page);
  await openContracts(page, 1100, 900);

  expect(await gridTrackCount(page.locator('.contract-workspace'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-market-grid'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-active-grid'))).toBe(1);
  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-publish-grid'))).toBe(2);
  await expectUniformPageSectionGaps(page);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('mobile contract workspace keeps two-column summaries, scrollable tabs and full-size inputs', async ({ page }) => {
  await mockContractAudit(page);
  await openContracts(page, 390, 844);

  expect(await gridTrackCount(page.locator('.contract-summary-grid'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-workspace'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-market-grid'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-active-grid'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-card-heading').first())).toBe(1);
  await expectPersonalContractTabs(page);
  await expectUniformPageSectionGaps(page);

  await page.getByRole('tab', { name: /进行中的合同/ }).click();
  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-publish-grid'))).toBe(1);
  await expectUniformPageSectionGaps(page);

  const quantity = page.getByLabel('每批数量');
  const quantityBox = await requireBox(quantity);
  expect(quantityBox.height).toBeGreaterThanOrEqual(48);
  const quantityFontSize = await quantity.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(quantityFontSize).toBeGreaterThanOrEqual(16);

  await page.getByRole('tab', { name: /历史合同/ }).click();
  await expect(page.locator('.contract-history-entry')).toHaveCount(1);
  await expect(page.locator('.contract-history-result-grid')).toBeVisible();
  await expect(page.locator('.contract-audit-timeline')).toHaveCount(0);
  const republish = page.getByRole('button', { name: '重新拟定', exact: true });
  const republishBox = await requireBox(republish);
  expect(republishBox.width).toBeGreaterThanOrEqual(250);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('narrow mobile contract tabs keep two stable hit areas', async ({ page }) => {
  await mockContractAudit(page);
  await openContracts(page, 320, 844);
  await expectPersonalContractTabs(page);
  await expectUniformPageSectionGaps(page);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
