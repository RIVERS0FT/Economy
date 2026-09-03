import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/verify-client-response-performance.mjs';
let source = readFileSync(path, 'utf8');
const from = `const buildingsSource = read('src/pages/BuildingsPage.tsx');
assert.equal(
  (buildingsSource.match(/void model\\.refresh\\(\\{ mode: 'authoritative' \\}\\);/g) || []).length,
  2,
  '建厂采购创建与取消的兼容路径仍必须在动作确认后后台补拉状态',
);
assert.equal(
  (buildingsSource.match(/await model\\.refresh\\(\\{ mode: 'authoritative' \\}\\);/g) || []).length,
  0,
  '建厂采购不得等待动作后的状态补拉才结束交互',
);`;
const to = `const buildingsSource = read('src/pages/BuildingsPage.tsx');
assert.equal(
  (buildingsSource.match(/void model\\.refresh\\(\\{ mode: 'authoritative' \\}\\);/g) || []).length,
  0,
  '建厂缺料已改为报价后原子即时购齐并建造，不得保留创建/取消挂单后的后台状态补拉路径',
);
assert.equal(
  (buildingsSource.match(/await model\\.refresh\\(\\{ mode: 'authoritative' \\}\\);/g) || []).length,
  0,
  '建厂采购不得等待动作后的状态补拉才结束交互',
);`;
if (!source.includes(from)) throw new Error('找不到客户端响应中的旧建厂采购补拉断言');
source = source.replace(from, to);
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of ['scripts/codex-fix-client-response-build-procure.mjs', '.github/workflows/codex-fix-client-response-build-procure.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
