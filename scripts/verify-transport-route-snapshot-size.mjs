import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/generated/transport-capital-routes.json');
const compressed = gzipSync(source, { level: 9 });

assert.ok(source.length <= 12 * 1024 * 1024, `运输路网快照源文件过大: ${source.length}`);
assert.ok(compressed.length <= 1.5 * 1024 * 1024, `运输路网快照 gzip 体积过大: ${compressed.length}`);

console.log(`transport route snapshot size passed: raw=${source.length}, gzip=${compressed.length}`);
