import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'server/test/domain.test.js';
let source = readFileSync(path, 'utf8');
const oldText = "  assert.ok(relations.find((item) => item.inputProductId === 'copper').complementGate\n    > relations.find((item) => item.inputProductId === 'plastic').complementGate);\n}\n\ntest('downstream price signals move upstream only after relation lag cycles'";
const newText = "  assert.ok(relations.find((item) => item.inputProductId === 'copper').complementGate\n    > relations.find((item) => item.inputProductId === 'plastic').complementGate);\n});\n\ntest('downstream price signals move upstream only after relation lag cycles'";
if (!source.includes(oldText)) throw new Error('complement gating malformed test tail not found');
writeFileSync(path, source.replace(oldText, newText));
for (const temp of [
  'scripts/codex-fix-domain-complement-tail.mjs',
  '.github/workflows/codex-fix-domain-complement-tail.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
