import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const encoded = [0, 1, 2, 3]
  .map((index) => readFileSync(`.agent/chunk-${String(index).padStart(2, '0')}.txt`, 'utf8').trim())
  .join('');
let source = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
const auctionAnchor = `replace('src/pages/AuctionPage.tsx',
  "min={1}\\n             max={1_000_000_000}\\n             error={parsedStartingBid === null ? '请输入 1～1000000000 的整数。' : undefined}",
  "min={0.01}\\n             max={1_000_000_000}\\n             error={parsedStartingBid === null ? '请输入不低于 0.01 的金额；超过两位小数会向下截断。' : undefined}");`;
const auctionReplacement = `replaceRegex('src/pages/AuctionPage.tsx',
  /min=\\{1\\}\\n(\\s+)max=\\{1_000_000_000\\}\\n\\1error=\\{parsedStartingBid === null \\? '请输入 1～1000000000 的整数。' : undefined\\}/,
  "min={0.01}\\n$1max={1_000_000_000}\\n$1error={parsedStartingBid === null ? '请输入不低于 0.01 的金额；超过两位小数会向下截断。' : undefined}");`;
if (!source.includes(auctionAnchor)) throw new Error('Auction patch anchor missing from generated source');
source = source.replace(auctionAnchor, auctionReplacement);
const generated = '.agent/generated-money-patch.mjs';
writeFileSync(generated, source);
await import(pathToFileURL(generated).href);
