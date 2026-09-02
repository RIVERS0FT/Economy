import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}
function includesAll(content, needles, label) {
  for (const needle of needles) assert.ok(content.includes(needle), `${label} must include ${needle}`);
}

const auditStore = read('server/src/contract-audit-store.js');
const runtimeStore = `${read('server/src/runtime-store-core.js')}\n${read('server/src/runtime-store.js')}`;
const app = read('server/src/app.js');
const statePartitions = read('server/src/state-partitions.js');
const contractApi = read('src/contracts/api.ts');
const contractTypes = read('src/contracts/types.ts');
const contractPage = read('src/pages/ContractWorkspacePage.tsx');
const contractAuditCss = read('src/styles/contract-audit.css');
const serverTests = read('server/test/contract-audit.test.js');
const browserTests = read('tests/browser/contract-layout.spec.ts');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const docsIndex = read('docs/README.md');

includesAll(auditStore, [
  'economy_contract_audit_contracts', 'economy_contract_audit_events', 'economy_contract_audit_transfers',
  'prevent_contract_audit_event_update', 'prevent_contract_audit_event_delete',
  'prevent_contract_audit_transfer_update', 'prevent_contract_audit_transfer_delete',
  'legacy_snapshot_imported', 'audit_completeness', 'source_key TEXT NOT NULL UNIQUE',
  'store.captureContractAuditTransition', 'store.flushContractAuditEvents',
  'store.listContractAuditHistory', 'store.getContractAuditDetail',
  'contractHistorySettlementSummaries', 'endSummary', 'compensationReceivedByMe', 'compensationPaidByMe',
  'contract_default_confirmed', 'contract_default_claimed', 'loan_default_confirmed', 'loan_default_claimed',
], 'contract audit store');
assert.ok(
  runtimeStore.indexOf('const nextRevision = applySegmentedWorldWrite(this, plan, world, now);')
    < runtimeStore.indexOf('this.flushContractAuditEvents(world, revision, nextRevision)')
    && runtimeStore.indexOf('this.flushContractAuditEvents(world, revision, nextRevision)')
      < runtimeStore.indexOf('this.cacheWorld(nextRevision, null, world, false, plan.snapshot);'),
  'audit rows must be flushed after the segmented world write and before the cache advances',
);
includesAll(runtimeStore, ["import { configureContractAuditStore } from './contract-audit-store.js';", 'configureContractAuditStore(this);', 'captureContractAuditTransition(beforeContracts, world'], 'runtime contract audit integration');
includesAll(app, ["path === '/api/game/contracts/history'", 'const contractAuditMatch = path.match(', 'store.listContractAuditHistory', 'store.getContractAuditDetail'], 'contract audit routes');
assert.ok(!statePartitions.includes('contractAudit'));
assert.ok(!statePartitions.includes('contractHistory'));

includesAll(contractApi, ['productionContractAudit', "getJson<{ history: ContractAuditHistoryPage }>('/contracts/history'", 'lender', 'borrower', 'lessor', 'lessee'], 'contract audit client API');
includesAll(contractTypes, ['ContractEndSummary', 'ContractEndSettlementSummary', 'ContractAuditHistoryItem', 'endSummary: ContractEndSummary'], 'contract history client types');
includesAll(contractPage, [
  "import '../styles/contract-audit.css';", 'contract-history-filters', '合同内容', '结束原因', '结束时间',
  '完成事实', '结束统计', '重新拟定', 'productionContractAudit.history', 'startRepublish',
  '我的履约档案', 'productionContractAudit.performance', '实际交付事件',
], 'contract history player UI');
assert.ok(!contractPage.includes('productionContractAudit.detail'), 'player history must not load audit detail timelines');
assert.ok(!contractPage.includes('合同完整审计'), 'player history must not expose the audit viewer');
includesAll(contractPage, ['<option value="credits">普通货币</option>', 'value={`facility:${facility.id}`}'], 'contract history target filters');
includesAll(auditStore, ["target === 'credits'", "target.startsWith('facility:')", "json_extract(contract_json, '$.facilityTypeId') = ?"], 'contract history server target filtering');
includesAll(contractAuditCss, ['.contract-history-filters', '.contract-history-result-grid', '.contract-history-section', '.contract-history-republish'], 'contract history result styles');
assert.ok(!contractAuditCss.includes('.contract-audit-timeline'), 'timeline styles must be removed from player UI');

includesAll(serverTests, [
  '合同审计与世界状态在同一事务提交，逐批资产转移可查询且幂等重试不重复',
  '异常结束统计按当前玩家方向返回赔付款', '审计写入失败时世界状态和审计事件一起回滚',
  '上线前已有合同只导入部分完整摘要，不伪造逐批事件', 'append-only', 'legacy_snapshot_imported',
], 'contract audit server tests');
includesAll(browserTests, ['mockContractAudit', '合同内容', '结束统计', '重新拟定', '.contract-history-result-grid'], 'contract history browser tests');
assert.ok(!browserTests.includes("page.locator('.contract-audit-timeline')).toBeVisible()"), 'browser tests must not restore visible audit timelines');

assert.ok(serverDesign.includes('合同审计'), 'server design must define contract audit authority');
includesAll(docsIndex, ['`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`', '`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`'], 'contract audit design routing');
includesAll(serverDesign, ['economy_contract_audit_contracts', 'economy_contract_audit_events', 'economy_contract_audit_transfers', '/api/game/contracts/history', '/api/game/contracts/:contractId/audit', '终态摘要'], 'server contract audit design');
includesAll(serverDesign, ['合同实际参与者访问', '放贷、贷款、出租、租赁', '第三方不可见'], 'contract audit participant visibility design');
includesAll(pageDesign, ['单张一级', 'PagePanel', '合同内容、结束原因、结束时间、完成事实、结束统计', '重新拟定', '不加载审计事件时间线'], 'page contract history design');

includesAll(auditStore, ["'$.lenderId'", "'$.borrowerId'", "'$.lessorId'", "'$.lesseeId'"], 'commercial contract audit participant visibility');

console.log('Contract audit and compact history verification passed.');
