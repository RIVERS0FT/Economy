import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/codex-apply-player-profile.mjs';
let content = readFileSync(path, 'utf8');

function replaceRequired(before, after, label) {
  if (!content.includes(before)) throw new Error(`${label} fix source not found`);
  content = content.replace(before, after);
}

replaceRequired(
  "  \"import { validateResearchAccess } from './research.js';\"," ,
  "  \"import { applyResearchAction, validateResearchAccess } from './research.js';\"," ,
  'runtime action import marker',
);
replaceRequired(
  "insertBefore('deploy/nginx/game.riversoft.top.economy-location.conf', '    location ^~ /economy/ {', avatarLocation);",
  "insertBefore('deploy/nginx/game.riversoft.top.economy-location.conf', 'location ^~ /economy/ {', avatarLocation);",
  'nginx economy location marker',
);

writeFileSync(path, content, 'utf8');
console.log('Prepared one-time implementation script.');
