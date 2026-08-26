import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/codex-apply-player-profile.mjs';
let content = readFileSync(path, 'utf8');

function replaceRequired(before, after, label) {
  if (!content.includes(before)) throw new Error(`${label} fix source not found`);
  content = content.replace(before, after);
}

replaceRequired(
  "import ts from 'typescript';\n",
  '',
  'TypeScript compiler API import',
);
replaceRequired(
  "function replaceAll(path, before, after) {\n  const content = read(path);\n  if (!content.includes(before)) throw new Error(`${path}: replacement source not found: ${before}`);\n  write(path, content.split(before).join(after));\n}\n",
  "function replaceAll(path, before, after) {\n  const content = read(path);\n  if (!content.includes(before)) return;\n  write(path, content.split(before).join(after));\n}\n",
  'optional replaceAll helper',
);
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
replaceRequired(
  "replaceAll('scripts/verify-leaderboards.mjs', '头像名称列', '玩家列');\n",
  '',
  'obsolete leaderboard verifier wording',
);
replaceRequired(
  "  '    \"verify:mobile-status-value-fit\": \"node scripts/verify-mobile-status-value-fit.mjs\",\\n    \"verify:player-avatar\": \"node scripts/verify-player-avatar.mjs\",',",
  "  '    \"verify:mobile-status-value-fit\": \"node scripts/verify-mobile-status-value-fit.mjs\",\\n    \"verify:display-format\": \"node scripts/verify-display-format.mjs\",\\n    \"verify:player-avatar\": \"node scripts/verify-player-avatar.mjs\",',",
  'display-format package script',
);
replaceRequired(
  'AVATAR_BLOCK = """',
  'AVATAR_BLOCK = r"""',
  'raw nginx avatar block',
);

const migrationStart = content.indexOf('function migrateNumericJsx() {');
const migrationEndMarker = 'migrateNumericJsx();';
const migrationEndStart = content.indexOf(migrationEndMarker, migrationStart);
if (migrationStart < 0 || migrationEndStart < 0) throw new Error('numeric JSX migration block not found');
const migrationEnd = migrationEndStart + migrationEndMarker.length;
const migrationReplacement = String.raw`function matchingParen(source, opening) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = opening; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (character === quote) quote = '';
      continue;
    }
    if (character === "'" || character === '"' || character.charCodeAt(0) === 96) {
      quote = character;
      continue;
    }
    if (character === '(') depth += 1;
    else if (character === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function insideCurrencyAmount(source, expressionStart) {
  const prefix = source.slice(Math.max(0, expressionStart - 500), expressionStart);
  return prefix.lastIndexOf('<CurrencyAmount') > prefix.lastIndexOf('</CurrencyAmount>');
}

function migrateNumericJsx() {
  const targetRoot = resolve(root, 'src');
  const formatterComponents = new Map([
    ['formatNumber', 'CompactNumber'],
    ['formatCurrency', 'CompactCurrency'],
    ['formatRank', 'CompactRank'],
  ]);
  for (const absolute of walkFiles(targetRoot)) {
    if (!absolute.endsWith('.tsx')) continue;
    const relativePath = relative(root, absolute).replaceAll('\\', '/');
    if (relativePath === 'src/components/ui/CompactNumber.tsx') continue;
    let source = readFileSync(absolute, 'utf8');
    if (source.includes("components/ui/CompactNumber'") || source.includes("../ui/CompactNumber'")) continue;
    const edits = [];
    const needed = new Set();

    for (const [formatter, component] of formatterComponents) {
      const needle = '{' + formatter + '(';
      let from = 0;
      while (from < source.length) {
        const expressionStart = source.indexOf(needle, from);
        if (expressionStart < 0) break;
        const callStart = expressionStart + 1;
        const opening = callStart + formatter.length;
        const closing = matchingParen(source, opening);
        if (closing < 0) throw new Error(relativePath + ': unbalanced ' + formatter + ' call');
        let after = closing + 1;
        while (/\s/.test(source[after] || '')) after += 1;
        from = closing + 1;
        if (source[after] !== '}') continue;
        if (formatter === 'formatCurrency' && insideCurrencyAmount(source, expressionStart)) continue;
        const argument = source.slice(opening + 1, closing).trim();
        if (!argument) continue;
        edits.push({
          start: callStart,
          end: closing + 1,
          text: '<' + component + ' value={' + argument + '} />',
        });
        needed.add(component);
      }
    }

    if (!edits.length) continue;
    edits.sort((left, right) => right.start - left.start);
    let lastStart = source.length + 1;
    for (const edit of edits) {
      if (edit.end > lastStart) continue;
      source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
      lastStart = edit.start;
    }

    const compactModule = resolve(root, 'src/components/ui/CompactNumber');
    let importPath = relative(dirname(absolute), compactModule).replaceAll('\\', '/');
    if (!importPath.startsWith('.')) importPath = './' + importPath;
    source = "import { " + [...needed].sort().join(', ') + " } from '" + importPath + "';\n" + source;
    writeFileSync(absolute, source, 'utf8');
  }
}
migrateNumericJsx();`;
content = content.slice(0, migrationStart) + migrationReplacement + content.slice(migrationEnd);

writeFileSync(path, content, 'utf8');

const displayVerifierPath = 'scripts/verify-display-format.mjs';
let displayVerifier = readFileSync(displayVerifierPath, 'utf8');
for (const [before, after] of [
  ["'formatRank(currentRank)'", "'<CompactRank value={currentRank}'"],
  ["'formatRank(entry.rank)'", "'<CompactRank value={entry.rank}'"],
]) {
  if (!displayVerifier.includes(before)) throw new Error(`display verifier source not found: ${before}`);
  displayVerifier = displayVerifier.replace(before, after);
}
writeFileSync(displayVerifierPath, displayVerifier, 'utf8');

const leaderboardVerifierPath = 'scripts/verify-leaderboards.mjs';
let leaderboardVerifier = readFileSync(leaderboardVerifierPath, 'utf8');
const rewardBefore = "entry.rewardGems ? `◆ ${formatNumber(entry.rewardGems)}` : '—'";
const rewardAfter = "entry.rewardGems ? <>◆ <CompactNumber value={entry.rewardGems} /></> : '—'";
if (!leaderboardVerifier.includes(rewardBefore)) throw new Error('leaderboard reward verifier source not found');
leaderboardVerifier = leaderboardVerifier.replace(rewardBefore, rewardAfter);
writeFileSync(leaderboardVerifierPath, leaderboardVerifier, 'utf8');

console.log('Prepared one-time implementation script.');
