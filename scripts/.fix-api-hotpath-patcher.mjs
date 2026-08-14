import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/.apply-api-hotpath-v2.mjs';
let source = readFileSync(path, 'utf8');
source = source.replaceAll('\\\\`', '\\`');
source = source.replace(
  `  if (source.indexOf(before, first + before.length) >= 0) {\n    throw new Error(\`${'${path}'}: ambiguous literal patch target: ${'${label}'}\`);\n  }\n`,
  '',
);
writeFileSync(path, source, 'utf8');
console.log('patch bootstrap fixed');
