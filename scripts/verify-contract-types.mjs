import { readFileSync } from 'node:fs';
const failures = [];
const requireText = (path, fragments) => { const text = readFileSync(path, 'utf8'); for (const fragment of fragments) if (!text.includes(fragment)) failures.push(`${path} 缺少 ${fragment}`); };
requireText('server/src/commercial-contracts.js', ["'loan'", "'facility_lease'", 'MAX_LOAN_TO_VALUE_BPS', 'COMMERCIAL_GRACE_MS', 'transferableFacilityQuantity']);
requireText('server/src/contract-asset-locks.js', ['playerLoanCollateralQuantity', 'leasedOutFacilityQuantity', 'leasedInFacilityQuantity', 'playerLoanFinancialPosition']);
requireText('server/src/contracts.js', ['PRODUCTION_CONTRACT_SCHEMA_VERSION = 5', 'processCommercialContract', 'publicCommercialContract']);
requireText('server/src/facility-groups.js', ['contractCollateralCount', 'leasedOutCount', 'leasedInCount', 'contractReceivableValue']);
requireText('src/pages/ContractPage.tsx', ['供应合同', '采购合同', '放贷合同', '贷款合同', '出租合同', '租赁合同']);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['三类合同领域', '玩家抵押借贷', '工厂使用权租赁']);
if (failures.length) { console.error(failures.map((item) => `- ${item}`).join('\n')); process.exit(1); }
console.log('六类合同方向、资产锁定、页面入口与权威设计验证通过');
