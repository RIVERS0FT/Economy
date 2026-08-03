import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const path = 'scripts/apply-live-staffing-settlement.mjs';
const source = readFileSync(path, 'utf8');
const marker = "replaceExact(\n  'server/shared/economy-state-version.js'";
const markerIndex = source.indexOf(marker);
if (markerIndex < 0) throw new Error('live staffing helper marker missing');

const head = source.slice(0, markerIndex);
const tail = source.slice(markerIndex)
  .replaceAll('\\${', '${')
  .replaceAll('${', '\\${');

writeFileSync(path, head + tail);
unlinkSync('scripts/prepare-live-staffing-helper.mjs');
console.log('Prepared nested template expressions.');
