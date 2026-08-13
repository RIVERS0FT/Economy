import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/verify-unified-factory-recipes-grid.mjs';
let source = readFileSync(path, 'utf8');
const from = '<FacilityStaffingSummary entry={entry} now={now} />';
const to = '<FacilityStaffingSummary entry={entry} now={liveNow} />';
if (!source.includes(from)) throw new Error('missing old staffing clock verifier');
source = source.replace(from, to);
writeFileSync(path, source);
