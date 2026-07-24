import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { relative, resolve } from 'node:path';
import postcss from 'postcss';

const root = process.cwd();
const baselinePath = resolve(root, 'scripts/interaction-hover-legacy.json');
const writeBaseline = process.argv.includes('--write-baseline');
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function hasFineMouseGuard(rule) {
  const selectorHasMouseModality = /html\[data-input-modality=(?:"mouse"|'mouse')\]/.test(rule.selector);
  let hasHoverCapability = false;
  let hasFinePointerCapability = false;
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type !== 'atrule' || parent.name !== 'media') continue;
    hasHoverCapability ||= /\(\s*hover\s*:\s*hover\s*\)/.test(parent.params);
    hasFinePointerCapability ||= /\(\s*pointer\s*:\s*fine\s*\)/.test(parent.params);
  }
  return selectorHasMouseModality && hasHoverCapability && hasFinePointerCapability;
}

function collectUnguardedHoverRules() {
  const styleRoot = resolve(root, 'src/styles');
  const entries = [];
  for (const absolutePath of walkFiles(styleRoot).filter((path) => path.endsWith('.css'))) {
    const file = relative(root, absolutePath).replaceAll('\\', '/');
    const css = readFileSync(absolutePath, 'utf8');
    const parsed = postcss.parse(css, { from: file });
    parsed.walkRules((rule) => {
      if (!rule.selector.includes(':hover') || hasFineMouseGuard(rule)) return;
      entries.push(`${file}::${normalize(rule.selector)}`);
    });
  }
  return Array.from(new Set(entries)).sort();
}

const requiredFiles = [
  'src/utils/inputModality.ts',
  'src/app/interactionBootstrap.ts',
  'src/styles/interaction-states.css',
  'src/pages/ProductionPage.tsx',
  'src/styles/facility-group-card-grid.css',
  'tests/browser/facility-detail-sheet.spec.ts',
  'tests/browser/input-modality.spec.ts',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md',
  'docs/README.md',
  'README.md',
  'package.json',
];
requiredFiles.forEach(requireFile);

if (failures.length === 0) {
  for (const text of [
    'configureInputModality();',
    "from '../utils/inputModality'",
  ]) requireText('src/app/interactionBootstrap.ts', text);

  for (const text of [
    "@media (hover: hover) and (pointer: fine)",
    "html[data-input-modality='mouse']",
    ":where(button:hover:not(:disabled), .ui-button:hover:not(:disabled))",
    "[data-ui-interactive='surface']:hover:not(:disabled)",
    "html:not([data-input-modality='keyboard']) [data-ui-interactive='surface']:focus-visible",
    "html[data-input-modality='keyboard'] [data-ui-interactive='surface']:focus-visible",
    '--ui-interactive-active-transform',
  ]) requireText('src/styles/interaction-states.css', text);

  for (const text of [
    'data-ui-interactive="surface"',
    'detailTriggerRef.current = trigger;',
    'returnFocusRef.current?.focus()',
  ]) requireText('src/pages/ProductionPage.tsx', text);

  for (const text of [
    '--ui-interactive-hover-border-color',
    '--ui-interactive-hover-background',
    '--ui-interactive-active-transform',
  ]) requireText('src/styles/facility-group-card-grid.css', text);
  for (const forbidden of [
    '.facility-cluster-selector-card:hover',
    '.facility-cluster-selector-card:active',
    '.facility-cluster-selector-card:focus-visible',
  ]) forbidText('src/styles/facility-group-card-grid.css', forbidden);
  forbidText('src/styles/design-system.css', 'button:hover:not(:disabled),\n.ui-button:hover:not(:disabled) {');
  forbidText('src/styles/interaction-states.css', "html[data-input-modality='mouse'] button:hover:not(:disabled)");

  const rootFiles = [
    ...walkFiles(resolve(root, 'src')),
    ...walkFiles(resolve(root, 'tests/browser')),
  ].filter((path) => path.endsWith('.tsx') && readFileSync(path, 'utf8').includes('createRoot('));
  for (const absolutePath of rootFiles) {
    const file = relative(root, absolutePath).replaceAll('\\', '/');
    const content = readFileSync(absolutePath, 'utf8');
    if (!content.includes('interactionBootstrap')) {
      failures.push(`${file} 是 React 根入口但未安装 interactionBootstrap`);
    }
    if (content.includes('styles/design-system.css')) {
      const designIndex = content.indexOf('styles/design-system.css');
      const interactionIndex = content.indexOf('styles/interaction-states.css');
      if (interactionIndex < designIndex) {
        failures.push(`${file} 必须在 design-system.css 之后加载 interaction-states.css`);
      }
    }
  }

  for (const text of [
    '输入方式与共享交互状态',
    '`src/app/interactionBootstrap.ts`',
    '`src/styles/interaction-states.css`',
    '`data-ui-interactive="surface"`',
    '`scripts/verify-interaction-modality.mjs`',
    '`tests/browser/input-modality.spec.ts`',
  ]) requireText('docs/UI_DESIGN_SYSTEM.md', text);
  requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', '触摸关闭后必须恢复为仅由工厂运行状态决定的基础视觉');
  requireText('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md', '触摸关闭悬浮框后不得残留悬停、按压或焦点选中视觉');
  requireText('docs/README.md', '输入方式、共享交互表面');
  requireText('README.md', '全局输入方式由最近一次有效输入动态决定');

  for (const text of [
    'Input.dispatchTouchEvent',
    'data-input-modality',
    'outlineStyle',
    'await expect(trigger).toBeFocused()',
  ]) requireText('tests/browser/facility-detail-sheet.spec.ts', text);
  for (const text of [
    'mixed input switches shared surface hover and focus without reload',
    'dataset.inputModality',
    'trigger.hover()',
    "pointerType: 'touch'",
  ]) requireText('tests/browser/input-modality.spec.ts', text);

  requireText('package.json', 'node scripts/verify-interaction-modality.mjs');
}

const currentUnguardedHoverRules = collectUnguardedHoverRules();
if (writeBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify({
    description: 'Existing unguarded hover selectors. New entries are forbidden; migrate existing entries to the shared interaction protocol when touched.',
    unguardedHoverRules: currentUnguardedHoverRules,
  }, null, 2)}\n`);
} else if (!existsSync(baselinePath)) {
  failures.push('缺少 scripts/interaction-hover-legacy.json；先由维护流程生成现有遗留 hover 基线');
} else {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const allowed = new Set(baseline.unguardedHoverRules ?? []);
  const unexpected = currentUnguardedHoverRules.filter((entry) => !allowed.has(entry));
  if (unexpected.length > 0) {
    failures.push(
      `发现新增的未受输入方式约束 hover：\n${unexpected.map((entry) => `  - ${entry}`).join('\n')}\n` +
      '请使用 data-ui-interactive="surface" 与 interaction-states.css，或在鼠标输入方式和 hover/pointer 能力查询下显式约束。',
    );
  }
}

if (failures.length > 0) {
  console.error('全局输入方式与共享交互状态验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`全局输入方式验证通过；当前遗留未约束 hover ${currentUnguardedHoverRules.length} 条，新增条目为 0。`);
