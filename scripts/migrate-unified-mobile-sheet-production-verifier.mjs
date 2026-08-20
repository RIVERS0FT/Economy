import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/verify-production-settlement-layout.mjs';
const source = readFileSync(path, 'utf8');
const from = "  '.mobile-detail-sheet-scroll > * {',";
const to = "  '.mobile-workspace-sheet-detail-content-slot > * {',";
const first = source.indexOf(from);
if (first < 0) throw new Error('missing old mobile detail direct-child verifier');
if (source.indexOf(from, first + from.length) >= 0) throw new Error('old verifier is not unique');
writeFileSync(path, source.slice(0, first) + to + source.slice(first + from.length));
console.log('Production settlement verifier migrated to the unified detail content slot.');
