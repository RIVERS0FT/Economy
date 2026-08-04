import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const manifest = readFileSync('src/styles/app.css', 'utf8');
assert.ok(manifest.includes('@layer reset, foundations, pages, components, interactions, overrides;'));
for (const required of [
  "url('./globals.css')",
  "url('./game-shell-layout.css')",
  "url('./financial-backdrop.css')",
  "url('./liquid-glass-surfaces.css')",
  "url('./notification-center.css')",
  "url('./design-system.css')",
  "url('./interaction-states.css')",
  "url('./primary-surfaces.css')",
  "url('./form-controls.css')",
]) assert.ok(manifest.includes(required), `统一样式清单缺少：${required}`);

const ordered = [
  "url('./game-shell-layout.css')",
  "url('./financial-backdrop.css')",
  "url('./liquid-glass-surfaces.css')",
  "url('./design-system.css')",
  "url('./interaction-states.css')",
  "url('./primary-surfaces.css')",
  "url('./auth.css')",
  "url('./registration-auth.css')",
  "url('./form-controls.css')",
];
for (let index = 1; index < ordered.length; index += 1) {
  assert.ok(manifest.indexOf(ordered[index - 1]) < manifest.indexOf(ordered[index]), `${ordered[index - 1]} 必须早于 ${ordered[index]}`);
}

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const productionSources = walk('src').filter((path) => /\.(ts|tsx)$/.test(path) && !path.endsWith('-runtime-test.tsx'));
const cssImports = productionSources.flatMap((path) => {
  const content = readFileSync(path, 'utf8');
  return [...content.matchAll(/import\s+['"][^'"]+\.css['"]/g)].map((match) => `${path}: ${match[0]}`);
});
assert.deepEqual(cssImports, ["src/main.tsx: import './styles/app.css'"]);
assert.ok(readFileSync('docs/UI_DESIGN_SYSTEM.md', 'utf8').includes('Cascade Layers'));
console.log('CSS Cascade Layers 验证通过：正式运行时只有单一样式入口，级联职责固定。');
