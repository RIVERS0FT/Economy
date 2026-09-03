import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/verify-primary-surface-insets.mjs';
let source = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
source = source.replace(
  "  marketRuntimeTest: 'tests/browser/market-runtime.spec.ts',",
  "  marketResponsiveTest: 'tests/browser/market-desktop-cleanup.spec.ts',",
);
const oldBlock = `  requireText(\n    paths.marketRuntimeTest,\n    "await expect(orderEntry).toBeVisible();\\n  await expect(orderBook).toBeVisible();\\n  const mobileOrder = await requireBox(orderEntry);\\n  const mobileBook = await requireBox(orderBook);",\n  );`;
const newBlock = `  for (const text of [\n    "test('desktop market shows daily-price immediate trade without an order book'",\n    "test('mobile market keeps quantity-only immediate trade and recent trades readable'",\n    "await expect(detail.locator('.market-immediate-trade-card')).toBeVisible();",\n    "await expect(detail.locator('#market-trade-quantity')).toBeVisible();",\n    "await expect(page.getByRole('button', { name: '盘口', exact: true })).toHaveCount(0);",\n    'expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);',\n  ]) requireText(paths.marketResponsiveTest, text);`;
if (!source.includes(oldBlock)) throw new Error('找不到旧市场订单簿安全几何断言');
source = source.replace(oldBlock, newBlock);
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of [
  'scripts/codex-align-primary-inset-market.mjs',
  '.github/workflows/codex-align-primary-inset-market.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
