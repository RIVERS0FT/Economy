import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const path = 'scripts/apply-anonymize-local-trades.mjs';
let source = readFileSync(path, 'utf8');
source = source.replace(
  'assert.equal(field in order, false, `${field} must not be public`);',
  "assert.equal(field in order, false, field + ' must not be public');",
);
source = source.replace(
  'assert.equal(serialized.includes(secret), false, `${secret} leaked`);',
  "assert.equal(serialized.includes(secret), false, secret + ' leaked');",
);
source = source.replace("replace('server/src/domain-core.js', '    version: 14,', '    version: 15,');\n", '');
writeFileSync(path, source, 'utf8');
if (existsSync('scripts/anonymize-error.log')) unlinkSync('scripts/anonymize-error.log');
unlinkSync('scripts/fix-anonymize-script.mjs');
