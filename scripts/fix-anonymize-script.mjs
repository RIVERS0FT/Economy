import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

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
writeFileSync(path, source, 'utf8');
unlinkSync('scripts/anonymize-error.log');
unlinkSync('scripts/fix-anonymize-script.mjs');
