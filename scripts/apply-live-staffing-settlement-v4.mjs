import { readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function walk(root) {
  const files = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path.replaceAll('\\', '/'));
  }
  return files;
}

const node24Guard = 'node-' + 'version: ' + '24.4.0';
for (const path of walk('scripts').filter((item) => item.endsWith('.mjs'))) {
  const source = readFileSync(path, 'utf8');
  const next = source
    .replaceAll('客户端状态版本：24', '客户端状态版本：25')
    .replaceAll('客户端状态版本 24', '客户端状态版本 25')
    .replaceAll('node-version: 25.4.0', node24Guard);
  writeFileSync(path, next);
}

unlinkSync('scripts/apply-live-staffing-settlement-v4.mjs');
console.log('Updated remaining client state version authority guards while preserving the fixed Node runtime.');
