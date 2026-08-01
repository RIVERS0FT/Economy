import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/types.ts';
let content = readFileSync(path, 'utf8');
const from = '  productionMethodGroups: FacilityProductionMethodGroupDefinition[];';
const to = '  productionMethodGroups?: FacilityProductionMethodGroupDefinition[];';
if (!content.includes(to)) {
  if (!content.includes(from)) throw new Error('FacilityTypeDefinition 生产方式字段结构未知');
  content = content.replace(from, to);
  writeFileSync(path, content.replace(/\r\n/g, '\n'));
}
console.log('生产方式目录元数据已标记为向后兼容可选字段。');
