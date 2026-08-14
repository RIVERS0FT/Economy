import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/.apply-api-hotpath-v2.mjs';
let source = readFileSync(path, 'utf8');
const label = "'update verifier success text',";
const labelAt = source.indexOf(label);
if (labelAt >= 0) {
  const start = source.lastIndexOf('replaceLiteral(', labelAt);
  const end = source.indexOf('\n);\n', labelAt);
  if (start < 0 || end < 0) throw new Error('unable to remove verifier success-text patch');
  source = source.slice(0, start) + source.slice(end + 4);
}
writeFileSync(path, source, 'utf8');
console.log('non-semantic verifier message patch removed');
