import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const path = 'scripts/verify-industry-catalog.mjs';
const source = readFileSync(path, 'utf8');
const before = "  ['docs/UI_DESIGN_SYSTEM.md', ['当前 31 种正式商品', '服务器未来返回未知商品 ID', '生产方式选择卡']],";
const after = "  ['docs/UI_DESIGN_SYSTEM.md', ['当前 31 种正式商品', '服务器未来返回未知商品 ID', '生产方式下拉选择', '不得恢复 `radiogroup`、选择卡或按钮组']],";
if (!source.includes(before)) throw new Error('industry dropdown verifier target not found');
writeFileSync(path, source.replace(before, after), 'utf8');
rmSync('scripts/agent-fix-industry-production-method-dropdown.mjs');
rmSync('.github/workflows/agent-fix-industry-production-method-dropdown.yml');
