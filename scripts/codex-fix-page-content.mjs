import { readFileSync, writeFileSync } from 'node:fs';

function replaceRequired(path, replacements) {
  let content = readFileSync(path, 'utf8');
  for (const [before, after] of replacements) {
    if (!content.includes(before)) throw new Error(`${path} verifier source not found: ${before}`);
    content = content.replace(before, after);
  }
  writeFileSync(path, content, 'utf8');
}

function replaceIfPresent(path, replacements) {
  let content = readFileSync(path, 'utf8');
  let changed = false;
  for (const [before, after] of replacements) {
    if (!content.includes(before)) continue;
    content = content.replace(before, after);
    changed = true;
  }
  if (changed) writeFileSync(path, content, 'utf8');
}

replaceRequired('scripts/verify-page-content-base.mjs', [
  ["'formatNumber(order.remaining)'", "'<CompactNumber value={order.remaining} />'"],
  ["'可用 {formatNumber(inventory.available)}'", "'可用 {<CompactNumber value={inventory.available} />}'"],
  ["'冻结 {formatNumber(inventory.frozen)}'", "'冻结 {<CompactNumber value={inventory.frozen} />}'"],
  ["'formatNumber(derived.runningFacilities)'", "'<CompactNumber value={derived.runningFacilities} />'"],
  ["'玩家 Logo、游戏标题和玩家名统一位于状态栏左侧身份轨道'", "'状态栏左侧玩家头像、游戏标题和玩家名统一位于身份轨道'"],
  ["'logoSrc: BRAND_LOGO_URL'", "'playerId: model.user.id'"],
  ["'`formatNumber` 与 `formatCompactNumber` 对绝对值达到 1,000 的数量类显示统一使用 K/M/B/T'", "'数量、普通货币与排名等只读业务数值对绝对值达到 1,000 的内容统一使用 K/M/B/T'"],
  ["'`formatCurrency` 继续遵守普通货币两位显示精度'", "'`formatCurrency` 继续保留普通货币两位精确格式'"],
  ["'数量类值遵循全局固定紧凑数字规则'", "'数量、普通货币与排名等只读业务数值遵循全局固定紧凑规则'"],
  ["'货币值继续遵守两位显示精度'", "'悬停或键盘聚焦时通过共享 Tooltip 显示完整数字'"],
]);

replaceRequired('scripts/verify-production-settlement-layout.mjs', [
  [
    "const quantityStart = formula.indexOf('<strong>{formatNumber(quantity)}</strong>', itemStart);",
    "const quantityStart = formula.indexOf('<strong>{<CompactNumber value={quantity} />}</strong>', itemStart);",
  ],
]);

replaceRequired('scripts/verify-market-assets.mjs', [
  ["'formatNumber(order.remaining)'", "'<CompactNumber value={order.remaining} />'"],
  [
    "'运行中 <strong>{formatNumber(group.participatingCount)}</strong>'",
    "'运行中 <strong>{<CompactNumber value={group.participatingCount} />}</strong>'",
  ],
  [
    "'冻结中 <strong>{formatNumber(group.frozenCount ?? group.listedCount)}</strong>'",
    "'冻结中 <strong>{<CompactNumber value={group.frozenCount ?? group.listedCount} />}</strong>'",
  ],
]);

replaceRequired('scripts/verify-warehouse-expansion.mjs', [
  [
    "'实物库存 {formatNumber(game.warehouseStoredQuantity)}'",
    "'实物库存 {<CompactNumber value={game.warehouseStoredQuantity} />}'",
  ],
]);

replaceIfPresent('tests/browser/all-pages-preview.spec.ts', [
  [
    "toHaveText(['排名', '头像名称', '成绩', '奖励'])",
    "toHaveText(['排名', '玩家', '成绩', '奖励'])",
  ],
]);

console.log('Updated anti-regression rules for compact values and kept the leaderboard player-column migration idempotent.');
