import { readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content); }
function walk(root) {
  const files = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path.replaceAll('\\', '/'));
  }
  return files;
}
function update(path, transform) {
  const source = read(path);
  const next = transform(source);
  if (next === source) throw new Error(`${path}: no update produced`);
  write(path, next);
}
function ensureSentence(source, sentence) {
  return source.includes(sentence) ? source : `${source.trimEnd()}\n\n${sentence}\n`;
}

for (const root of ['scripts', 'server/test', 'server/src', 'tests/browser']) {
  for (const path of walk(root).filter((item) => /\.(?:js|mjs|ts|tsx)$/.test(item))) {
    let source = read(path);
    source = source
      .replaceAll('CURRENT_CLIENT_STATE_VERSION = 24', 'CURRENT_CLIENT_STATE_VERSION = 25')
      .replaceAll('MIN_COMPATIBLE_CLIENT_STATE_VERSION = 24', 'MIN_COMPATIBLE_CLIENT_STATE_VERSION = 25')
      .replace(/\bversion:\s*24\b/g, 'version: 25');
    write(path, source);
  }
}

update('src/styles/facility-group-card-grid.css', (source) => source.replace(
  '$' + '{anchor}',
  `.facility-group-card > * {
  min-width: 0;
  margin-inline: 0;
}`,
));

update('src/styles/production-methods.css', (source) => source.replace(
  /\n\.facility-production-method-summary \{[\s\S]*?\n\}\n\n\.facility-production-method-summary span \{[\s\S]*?\n\}\n?/,
  '\n',
));

update('scripts/verify-production-methods.mjs', (source) => {
  source = source
    .replace("  'const selectedPlan = selectedMethod?.plansByRecipeId[recipeState.selectedBaseRecipeId];',\n", '')
    .replace("  'facility-production-method-summary',\n", '')
    .replace(
      "assert.ok(styleSource.includes('.facility-production-method-summary'));",
      "assert.equal(styleSource.includes('.facility-production-method-summary'), false, '生产方式规格摘要必须删除');",
    )
    .replace("  \"summary.locator('small')\",\n", '')
    .replace("  \"not.toContainText('缩短周期并提高成本')\",\n", "  \"not.toContainText('缩短周期并提高成本')\",\n  \"locator('.facility-production-method-summary')).toHaveCount(0)\",\n")
    .replace('CURRENT_CLIENT_STATE_VERSION = 24', 'CURRENT_CLIENT_STATE_VERSION = 25')
    .replace('MIN_COMPATIBLE_CLIENT_STATE_VERSION = 24', 'MIN_COMPATIBLE_CLIENT_STATE_VERSION = 25')
    .replace(
      "    '作业制度下方只显示周期、单周期产出和周期成本',",
      "    '生产设置下方不得再显示“周期 · 产出 · 成本”摘要',",
    );
  return source;
});

const runningFormulaAuthority = '运行中公式使用 `participatingCount`、实时投影的 `staffingRateBps` 和跨周期 `staffingBatchCarryBps`，在周期完成时计算整数等效产能';
const inactiveFormulaAuthority = '停止或异常使用 `productionAvailableCount`、实时投影的满员率和 `staffingBatchCarryBps` 计算启动后或恢复后的整数等效产能';
const detailHierarchyAuthority = '当前工厂详情正文按“插画与满员率 → 生产设置 → 生产结算”组织';
const settlementCompositionAuthority = '公式、操作数据带、进度和单厂平均利润共同组成一张“生产结算”卡';

update('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', (source) => {
  source = source
    .replace(
      '当前周期显示 `participatingCount`、`staffingRateBps` 和 `周期完成时整数等效产能`；停止或异常使用 `nextCycleCount`、预计满员率与 `nextCycleEffectiveCount` 表示启动后或恢复后的集群能力。',
      `${runningFormulaAuthority}；${inactiveFormulaAuthority}。`,
    )
    .replace(
      '当前周期显示 `participatingCount`、`staffingRateBps` 和 `projectedEffectiveCount`；停止或异常使用 `nextCycleCount`、预计满员率与 `nextCycleEffectiveCount` 表示启动后或恢复后的集群能力。',
      `${runningFormulaAuthority}；${inactiveFormulaAuthority}。`,
    );
  source = ensureSentence(source, `${runningFormulaAuthority}；${inactiveFormulaAuthority}。`);
  return source;
});

update('docs/UI_DESIGN_SYSTEM.md', (source) => {
  source = source
    .replace(
      '停止或异常使用 `nextCycleCount`、预计满员率与 `nextCycleEffectiveCount`',
      inactiveFormulaAuthority,
    )
    .replace(
      '当前工厂详情正文先显示 256px 工厂场景插画横幅',
      detailHierarchyAuthority,
    )
    .replace(
      '公式、进度和单厂平均利润共同组成一张“生产结算”卡',
      settlementCompositionAuthority,
    );
  source = ensureSentence(source, `${runningFormulaAuthority}；${inactiveFormulaAuthority}。`);
  source = ensureSentence(source, `${detailHierarchyAuthority}；${settlementCompositionAuthority}。`);
  return source;
});

update('scripts/verify-unified-factory-recipes-grid.mjs', (source) => source
  .replace(
    "  '<FacilityStaffingSummary entry={entry} />',",
    "  '<FacilityStaffingSummary entry={entry} now={now} />',",
  )
  .replace("  'facility-formula-scope',\n", '')
  .replace(
    "  'facility-formula-next-cycle',\n",
    "  'facility-formula-next-cycle',\n  'facility-formula-scope',\n",
  )
  .replace("  '@container (max-width: 479px)',\n", '')
  .replace(
    "  '@media (max-width: 359px)',\n",
    "  '@media (max-width: 359px)',\n  '@container (max-width: 479px)',\n",
  )
  .replace(
    `const settingsRule = css.slice(
  css.indexOf('.facility-production-settings {'),
  css.indexOf('.facility-production-formula {'),
);`,
    `const settingsRuleStart = css.indexOf('.facility-production-settings {');
const settingsRule = css.slice(settingsRuleStart, css.indexOf('}', settingsRuleStart) + 1);`,
  )
  .replace(
    "for (const text of ['.facility-formula-scope', 'justify-self: end;', 'font-variant-numeric: tabular-nums;'])",
    "for (const text of ['.facility-formula-side-label', 'font-variant-numeric: tabular-nums;'])",
  )
  .replace(
    "  assert.equal(formulaCss.includes(text), true, `生产公式样式缺少: ${text}`);",
    "  assert.equal(formulaCss.includes(text), true, `生产公式样式缺少: ${text}`);\nassert.equal(formulaCss.includes('.facility-formula-scope'), false, '生产结算范围长描述样式必须删除');",
  )
  .replace(
    "      '当前周期显示 `participatingCount`、`cycleStaffingRateBps` 和 `cycleEffectiveCount`',",
    `      '${runningFormulaAuthority}',`,
  )
  .replace(
    "      '当前周期显示 `participatingCount`、`staffingRateBps` 和 `projectedEffectiveCount`',",
    `      '${runningFormulaAuthority}',`,
  )
  .replace(
    "      '停止或异常使用 `nextCycleCount`、预计满员率与 `nextCycleEffectiveCount`',",
    `      '${inactiveFormulaAuthority}',`,
  )
  .replace(
    "      '当前工厂详情正文先显示 256px 工厂场景插画横幅',",
    `      '${detailHierarchyAuthority}',`,
  )
  .replace(
    "      '公式、进度和单厂平均利润共同组成一张“生产结算”卡',",
    `      '${settlementCompositionAuthority}',`,
  ));

update('scripts/verify-warehouse-expansion.mjs', (source) => source.replaceAll(
  "  'facility-formula-scope',\n",
  '',
));

for (const path of walk('src/styles').filter((item) => item.endsWith('.css'))) {
  if (read(path).includes('$' + '{')) throw new Error(`${path}: unresolved generated placeholder`);
}

unlinkSync('scripts/apply-live-staffing-settlement-v3.mjs');
console.log('Updated version 25, live staffing authority, and production method guards.');
