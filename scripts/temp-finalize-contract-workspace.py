from pathlib import Path
import re

BRANCH = 'feature/daily-regional-supply-contracts-impl'

# 1. The public ContractPage is only a stable route wrapper. Remove the dead legacy page implementation
# so architecture guards cannot accidentally validate code that is never rendered.
Path('src/pages/ContractPage.tsx').write_text("""import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { ContractWorkspacePage } from './ContractWorkspacePage';

export function ContractPage({ model }: { model: TutorialAwareGameViewModel }) {
  return <ContractWorkspacePage model={model} />;
}
""")

# 2. Finish the real workspace: legacy proposal resolution, explicit attention tag, complete asset filter.
p = Path('src/pages/ContractWorkspacePage.tsx')
text = p.read_text()
text = text.replace(
"""  type ContractHistoryQuery,
  type CreateProductionContractInput,
} from '../contracts/api';
""",
"""  type ContractHistoryQuery,
  type CreateProductionContractInput,
} from '../contracts/api';
""",
1,
)

legacy_section = r'''
function LegacyRenewalResolution({ contract, busy, run }: { contract: ProductionContract; busy: boolean; run: RunAction }) {
  const proposal = contract.kind === 'supply' && contract.supplyMode !== 'daily' ? contract.renewalProposal : null;
  if (!proposal) return null;
  const terms = proposal.terms;
  const approvedCount = Number(Boolean(proposal.buyerApproved)) + Number(Boolean(proposal.supplierApproved));
  const pendingText = proposal.approvedByMe ? '你已同意，等待合作方确认' : '等待你确认旧合同续签条款';
  return (
    <section className="contract-renewal-panel" aria-label="旧合同续签兼容">
      <div className="contract-renewal-heading">
        <div><strong>旧合同续签</strong><span>{proposal.status === 'proposed' ? pendingText : proposal.status === 'accepted' ? '双方已同意，当前旧合同完成后生效' : '关联旧合同已经生效'}</span></div>
        <StatusTag tone={proposal.status === 'accepted' || proposal.status === 'activated' ? 'success' : 'info'}>{proposal.status === 'proposed' ? `${approvedCount}/2 已同意` : proposal.status === 'accepted' ? '已锁定' : '已生效'}</StatusTag>
      </div>
      <p className="contract-section-description">该区域只处理已经存在的旧有限批次续签，不会把批次、交付周期或续签入口恢复到新每日额度合同。</p>
      <DataList className="compact contract-renewal-summary">
        <DataRow label="每批数量" value={<CompactNumber value={terms.quantityPerDelivery} />} />
        <DataRow label="单位价格" value={<CurrencyAmount>{formatCurrency(terms.unitPrice)}</CurrencyAmount>} />
        <DataRow label="交付周期" value={dayLabel(msAsDays(terms.deliveryIntervalMs))} />
        <DataRow label="总批次" value={terms.totalDeliveries === null ? '旧长期合同' : `${formatNumber(terms.totalDeliveries)} 批`} />
        <DataRow label="采购方确认" value={<StatusTag tone={proposal.buyerApproved ? 'success' : 'neutral'}>{proposal.buyerApproved ? '已同意' : '待确认'}</StatusTag>} />
        <DataRow label="供应方确认" value={<StatusTag tone={proposal.supplierApproved ? 'success' : 'neutral'}>{proposal.supplierApproved ? '已同意' : '待确认'}</StatusTag>} />
      </DataList>
      {proposal.status === 'proposed' ? <div className="contract-renewal-actions">
        {proposal.approvedByMe
          ? <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:renewal-revoke`, () => productionContractActions.revokeRenewal(contract.id))}>撤销同意</Button>
          : <Button disabled={busy} onClick={() => void run(`${contract.id}:renewal-accept`, () => productionContractActions.acceptRenewal(contract.id))}>同意续签</Button>}
        {proposal.isProposer
          ? <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:renewal-cancel`, () => productionContractActions.rejectRenewal(contract.id))}>取消续签提议</Button>
          : !proposal.approvedByMe
            ? <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:renewal-reject`, () => productionContractActions.rejectRenewal(contract.id))}>拒绝续签</Button>
            : null}
      </div> : null}
    </section>
  );
}

'''
anchor = 'function ActiveContractCard('
if legacy_section.strip() not in text:
    if anchor not in text:
        raise SystemExit('missing ActiveContractCard anchor')
    text = text.replace(anchor, legacy_section + anchor, 1)

old_tags = """<div className=\"contract-card-tags\"><StatusTag tone={statusTone(contract)}>{confirmedDefault ? '已违约待解除' : STATUS_LABELS[contract.status]}</StatusTag><StatusTag>{roleTag(contract)}</StatusTag></div>"""
new_tags = """<div className=\"contract-card-tags\"><StatusTag tone={statusTone(contract)}>{confirmedDefault ? '已违约待解除' : STATUS_LABELS[contract.status]}</StatusTag><StatusTag>{roleTag(contract)}</StatusTag>{needsAttention && !confirmedDefault ? <StatusTag tone=\"warning\">待处理</StatusTag> : null}</div>"""
if old_tags not in text:
    raise SystemExit('missing active tag anchor')
text = text.replace(old_tags, new_tags, 1)

old_priority = """      {!confirmedDefault ? <SupplyPriorityEditor contract={contract} busy={busy} run={run} /> : null}
    </PagePanel>
"""
new_priority = """      {!confirmedDefault ? <SupplyPriorityEditor contract={contract} busy={busy} run={run} /> : null}
      {!confirmedDefault ? <LegacyRenewalResolution contract={contract} busy={busy} run={run} /> : null}
    </PagePanel>
"""
if old_priority not in text:
    raise SystemExit('missing legacy renewal render anchor')
text = text.replace(old_priority, new_priority, 1)

old_filter = """<SelectInput label=\"合同标的\" value={historyProductId} onChange={(event) => setHistoryProductId(event.target.value)}><option value=\"\">全部标的</option>{model.game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput>"""
new_filter = """<SelectInput label=\"合同标的\" value={historyProductId} onChange={(event) => setHistoryProductId(event.target.value)}><option value=\"\">全部标的</option><option value=\"credits\">普通货币</option>{model.game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}{model.game.facilityTypes.map((facility) => <option key={`facility:${facility.id}`} value={`facility:${facility.id}`}>{facility.name}</option>)}</SelectInput>"""
if old_filter not in text:
    raise SystemExit('missing history target filter anchor')
text = text.replace(old_filter, new_filter, 1)
p.write_text(text)

# 3. Server asset selector semantics for history filters.
p = Path('server/src/contract-audit-store.js')
text = p.read_text()
old = """  if (options.productId) {
    clauses.push('product_id = ?');
    values.push(String(options.productId));
  }
"""
new = """  if (options.productId) {
    const target = String(options.productId);
    if (target === 'credits') {
      clauses.push(\"json_extract(contract_json, '$.kind') = 'loan'\");
    } else if (target.startsWith('facility:')) {
      clauses.push(\"json_extract(contract_json, '$.kind') = 'facility_lease'\");
      clauses.push(\"json_extract(contract_json, '$.facilityTypeId') = ?\");
      values.push(target.slice('facility:'.length));
    } else {
      clauses.push(\"json_extract(contract_json, '$.kind') = 'supply'\");
      clauses.push('product_id = ?');
      values.push(target);
    }
  }
"""
if old not in text:
    raise SystemExit('missing history product filter server anchor')
text = text.replace(old, new, 1)
p.write_text(text)

# 4. Keep design documentation authoritative for the selector encoding.
p = Path('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md')
text = p.read_text()
anchor = """`GET /api/game/contracts/history` 必须在一次分页查询中返回合同原始条款与服务器终态摘要。终态摘要固定包含稳定结束原因、权威结束时间、按合同领域表达的完成数量／总量／比例，以及当前玩家视角的结束统计；赔付款必须区分“当前玩家支付”和“当前玩家获得”，不得只返回无方向的总额。商品合作统计累计交付、货款、服务费和净收入；玩家借贷统计本金发放、实际偿还和抵押工厂处置／退回；工厂租赁统计已结算期数、租金、服务费和净收入。资金、商品、保证金和抵押返还只统计实际审计转移，旧合同缺少转移事件时返回部分完整标记并保持缺失项为零。
"""
addition = anchor + "\n历史查询的 `productId` 参数兼作玩家可见“合同标的”选择器：普通商品直接使用商品 ID，`credits` 只匹配玩家借贷，`facility:<facilityTypeId>` 只匹配对应工厂类型的工厂租赁；服务器必须同时约束合同领域与标的，不能把货币或工厂选择器当作商品 ID 查询，也不能只在客户端假筛选。\n"
if anchor not in text:
    raise SystemExit('missing server design history anchor')
if '历史查询的 `productId` 参数兼作玩家可见“合同标的”选择器' not in text:
    text = text.replace(anchor, addition, 1)
p.write_text(text)

# 5. Convert runtime fixtures so the browser suite exercises both legacy compatibility and the new daily model.
p = Path('tests/browser/runtime-harness.tsx')
text = p.read_text()
for contract_id, daily_max, used, delivered, duration in [
    ('contract-active-normal', 60, 20, 120, 30),
    ('contract-open', 80, 0, 0, 30),
]:
    marker = f"""          id: '{contract_id}',
          kind: 'supply',
"""
    replacement = marker + f"""          supplyMode: 'daily',
          provinceId: '110000',
          dailyMaxQuantity: {daily_max},
          dailyUsedQuantity: {used},
          dailyRemainingQuantity: {daily_max - used},
          totalDeliveredQuantity: {delivered},
          completedDeliveryEvents: {2 if delivered else 0},
          durationDays: {duration},
          startDelayDays: 0,
"""
    if marker not in text:
        raise SystemExit(f'missing runtime fixture {contract_id}')
    text = text.replace(marker, replacement, 1)
p.write_text(text)

# 6. Static guards must validate the rendered workspace, not the dead route wrapper.
Path('scripts/verify-contract-layout.mjs').write_text(r'''import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

const routePath = 'src/pages/ContractPage.tsx';
const pagePath = 'src/pages/ContractWorkspacePage.tsx';
const stylePath = 'src/styles/contracts.css';
const auditStylePath = 'src/styles/contract-audit.css';
const designPath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
const serverDesignPath = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
const browserTestPath = 'tests/browser/contract-layout.spec.ts';
const attentionBrowserTestPath = 'tests/browser/contract-attention-background.spec.ts';
const workspaceTestPath = 'tests/browser/contract-workspace.spec.ts';
const harnessPath = 'tests/browser/runtime-harness.tsx';
const formVerifierPath = 'scripts/verify-form-controls.mjs';
const serverPath = 'server/src/contract-audit-store.js';
const packagePath = 'package.json';

[routePath, pagePath, stylePath, auditStylePath, designPath, serverDesignPath, browserTestPath, attentionBrowserTestPath, workspaceTestPath, harnessPath, formVerifierPath, serverPath, packagePath].forEach(requireFile);

for (const text of [
  "import { ContractWorkspacePage } from './ContractWorkspacePage';",
  'return <ContractWorkspacePage model={model} />;',
]) requireText(routePath, text);
for (const text of ['productionContractActions', 'productionContractAudit', 'PagePanel', 'LegacyRenewalResolution']) forbidText(routePath, text);

for (const text of [
  'PagePanel', 'IntegerInput', 'MoneyInput', 'SelectInput', 'ToggleField', 'parseIntegerDraft',
  'role="tablist"', 'role="tab"', 'role="tabpanel"', "type PersonalContractView = 'active' | 'history'",
  'contract-content-actions', 'contract-summary-grid', 'contract-workspace', 'contract-market-pane', 'contract-market-grid',
  'contract-personal-pane', 'contract-personal-tabs', 'contract-active-grid', 'contract-publish-layout', 'contract-type-grid',
  'contract-history-panel', 'contract-history-result-grid', '每日最大供应量', '合同时间（天，可选）', '开始延迟（天）',
  '今日已使用', '今日剩余额度', '累计交付', '自动准备商品', '自动补充货款', '按当前日结束',
  'LegacyRenewalResolution', '旧合同续签', '该区域只处理已经存在的旧有限批次续签',
  '我的履约档案', '完成事实', '实际交付事件', '重新拟定', '<option value="credits">普通货币</option>', 'value={`facility:${facility.id}`}',
]) requireText(pagePath, text);
for (const text of ['总交付批次（可选）', '首次交付（分钟）', '首次交付（小时）']) forbidText(pagePath, text);
const pageSource = read(pagePath);
if (pageSource.indexOf('className="contract-content-actions"') > pageSource.indexOf('className="contract-summary-grid"')) failures.push('合同正文发布按钮必须位于摘要卡之前');
if (pageSource.indexOf('className="contract-summary-grid"') > pageSource.indexOf('className="contract-workspace"')) failures.push('合同摘要必须位于工作区之前');

for (const text of [
  '.contract-summary-grid', 'grid-template-columns: repeat(4, minmax(0, 1fr));', '.contract-workspace {', 'gap: var(--layout-gutter);',
  '.contract-active-grid {', '.contract-personal-tabs {', 'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '.contract-workspace .contract-card--attention {', '.contract-publish-layout', '.contract-history-panel',
  '@media (max-width: 1399px)', '@media (max-width: 960px)', '@media (max-width: 720px)',
]) requireText(stylePath, text);
for (const text of ['.contract-history-result-grid', '.contract-history-entry', '.contract-history-republish']) requireText(auditStylePath, text);
forbidText(stylePath, '--page-section-gap');

for (const text of [
  '玩家新发布的商品采购／供应合同统一使用地区化每日额度模型', '新每日额度商品合同不使用续签',
  '旧有限批次商品合同的当前批次、续签、宽限与受偿方主动解除界面只保留兼容展示',
  '合同标的覆盖商品、普通货币和工厂类型', '玩家历史页不展开、不加载审计事件时间线',
  '作为 `PageLayout` 自动生成的 `.ui-page-stack` 直接子元素',
]) requireText(designPath, text);
requireText(serverDesignPath, '历史查询的 `productId` 参数兼作玩家可见“合同标的”选择器');
for (const text of ["target === 'credits'", "target.startsWith('facility:')", "json_extract(contract_json, '$.facilityTypeId') = ?"]) requireText(serverPath, text);

for (const text of [
  'desktop contract workspace uses shared controls and dense two-column layouts',
  'tablet contract publish form keeps two-column fields',
  'mobile contract workspace keeps two-column summaries, scrollable tabs and full-size inputs',
  'narrow mobile contract tabs keep two stable hit areas',
  "getByLabel('每日最大供应量')", "getByLabel('合同时间（天，可选）')", "getByLabel('开始延迟（天）')",
  "getByText('完成事实'", "getByText('我的履约档案'", 'auditRequestCount()',
]) requireText(browserTestPath, text);

for (const text of ['pending contract card keeps warning tint over panel material', '.contract-card--attention', '.contract-card--normal']) requireText(attentionBrowserTestPath, text);
for (const text of ['contract market stays visible while personal contracts switch views', "getByRole('region', { name: '合同广场' })", "getByRole('region', { name: '我的合同' })"]) requireText(workspaceTestPath, text);
for (const text of [
  "import { ContractPage } from '../../src/pages/ContractPage';", '<ContractPage model={model} />', "id: 'contract-active'", "renewalProposal:",
  "id: 'contract-active-normal'", "supplyMode: 'daily'", "dailyMaxQuantity: 60", "id: 'contract-open'",
]) requireText(harnessPath, text);
requireText(formVerifierPath, "'src/pages/ContractWorkspacePage.tsx'");
for (const text of ['"verify:contract-layout": "node scripts/verify-contract-layout.mjs"', 'node scripts/verify-contract-layout.mjs']) requireText(packagePath, text);

if (failures.length) {
  console.error(`合同页统一布局验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('合同页现行工作区、新每日额度、旧合同兼容、历史标的筛选和响应式回归验证通过。');
''')

p = Path('scripts/verify-form-controls.mjs')
text = p.read_text().replace("'src/pages/ContractPage.tsx'", "'src/pages/ContractWorkspacePage.tsx'")
p.write_text(text)

p = Path('scripts/verify-contract-audit.mjs')
text = p.read_text()
anchor = "assert.ok(!contractPage.includes('合同完整审计'), 'player history must not expose the audit viewer');"
extra = """\nincludesAll(contractPage, ['<option value=\"credits\">普通货币</option>', 'value={`facility:${facility.id}`}'], 'contract history target filters');
includesAll(store, [\"target === 'credits'\", \"target.startsWith('facility:')\", \"json_extract(contract_json, '$.facilityTypeId') = ?\"], 'contract history server target filtering');"""
if anchor not in text:
    raise SystemExit('missing contract audit verifier anchor')
if "contract history server target filtering" not in text:
    text = text.replace(anchor, anchor + extra, 1)
p.write_text(text)

# 7. Browser regression now follows the real daily workspace and explicitly proves the player page never asks for /audit.
Path('tests/browser/contract-layout.spec.ts').write_text(r'''import { expect, test, type Locator, type Page } from '@playwright/test';

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
  await expect(page.getByRole('tab', { name: /进行中的合同/ })).toHaveAttribute('aria-selected', 'true');
}

test('desktop contract workspace uses shared controls and dense two-column layouts', async ({ page }) => {
  const audit = await mockContractAudit(page);
  await openContracts(page, 1440, 900);

  const publishAction = page.locator('.contract-content-actions').getByRole('button', { name: '发布合同', exact: true });
  await expect(publishAction).toBeVisible();
  await expect(page.locator('.page-fixed-header').getByRole('button', { name: '发布合同', exact: true })).toHaveCount(0);
  expect(await gridTrackCount(page.locator('.contract-summary-grid'))).toBe(4);
  expect(await gridTrackCount(page.locator('.contract-workspace'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-market-grid'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-active-grid'))).toBe(2);
  await expect(page.locator('.contract-active-grid .contract-card').first()).toHaveClass(/contract-card--attention/);
  await expect(page.locator('.contract-active-grid .contract-card').first().getByText('待处理', { exact: true })).toBeVisible();
  const renewal = page.locator('.contract-active-grid .contract-card').first().locator('.contract-renewal-panel');
  await expect(renewal.getByText('旧合同续签', { exact: true })).toBeVisible();
  await expect(renewal.getByText('采购方确认', { exact: true })).toBeVisible();
  await expect(renewal.getByText('供应方确认', { exact: true })).toBeVisible();
  await expect(renewal.getByText('1/2 已同意', { exact: true })).toBeVisible();
  await expect(renewal.getByRole('button', { name: '同意续签', exact: true })).toBeVisible();
  await expect(page.getByText('我的履约档案', { exact: true })).toBeVisible();
  await expectPersonalContractTabs(page);
  await expectUniformPageSectionGaps(page);

  await page.getByRole('tab', { name: /进行中的合同/ }).click();
  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(2);
  await expect(page.locator('.contract-type-option')).toHaveCount(6);
  await expect(page.locator('.contract-type-option').filter({ hasText: '采购合同' })).toHaveAttribute('aria-pressed', 'true');

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
  await expect(page.locator('.contract-publish-preview').getByText('长期合同', { exact: true })).toBeVisible();
  await expect(submit).toBeEnabled();

  await page.getByRole('tab', { name: /历史合同/ }).click();
  await expect(page.locator('.contract-history-entry')).toHaveCount(1);
  await expect(page.getByLabel('合同标的').getByRole('option', { name: '普通货币' })).toHaveCount(1);
  await expect(page.getByLabel('合同标的').getByRole('option', { name: '机械工厂' })).toHaveCount(1);
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
  const audit = await mockContractAudit(page);
  await openContracts(page, 390, 844);
  expect(await gridTrackCount(page.locator('.contract-summary-grid'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-workspace'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-market-grid'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-active-grid'))).toBe(1);
  await expectPersonalContractTabs(page);
  await expectUniformPageSectionGaps(page);

  await page.getByRole('tab', { name: /进行中的合同/ }).click();
  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-publish-grid'))).toBe(1);
  const quantity = page.getByLabel('每日最大供应量');
  const quantityBox = await requireBox(quantity);
  expect(quantityBox.height).toBeGreaterThanOrEqual(48);
  expect(await quantity.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);

  await page.getByRole('tab', { name: /历史合同/ }).click();
  await expect(page.locator('.contract-history-result-grid')).toBeVisible();
  await expect(page.locator('.contract-audit-timeline')).toHaveCount(0);
  expect(audit.auditRequestCount()).toBe(0);
  const republish = page.getByRole('button', { name: '重新拟定', exact: true });
  expect((await requireBox(republish)).width).toBeGreaterThanOrEqual(250);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('narrow mobile contract tabs keep two stable hit areas', async ({ page }) => {
  await mockContractAudit(page);
  await openContracts(page, 320, 844);
  await expectPersonalContractTabs(page);
  await expectUniformPageSectionGaps(page);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
''')
