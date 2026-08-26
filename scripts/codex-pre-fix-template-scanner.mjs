import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/codex-fix-player-profile-apply.mjs';
let content = readFileSync(path, 'utf8');
const before = `        const expressionStart = source.indexOf(needle, from);
        if (expressionStart < 0) break;
        const callStart = expressionStart + 1;`;
const after = `        const expressionStart = source.indexOf(needle, from);
        if (expressionStart < 0) break;
        if (source[expressionStart - 1] === '$') {
          from = expressionStart + needle.length;
          continue;
        }
        const callStart = expressionStart + 1;`;
if (!content.includes(before)) throw new Error('template scanner insertion point not found');
content = content.replace(before, after);
writeFileSync(path, content, 'utf8');
console.log('Prepared numeric JSX scanner to ignore template-string interpolation.');
