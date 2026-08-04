import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/styles/notification-center.css';
let source = readFileSync(path, 'utf8');

const replaceRequired = (before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing notification hover anchor: ${label}`);
  source = source.replace(before, after);
};

replaceRequired(
  `.notification-center-trigger:hover,\n.notification-center-trigger.active {\n  color: var(--color-text-primary);\n  background: rgba(123, 228, 158, 0.1);\n}`,
  `.notification-center-trigger.active {\n  color: var(--color-text-primary);\n  background: rgba(123, 228, 158, 0.1);\n}`,
  'trigger',
);
replaceRequired(
  `.notification-panel__clear:hover:not(:disabled),\n.notification-panel__close:hover,\n.notification-record__delete:hover {\n  color: var(--color-text-primary);\n  background: rgba(255, 255, 255, 0.07);\n}\n\n`,
  '',
  'panel actions',
);
replaceRequired(
  `.notification-pending-item:hover,\n.notification-pending-item:focus-visible {\n  border-color: rgba(171, 220, 188, 0.45);\n  background: rgba(255, 255, 255, 0.065);\n}`,
  `.notification-pending-item:focus-visible {\n  border-color: rgba(171, 220, 188, 0.45);\n  background: rgba(255, 255, 255, 0.065);\n}`,
  'pending item',
);
replaceRequired(
  `.notification-record__body--interactive:hover {\n  background: rgba(255, 255, 255, 0.04);\n}\n\n`,
  '',
  'record body',
);
replaceRequired(
  `.notification-toast:hover,\n.notification-toast:focus-visible {\n  border-color: rgba(171, 220, 188, 0.5);\n  background: rgba(10, 31, 20, 0.99);\n}`,
  `.notification-toast:focus-visible {\n  border-color: rgba(171, 220, 188, 0.5);\n  background: rgba(10, 31, 20, 0.99);\n}`,
  'toast',
);

const mediaAnchor = '@media (prefers-reduced-motion: reduce) {';
if (!source.includes(mediaAnchor)) throw new Error('Missing reduced-motion anchor');
const hoverRules = `@media (hover: hover) and (pointer: fine) {\n  .notification-center-trigger:hover {\n    color: var(--color-text-primary);\n    background: rgba(123, 228, 158, 0.1);\n  }\n\n  .notification-panel__clear:hover:not(:disabled),\n  .notification-panel__close:hover,\n  .notification-record__delete:hover {\n    color: var(--color-text-primary);\n    background: rgba(255, 255, 255, 0.07);\n  }\n\n  .notification-pending-item:hover {\n    border-color: rgba(171, 220, 188, 0.45);\n    background: rgba(255, 255, 255, 0.065);\n  }\n\n  .notification-record__body--interactive:hover {\n    background: rgba(255, 255, 255, 0.04);\n  }\n\n  .notification-toast:hover {\n    border-color: rgba(171, 220, 188, 0.5);\n    background: rgba(10, 31, 20, 0.99);\n  }\n}\n\n`;
source = source.replace(mediaAnchor, `${hoverRules}${mediaAnchor}`);
writeFileSync(path, source, 'utf8');
