import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function walkFiles(directory) {
  const entries = [];
  for (const name of readdirSync(directory)) {
    const absolute = resolve(directory, name);
    if (statSync(absolute).isDirectory()) entries.push(...walkFiles(absolute));
    else entries.push(absolute);
  }
  return entries;
}

const COMPONENTS = [
  ['CompactNumber', 'formatNumber'],
  ['CompactCurrency', 'formatCurrency'],
  ['CompactRank', 'formatRank'],
];

function repairSimpleTemplateValues(source, component, formatter) {
  const pattern = new RegExp(`\\$\\{<${component} value=\\{([^{}]+)\\} />\\}`, 'g');
  let count = 0;
  const output = source.replace(pattern, (_match, expression) => {
    count += 1;
    return `\${${formatter}(${String(expression).trim()})}`;
  });
  return { output, count };
}

let repaired = 0;
for (const absolute of walkFiles(resolve(root, 'src'))) {
  if (!absolute.endsWith('.tsx')) continue;
  let source = readFileSync(absolute, 'utf8');
  let changed = false;
  for (const [component, formatter] of COMPONENTS) {
    const result = repairSimpleTemplateValues(source, component, formatter);
    source = result.output;
    if (result.count > 0) {
      repaired += result.count;
      changed = true;
    }
  }
  if (source.includes('${<Compact')) {
    throw new Error(`${absolute}: found a complex compact component inside a template interpolation`);
  }
  if (changed) writeFileSync(absolute, source, 'utf8');
}

// Keep CurrencyAmount compatible with the repository's ES2020 TypeScript lib.
const currencyAmountPath = resolve(root, 'src/components/ui/CurrencyAmount.tsx');
let currencyAmount = readFileSync(currencyAmountPath, 'utf8');
const replaceAllSource = "normalized.replaceAll(',', '')";
if (!currencyAmount.includes(replaceAllSource)) {
  throw new Error('CurrencyAmount ES2020 compatibility source not found');
}
currencyAmount = currencyAmount.replace(replaceAllSource, "normalized.replace(/,/g, '')");
writeFileSync(currencyAmountPath, currencyAmount, 'utf8');

// Contract term diffs intentionally render compact tooltip elements. Their wrapper accepts React nodes,
// while unchanged quantity/price terms use the same compact components instead of exact formatter strings.
const negotiationPath = resolve(root, 'src/contracts/ContractNegotiationSection.tsx');
let negotiation = readFileSync(negotiationPath, 'utf8');
for (const [before, after] of [
  ["import { useState } from 'react';", "import { useState, type ReactNode } from 'react';"],
  [
    'function TermChange({ from, to }: { from: string; to: string }) {',
    'function TermChange({ from, to }: { from: ReactNode; to: ReactNode }) {',
  ],
  [
    '? formatNumber(terms.quantityPerDelivery)',
    '? <CompactNumber value={terms.quantityPerDelivery} />',
  ],
  [
    '? formatCurrency(terms.unitPrice)',
    '? <CompactCurrency value={terms.unitPrice} />',
  ],
]) {
  if (!negotiation.includes(before)) throw new Error(`ContractNegotiationSection repair source not found: ${before}`);
  negotiation = negotiation.replace(before, after);
}
writeFileSync(negotiationPath, negotiation, 'utf8');

const researchPath = resolve(root, 'src/pages/ResearchPage.tsx');
let research = readFileSync(researchPath, 'utf8');
const researchBefore = ': `研发中 · ${formatNumber(accelerationCost)} 宝石加速 ${formatDuration(accelerationMs)}`}';
const researchAfter = ': <>研发中 · <CompactNumber value={accelerationCost} /> 宝石加速 {formatDuration(accelerationMs)}</>}';
if (!research.includes(researchBefore)) {
  throw new Error('ResearchPage acceleration label was not restored to the expected compact formatter form');
}
research = research.replace(researchBefore, researchAfter);
if (!research.includes("from '../components/ui/CompactNumber'")) {
  research = `import { CompactNumber } from '../components/ui/CompactNumber';\n${research}`;
}
writeFileSync(researchPath, research, 'utf8');

const verifyPath = resolve(root, 'scripts/verify-research-page.mjs');
let verifier = readFileSync(verifyPath, 'utf8');
const verifyBefore = '研发中 · ${formatNumber(accelerationCost)} 宝石加速 ${formatDuration(accelerationMs)}';
const verifyAfter = '研发中 · <CompactNumber value={accelerationCost} /> 宝石加速 {formatDuration(accelerationMs)}';
if (!verifier.includes(verifyBefore)) throw new Error('research verifier acceleration label source not found');
verifier = verifier.replace(verifyBefore, verifyAfter);
writeFileSync(verifyPath, verifier, 'utf8');

console.log(`Repaired ${repaired} compact-number template interpolations, ES2020 currency parsing, and React-node term diffs.`);
