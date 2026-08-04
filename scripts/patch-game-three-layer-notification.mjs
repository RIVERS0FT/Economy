import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/verify-game-three-layer.mjs';
const source = readFileSync(path, 'utf8');
const before = "  '<StatusBar items={statusItems} />',";
const after = [
  "  '<StatusBar',",
  "  'action={(',",
  "  'NotificationCenterButton',",
].join('\n');
if (!source.includes(before)) {
  throw new Error('Missing GameShell status bar verification anchor');
}
writeFileSync(path, source.replace(before, after), 'utf8');
