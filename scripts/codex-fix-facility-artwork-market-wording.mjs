import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/verify-facility-artwork.mjs';
let source = readFileSync(path, 'utf8');
const oldText = '建筑详情只承担工厂经营与生产配置，不提供工厂买卖入口、订单簿草稿或从属交易页';
const newText = '建筑详情只承担工厂经营与生产配置，不提供工厂买卖入口、即时交易草稿或从属交易页';
if (!source.includes(oldText)) throw new Error('找不到旧工厂插画市场文案断言');
source = source.replace(oldText, newText);
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of ['scripts/codex-fix-facility-artwork-market-wording.mjs', '.github/workflows/codex-fix-facility-artwork-market-wording.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
