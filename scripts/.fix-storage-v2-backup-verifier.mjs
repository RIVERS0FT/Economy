import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/verify-deployment-storage.mjs';
let source = readFileSync(path, 'utf8');
const check = `    if (statSync(databasePath).size !== sourceSizeBefore || digest(databasePath) !== sourceDigestBefore) {\n      failures.push('备份过程修改了源数据库主文件');\n    }`;
const marker = `\n    const migrated = new DatabaseSync(databasePath);`;
if (!source.includes(`${check}${marker}`)) {
  if (!source.includes(check) || !source.includes(marker)) throw new Error('storage backup verifier marker missing');
  source = source.replace(check, '');
  source = source.replace(marker, `\n${check}\n${marker}`);
  writeFileSync(path, source);
}
