from pathlib import Path

p = Path('scripts/verify-contract-layout.mjs')
text = p.read_text()
old = '''const pageSource = read(pagePath);
if (pageSource.indexOf('className="contract-content-actions"') > pageSource.indexOf('className="contract-summary-grid"')) failures.push('合同正文发布按钮必须位于摘要卡之前');
if (pageSource.indexOf('className="contract-summary-grid"') > pageSource.indexOf('className="contract-workspace"')) failures.push('合同摘要必须位于工作区之前');
'''
new = '''const pageSource = read(pagePath);
const pageLayoutStart = pageSource.indexOf('<PageLayout title="合同"');
const pageActionIndex = pageSource.indexOf('className="contract-content-actions"', pageLayoutStart);
const pageSummaryIndex = pageSource.indexOf('className="contract-summary-grid"', pageLayoutStart);
const pageWorkspaceIndex = pageSource.indexOf('className="contract-workspace"', pageLayoutStart);
if (pageLayoutStart < 0 || pageActionIndex < 0 || pageSummaryIndex < 0 || pageWorkspaceIndex < 0) failures.push('合同 PageLayout 一级结构不完整');
else {
  if (pageActionIndex > pageSummaryIndex) failures.push('合同正文发布按钮必须位于摘要卡之前');
  if (pageSummaryIndex > pageWorkspaceIndex) failures.push('合同摘要必须位于工作区之前');
}
'''
if old not in text:
    raise SystemExit('missing page-level ordering verifier anchor')
p.write_text(text.replace(old, new, 1))

p = Path('scripts/verify-contract-audit.mjs')
text = p.read_text().replace(
    "includesAll(store, [\"target === 'credits'\", \"target.startsWith('facility:')\", \"json_extract(contract_json, '$.facilityTypeId') = ?\"], 'contract history server target filtering');",
    "includesAll(auditStore, [\"target === 'credits'\", \"target.startsWith('facility:')\", \"json_extract(contract_json, '$.facilityTypeId') = ?\"], 'contract history server target filtering');",
)
p.write_text(text)

p = Path('tests/browser/contract-layout.spec.ts')
text = p.read_text().replace(
    "page.locator('.contract-summary-grid')",
    "page.locator('.ui-page-stack > .contract-summary-grid')",
)
p.write_text(text)

p = Path('tests/browser/contract-workspace.spec.ts')
text = p.read_text()
old = '''  await page.route('**/economy-api/game/contracts/history**', async (route) => {
    await route.fulfill({ json: { history: { items: [], nextCursor: null } } });
  });'''
new = '''  await page.route('**/economy-api/game/contracts/history**', async (route) => {
    await route.fulfill({ json: { history: { items: [], nextCursor: null } } });
  });
  await page.route('**/economy-api/game/contracts/performance**', async (route) => {
    await route.fulfill({ json: { performance: { totalEnded: 0, completed: 0, abnormalEnded: 0, defaulted: 0, completionRateBps: 0, compensationPaid: 0, compensationReceived: 0, recent: [] } } });
  });
  await page.route('**/api/game/community-link**', async (route) => {
    await route.fulfill({ json: { communityLink: null } });
  });'''
if old not in text:
    raise SystemExit('missing workspace route mock anchor')
text = text.replace(old, new, 1)
text = text.replace(
    "await expect(market.getByText('采购 机械', { exact: true })).toBeVisible();",
    "await expect(market.getByText('每日额度', { exact: true })).toBeVisible();",
)
p.write_text(text)
