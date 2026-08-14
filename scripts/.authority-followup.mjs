import { readFileSync, writeFileSync } from 'node:fs';
const path = 'docs/README.md';
let source = readFileSync(path, 'utf8');
const before = '管理员只读汇总同样保持队列外。正式调度继续只按实际到期领域推进并对当前世界使用 `migrate: false`；';
const after = '管理员 `GET /api/game/admin/summary` 与 `GET /api/game/admin/population-economy` 同样直接读取 committed world 并保持权威写队列外。幂等记录过期清理最多每 5 分钟执行一次。正式调度继续只按实际到期领域推进并对当前世界使用 `migrate: false`；';
if (!source.includes(before)) throw new Error('Missing docs README authority phrase');
source = source.replace(before, after);
writeFileSync(path, source);
