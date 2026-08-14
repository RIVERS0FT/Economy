import { readFileSync, writeFileSync } from 'node:fs';
const path = 'server/src/runtime-store.js';
const source = readFileSync(path, 'utf8');
writeFileSync(path, `${source.trimEnd()}\n`);
