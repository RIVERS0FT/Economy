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

for (const path of walk('src/styles').filter((item) => item.endsWith('.css'))) {
  if (read(path).includes('$' + '{')) throw new Error(`${path}: unresolved generated placeholder`);
}

unlinkSync('scripts/apply-live-staffing-settlement-v3.mjs');
console.log('Updated version 25 and production method guards.');
