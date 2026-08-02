import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const path = 'scripts/agent-production-method-dropdown.mjs';
const source = readFileSync(path, 'utf8');
const fixed = source.replaceAll('${type.name}', '\\${type.name}');
if (fixed === source) throw new Error('dropdown updater escape target not found');
writeFileSync(path, fixed, 'utf8');
rmSync('scripts/agent-fix-production-method-dropdown-script.mjs');
