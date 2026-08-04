import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, replacements) {
  let source = readFileSync(path, 'utf8');
  for (const [before, after, label] of replacements) {
    if (!source.includes(before)) throw new Error(`Missing browser fixture anchor: ${label}`);
    source = source.replace(before, after);
  }
  writeFileSync(path, source, 'utf8');
}

patch('src/components/notifications/NotificationCenter.tsx', [[
  'className={`notice-toast notification-toast notification-toast--${toast.tone}`}',
  'className={`notification-toast notification-toast--${toast.tone}`}',
  'legacy notice toast class',
]]);

patch('src/styles/mobile-status-layout.css', [[
  '  .mobile-notice-region .notice-toast {',
  '  .mobile-notice-region .notice-toast,\n  .mobile-notice-region .notification-toast {',
  'mobile toast geometry selector',
]]);

patch('tests/browser/notification-center.spec.ts', [
  [
    "    const surfaceContent = statusContent.parentElement;\n    if (!surfaceContent) throw new Error('notification status surface is incomplete');\n    const layout = document.createElement('div');\n    layout.className = 'asset-bar-layout';\n    surfaceContent.insertBefore(layout, statusContent);\n    layout.append(statusContent);",
    "    const layout = statusContent.parentElement;\n    if (!layout) throw new Error('notification status surface is incomplete');\n    layout.classList.add('asset-bar-layout');",
    'status layout fixture',
  ],
  [
    "    toast.className = 'notice-toast notification-toast notification-toast--success';",
    "    toast.className = 'notification-toast notification-toast--success';",
    'notification toast fixture class',
  ],
]);

patch('scripts/verify-notification-center.mjs', [[
  'assert.doesNotMatch(component, /LiquidGlassSurface/);',
  'assert.doesNotMatch(component, /LiquidGlassSurface/);\nassert.doesNotMatch(component, /notice-toast/);',
  'legacy toast prevention',
]]);
