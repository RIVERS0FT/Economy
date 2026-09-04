import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'src/pages/BuildingsPage.tsx';
const source = readFileSync(path, 'utf8');
const oldText = `        ) : null}\n      <Button\n        block`;
const newText = `        ) : null}\n      </DataList>\n      <Button\n        block`;
if (!source.includes(oldText)) throw new Error('BuildingsPage build DataList tail not found');
writeFileSync(path, source.replace(oldText, newText));

for (const temp of [
  'scripts/codex-fix-buildings-datalist.mjs',
  '.github/workflows/codex-fix-buildings-datalist.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
