import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/styles/notification-center.css';
const source = readFileSync(path, 'utf8');
const before = '  overscroll-behavior: contain;';
const after = '  overscroll-behavior-x: contain;\n  overscroll-behavior-y: auto;';
if (!source.includes(before)) {
  throw new Error('Missing notification scroll ownership anchor');
}
writeFileSync(path, source.replace(before, after), 'utf8');
