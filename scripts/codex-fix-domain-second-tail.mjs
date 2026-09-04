import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'server/test/domain.test.js';
let source = readFileSync(path, 'utf8');
const oldText = "  assert.ok(world.demandGroups.food.lastBudget > 0);\n}\n\ntest('beverage production paths shift toward cheaper fruit inputs'";
const newText = "  assert.ok(world.demandGroups.food.lastBudget > 0);\n});\n\ntest('beverage production paths shift toward cheaper fruit inputs'";
if (!source.includes(oldText)) throw new Error('second malformed domain test tail not found');
writeFileSync(path, source.replace(oldText, newText));
for (const temp of [
  'scripts/codex-fix-domain-second-tail.mjs',
  '.github/workflows/codex-fix-domain-second-tail.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
