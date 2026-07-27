import { expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const files = [
  'README.md',
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'scripts/verify-gem-shop.mjs',
  'scripts/verify-unified-factory-recipes-grid.mjs',
  'src/pages/PageRouter.tsx',
  'src/pages/ProductionPage.tsx',
  'tests/browser/production-status-summary.spec.ts',
];

test('export source snapshot for the approved gem acceleration relocation', async () => {
  for (const file of files) {
    const target = resolve('test-results/agent-export', file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(resolve(file), target);
  }

  expect(false, 'agent source export intentionally triggers artifact upload').toBe(true);
});
