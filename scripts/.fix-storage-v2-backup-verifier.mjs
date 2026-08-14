import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const deploymentPath = 'scripts/verify-deployment-storage.mjs';
let deployment = readFileSync(deploymentPath, 'utf8');
const check = `    if (statSync(databasePath).size !== sourceSizeBefore || digest(databasePath) !== sourceDigestBefore) {\n      failures.push('备份过程修改了源数据库主文件');\n    }`;
const marker = `\n    const migrated = new DatabaseSync(databasePath);`;
if (!deployment.includes(`${check}${marker}`)) {
  if (!deployment.includes(check) || !deployment.includes(marker)) throw new Error('storage backup verifier marker missing');
  deployment = deployment.replace(check, '');
  deployment = deployment.replace(marker, `\n${check}\n${marker}`);
  writeFileSync(deploymentPath, deployment);
}

const auctionPath = 'scripts/verify-asset-auctions.mjs';
let auction = readFileSync(auctionPath, 'utf8');
auction = auction.replace('backup before world 26 migration', 'backup before storage V2 migration');
writeFileSync(auctionPath, auction);

rmSync('scripts/.fix-storage-v2-backup-verifier.mjs');
