import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/styles/market-page-polish.css';
const source = readFileSync(path, 'utf8');
const before = `.market-page-surface .market-stepper__button:hover:not(:disabled),
.market-page-surface .market-stepper__button:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.045);
  transform: translateY(-50%);
}`;
const after = `@media (hover: hover) and (pointer: fine) {
  html[data-input-modality='mouse']
    .market-page-surface .market-stepper__button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.045);
    transform: translateY(-50%);
  }
}

.market-page-surface .market-stepper__button:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.045);
  transform: translateY(-50%);
}`;
if (source.split(before).length !== 2) {
  throw new Error('市场步进按钮 hover 规则与预期不一致');
}
writeFileSync(path, source.replace(before, after), 'utf8');

const verifierPath = 'scripts/verify-market-order-entry-compact.mjs';
const verifier = readFileSync(verifierPath, 'utf8');
const verifierBefore = `  '.market-page-surface .market-stepper__button {',
  'position: absolute;',`;
const verifierAfter = `  '.market-page-surface .market-stepper__button {',
  "html[data-input-modality='mouse']",
  '@media (hover: hover) and (pointer: fine)',
  'position: absolute;',`;
if (verifier.split(verifierBefore).length !== 2) {
  throw new Error('市场紧凑下单区验证器与预期不一致');
}
writeFileSync(verifierPath, verifier.replace(verifierBefore, verifierAfter), 'utf8');
