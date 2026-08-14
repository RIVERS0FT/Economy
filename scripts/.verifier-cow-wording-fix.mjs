import { readFileSync, writeFileSync } from 'node:fs';
const path = 'scripts/verify-authoritative-hotpaths.mjs';
let source = readFileSync(path, 'utf8');
source = source.replace("  '已提交世界',\n  '请求草稿',", "  'committed world',\n  'Mutation Scope',");
writeFileSync(path, source);
