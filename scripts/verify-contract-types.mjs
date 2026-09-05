import { readFileSync } from 'node:fs';
const failures = [];
const requireText = (path, fragments) => { const text = readFileSync(path, 'utf8'); for (const fragment of fragments) if (!text.includes(fragment)) failures.push(`${path} 缺少 ${fragment}`); };
requireText('server/src/commercial-contracts.js', ["'loan'", "'facility_lease'", 'MAX_LOAN_TO_VALUE_BPS', 'COMMERCIAL_GRACE_MS', 'transferableFacilityQuantity', 'lastCompensationFromId']);
requireText('server/src/contract-asset-locks.js', ['playerLoanCollateralQuantity', 'leasedOutFacilityQuantity', 'leasedInFacilityQuantity', 'playerLoanFinancialPosition', 'confirmedDefault']);
requireText('server/src/contract-audit-store.js', ['player_loan_collateral_release', 'player_loan_collateral_remainder_release', 'lease_usage_right_return', 'contract_default_confirmed', 'contract_default_claimed', 'loan_default_confirmed', 'loan_default_claimed', 'lastCompensationFromId', 'lastCompensationToId']);
requireText('server/src/contracts.js', ['PRODUCTION_CONTRACT_SCHEMA_VERSION = 10', 'confirmDefault', 'confirmMarketReserveBuyerDefault', 'claimConfirmedDefault', 'breachedAt', 'processCommercialContract', 'publicCommercialContract']);
requireText('server/src/facility-groups.js', ['contractCollateralCount', 'leasedOutCount', 'leasedInCount', 'contractReceivableValue']);
requireText('src/pages/ContractPage.tsx', ["import { ContractWorkspacePage } from './ContractWorkspacePage';", 'return <ContractWorkspacePage model={model} />;']);
requireText('src/pages/ContractWorkspacePage.tsx', [
  '供应合同', '采购合同', '放贷合同', '贷款合同', '出租合同', '租赁合同',
  "confirmedDefault ? '已违约待解除'", '解除合同并领取违约金', '解除合同并处置冻结',
  '等待受偿方处理', 'Number(isConfirmedDefault(b))', 'canClaimConfirmedDefault', 'defaultClaimLabel',
  'label="贷款本金"', 'label="冻结工厂"', 'label="租赁工厂"', 'label="每期租金"',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['三类合同领域', '玩家冻结借贷', '工厂使用权租赁', '已违约待解除', '宽限结束只确认违约']);
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['已违约待解除', '解除合同并领取违约金', '解除合同并处置冻结']);
if (failures.length) { console.error(failures.map((item) => `- ${item}`).join('\n')); process.exit(1); }
console.log('六类合同方向、资产锁定、现行工作区入口与权威设计验证通过');
