import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const path = 'scripts/apply-anonymize-local-trades.mjs';
let source = readFileSync(path, 'utf8');
const from = `let ci = read('.github/workflows/ci.yml');
ci = ci.replace('  contents: write', '  contents: read');
ci = ci.replace(\`
      - name: Apply local trade anonymization bundle
        run: node scripts/apply-anonymize-local-trades.mjs
\`, '');
if (!ci.includes('Verify local trade privacy')) {
  ci = ci.replace(\`      - name: Verify market assets
        run: node scripts/verify-market-assets.mjs
\`, \`      - name: Verify market assets
        run: node scripts/verify-market-assets.mjs

      - name: Verify local trade privacy
        run: node scripts/verify-local-trade-privacy.mjs
\`);
}
write('.github/workflows/ci.yml', ci);

unlinkSync('scripts/apply-anonymize-local-trades.mjs');
`;
const to = `unlinkSync('scripts/prepare-anonymize-push.mjs');
execSync('git restore --source=HEAD -- .github/workflows/ci.yml scripts/apply-anonymize-local-trades.mjs');
`;
if (!source.includes(from)) throw new Error('未找到工作流清理块');
source = source.replace(from, to);
writeFileSync(path, source, 'utf8');
