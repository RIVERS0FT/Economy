import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const verifierPath = 'scripts/verify-runtime-efficiency.mjs';
let source = readFileSync(verifierPath, 'utf8');
const oldText = "  'repeated market detail must reuse the committed-world order-book runtime',";
const newText = [
  "  'repeated commodity market detail reuses committed-world projection without building public order-book runtime',",
  "  'commodity market detail must not build a public order-book runtime',",
].join('\n');
if (!source.includes(oldText)) throw new Error('legacy market detail runtime verifier text not found');
source = source.replace(oldText, newText);
writeFileSync(verifierPath, source);
for (const path of [
  'scripts/codex-fix-runtime-market-detail-verifier.mjs',
  '.github/workflows/codex-fix-runtime-market-detail-verifier.yml',
]) {
  if (existsSync(path)) unlinkSync(path);
}
