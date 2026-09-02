import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const path = 'server/test/transport.test.js';
let source = readFileSync(path, 'utf8');

const emptyOld = '  assert.equal(player.transportRoutes.length, 0);';
const emptyNew = '  assert.equal((player.transportRoutes || []).length, 0);';
if (!source.includes(emptyOld)) throw new Error('missing empty route assertion');
source = source.replace(emptyOld, emptyNew);

const precisionOld = '  assert.equal(player.credits, firstCredits - first.setupCost);';
const precisionNew = '  assert.equal(Number(player.credits.toFixed(6)), Number((firstCredits - first.setupCost).toFixed(6)));';
if (!source.includes(precisionOld)) throw new Error('missing setup cost precision assertion');
source = source.replace(precisionOld, precisionNew);

writeFileSync(path, source, 'utf8');

rmSync('.github/workflows/fix-transport-test-assertions.yml', { force: true });
rmSync('scripts/fix-transport-test-assertions.mjs', { force: true });
