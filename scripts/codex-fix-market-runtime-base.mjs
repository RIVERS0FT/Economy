import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

function replaceAll(path, oldText, newText, expectedCount) {
  const source = readFileSync(path, 'utf8');
  const count = source.split(oldText).length - 1;
  if (count !== expectedCount) throw new Error(`${path}: expected ${expectedCount} occurrences of ${oldText}, got ${count}`);
  writeFileSync(path, source.split(oldText).join(newText));
}

replaceAll(
  'tests/browser/market-runtime.spec.ts',
  "page.goto('/market-runtime-test.html')",
  "page.goto('market-runtime-test.html?scenario=active')",
  1,
);
replaceAll(
  'tests/browser/market-order-entry-compact.spec.ts',
  "page.goto('/market-runtime-test.html')",
  "page.goto('market-runtime-test.html?scenario=active')",
  1,
);

for (const path of [
  'tests/browser/market-runtime.spec.ts',
  'tests/browser/market-order-entry-compact.spec.ts',
]) {
  const source = readFileSync(path, 'utf8');
  if (source.includes("page.goto('/market-runtime-test.html")) {
    throw new Error(`${path}: market runtime test must respect Vite /economy/ base`);
  }
}

for (const temp of [
  'scripts/codex-fix-market-runtime-base.mjs',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
