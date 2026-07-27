import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function includesAll(content, needles, label) {
  for (const needle of needles) {
    assert.ok(content.includes(needle), `${label} must include ${needle}`);
  }
}

const auditStore = read('server/src/contract-audit-store.js');
const runtimeStore = read('server/src/runtime-store.js');
const app = read('server/src/app.js');
const statePartitions = read('server/src/state-partitions.js');
const contractApi = read('src/contracts/api.ts');
const contractTypes = read('src/contracts/types.ts');
const contractPage = read('src/pages/ContractPage.tsx');
const contractAuditCss = read('src/styles/contract-audit.css');
const serverTests = read('server/test/contract-audit.test.js');
const browserTests = read('tests/browser/contract-layout.spec.ts');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const industryDesign = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const docsIndex = read('docs/README.md');
const rootReadme = read('README.md');

includesAll(auditStore, [
  'economy_contract_audit_contracts',
  'economy_contract_audit_events',
  'economy_contract_audit_transfers',
  'prevent_contract_audit_event_update',
  'prevent_contract_audit_event_delete',
  'prevent_contract_audit_transfer_update',
  'prevent_contract_audit_transfer_delete',
  'legacy_snapshot_imported',
  'audit_completeness',
  'source_key TEXT NOT NULL UNIQUE',
  'store.captureContractAuditTransition',
  'store.flushContractAuditEvents',
  'store.listContractAuditHistory',
  'store.getContractAuditDetail',
], 'contract audit store');

assert.ok(
  runtimeStore.indexOf('this.updateWorld.run(nextRevision, stateJson, now)')
    < runtimeStore.indexOf('this.flushContractAuditEvents(world, revision, nextRevision)')
    && runtimeStore.indexOf('this.flushContractAuditEvents(world, revision, nextRevision)')
      < runtimeStore.indexOf('this.cacheWorld(nextRevision, stateJson, world)'),
  'audit rows must be flushed after the world write and before the cache advances',
);
includesAll(runtimeStore, [
  "import { configureContractAuditStore } from './contract-audit-store.js';",
  'configureContractAuditStore(this);',
  'captureContractAuditTransition(beforeContracts, world',
], 'runtime contract audit integration');

includesAll(app, [
  "path === '/api/game/contracts/history'",
  'const contractAuditMatch = path.match(',
  'store.listContractAuditHistory',
  'store.getContractAuditDetail',
], 'contract audit routes');

assert.ok(!statePartitions.includes('contractAudit'), 'audit data must not enter six-partition state delivery');
assert.ok(!statePartitions.includes('contractHistory'), 'audit history must not enter contract partition');

includesAll(contractApi, [
  'productionContractAudit',
  "getJson<{ history: ContractAuditHistoryPage }>('/contracts/history'",
  'getJson<{ audit: ContractAuditDetail }>(',
], 'contract audit client API');
includesAll(contractTypes, [
  'ContractAuditCompleteness',
  'ContractAuditHistoryItem',
  'ContractAuditEvent',
  'ContractAuditTransfer',
  'ContractAuditDetail',
], 'contract audit client types');
includesAll(contractPage, [
  "import '../styles/contract-audit.css';",
  '合同历史筛选',
  '完整审计',
  '旧数据摘要',
  '合同完整审计',
  'productionContractAudit.history',
  'productionContractAudit.detail',
  'data-ui-interactive="surface"',
], 'contract audit player UI');
includesAll(contractAuditCss, [
  '.contract-history-filters',
  '.contract-audit-summary-grid',
  '.contract-audit-timeline',
  '.contract-audit-transfers',
], 'contract audit styles');

includesAll(serverTests, [
  '合同审计与世界状态在同一事务提交，逐批资产转移可查询且幂等重试不重复',
  '审计写入失败时世界状态和审计事件一起回滚',
  '上线前已有合同只导入部分完整摘要，不伪造逐批事件',
  'append-only',
  'legacy_snapshot_imported',
], 'contract audit server tests');
includesAll(browserTests, [
  'mockContractAudit',
  '该合同从发布开始具有完整服务器审计记录',
  '.contract-audit-event',
  '.contract-audit-timeline',
], 'contract audit browser tests');

for (const [label, content] of [
  ['page design', pageDesign],
  ['industry design', industryDesign],
  ['server design', serverDesign],
  ['document authority index', docsIndex],
  ['root README', rootReadme],
]) {
  assert.ok(content.includes('合同审计'), `${label} must define contract audit rules`);
}
includesAll(serverDesign, [
  'economy_contract_audit_contracts',
  'economy_contract_audit_events',
  'economy_contract_audit_transfers',
  '/api/game/contracts/history',
  '/api/game/contracts/:contractId/audit',
], 'server contract audit design');
includesAll(pageDesign, [
  '单张一级 `PagePanel`',
  '按需加载',
  '旧数据摘要',
], 'page contract audit design');

console.log('Contract audit verification passed.');
