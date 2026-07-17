import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const bundleDir = 'scripts/.invitation-bundle';
const textPrefix = readdirSync(bundleDir)
  .filter((name) => name.endsWith('.txt'))
  .sort()
  .map((name) => readFileSync(`${bundleDir}/${name}`, 'utf8').trim())
  .join('');
const binaryParts = readdirSync(bundleDir)
  .filter((name) => name.endsWith('.bin'))
  .sort()
  .map((name) => readFileSync(`${bundleDir}/${name}`));
const compressed = Buffer.concat([
  Buffer.from(textPrefix, 'base64'),
  ...binaryParts,
]);
const files = JSON.parse(gunzipSync(compressed).toString('utf8'));
for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}
rmSync(bundleDir, { recursive: true, force: true });
rmSync('scripts/apply-invitation-bundle.mjs', { force: true });
rmSync('.github/workflows/apply-invitation-bundle.yml', { force: true });
console.log(`Applied ${Object.keys(files).length} Economy invitation files.`);
