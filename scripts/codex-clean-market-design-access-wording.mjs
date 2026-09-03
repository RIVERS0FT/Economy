import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md';
let source = readFileSync(path, 'utf8');
const replacements = [
  [
    '服务器在事务内重新读取当日 `officialPrice`、玩家余额、地区库存和解锁资格，并按该价格一次完成结算。',
    '服务器在事务内重新读取当日 `officialPrice`、玩家余额、地区库存和当前业务资格，并按该价格一次完成结算；连续 48 州不存在地区解锁资格。',
  ],
  [
    '只读州仍允许查看今日价格和行情，但不得提交即时交易。',
    '连续 48 州均可提交符合资金、库存及其他正式业务约束的即时交易；页面不得恢复基于地区解锁状态的只读交易分支。',
  ],
];
for (const [from, to] of replacements) {
  if (!source.includes(from)) throw new Error(`找不到待替换市场设计文本: ${from}`);
  source = source.replace(from, to);
}
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of ['scripts/codex-clean-market-design-access-wording.mjs', '.github/workflows/codex-clean-market-design-access-wording.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
