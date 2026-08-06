import fs from 'node:fs';

const path = 'scripts/verify-research-progression.mjs';
const source = fs.readFileSync(path, 'utf8');
const before = "  ['src/pages/ResearchPage.tsx', 'model.startResearch(selectedTechnology.id)'],";
const after = "  ['src/pages/ResearchPage.tsx', 'model.startResearch(technologyId)'],";
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`${path}: expected one legacy research submission assertion, found ${count}`);
fs.writeFileSync(path, source.replace(before, after));
console.log('research progression verifier updated for frozen technology payload');
