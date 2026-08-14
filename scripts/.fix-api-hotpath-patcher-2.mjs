import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/.apply-api-hotpath-v2.mjs';
let source = readFileSync(path, 'utf8');
const startMarker = "replaceOnce(\n  'server/src/runtime-store.js',\n  /\\/\\/ committedWorldForCache";
const start = source.indexOf(startMarker);
if (start >= 0) {
  const endMarker = "\n);\n\n// The base state builder";
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error('unable to locate obsolete architecture marker patch end');
  source = source.slice(0, start) + source.slice(end + 4);
}
writeFileSync(path, source, 'utf8');
console.log('obsolete marker patch removed');
