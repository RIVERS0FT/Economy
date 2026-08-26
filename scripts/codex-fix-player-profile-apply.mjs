import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/codex-apply-player-profile.mjs';
let content = readFileSync(path, 'utf8');
const before = "  \"import { validateResearchAccess } from './research.js';\",";
const after = "  \"import { applyResearchAction, validateResearchAccess } from './research.js';\",";
if (!content.includes(before)) throw new Error('runtime action import marker fix source not found');
content = content.replace(before, after);
writeFileSync(path, content, 'utf8');
console.log('Prepared one-time implementation script.');
