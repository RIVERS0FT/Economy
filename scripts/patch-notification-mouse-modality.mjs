import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/styles/notification-center.css';
let source = readFileSync(path, 'utf8');
const replacements = [
  ['  .notification-center-trigger:hover {', '  html[data-input-modality="mouse"] .notification-center-trigger:hover {'],
  ['  .notification-panel__clear:hover:not(:disabled),\n  .notification-panel__close:hover,\n  .notification-record__delete:hover {', '  html[data-input-modality="mouse"] .notification-panel__clear:hover:not(:disabled),\n  html[data-input-modality="mouse"] .notification-panel__close:hover,\n  html[data-input-modality="mouse"] .notification-record__delete:hover {'],
  ['  .notification-pending-item:hover {', '  html[data-input-modality="mouse"] .notification-pending-item:hover {'],
  ['  .notification-record__body--interactive:hover {', '  html[data-input-modality="mouse"] .notification-record__body--interactive:hover {'],
  ['  .notification-toast:hover {', '  html[data-input-modality="mouse"] .notification-toast:hover {'],
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Missing notification mouse modality anchor: ${before}`);
  source = source.replace(before, after);
}
writeFileSync(path, source, 'utf8');
