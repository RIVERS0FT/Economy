import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
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
const requireAll = (path, texts) => texts.forEach((text) => requireText(path, text));

const paths = {
  statusBar: 'src/components/shell/StatusBar.tsx',
  mobileStyle: 'src/styles/mobile-status-layout.css',
  design: 'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  browserSpec: 'tests/browser/mobile-status-value-fit.spec.ts',
  package: 'package.json',
};
Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  requireAll(paths.statusBar, [
    'MOBILE_STATUS_MIN_FONT_SIZE_REM = 0.56',
    'STATUS_VALUE_WIDTH_SAFETY = 0.98',
    'function fitStatusBarValues(',
    "new ResizeObserver(scheduleFit)",
    'requestAnimationFrame(fitValues)',
    "document.fonts.ready.then(scheduleFit)",
    "--mobile-status-value-font-size",
    'statusValueFitted',
  ]);
  requireAll(paths.mobileStyle, [
    '.asset-bar .asset-bar-item-value {',
    'font-size: var(--mobile-status-value-font-size, clamp(.7rem, 3.45vw, .95rem));',
    'text-overflow: clip;',
    'white-space: nowrap;',
  ]);
  forbidText(paths.mobileStyle, 'text-overflow: ellipsis');
  requireAll(paths.design, [
    '移动状态栏数值自适应',
    '仅真实溢出的状态项缩小字号',
    '不得恢复省略号',
    '`0.56rem`',
  ]);
  requireAll(paths.browserSpec, [
    'mobile status values shrink individually instead of showing ellipses',
    'const mobileWidths = [430, 390, 375, 360, 320];',
    "dataset.statusValueFitted",
    "textOverflow",
  ]);
  requireAll(paths.package, [
    '"verify:mobile-status-value-fit": "node scripts/verify-mobile-status-value-fit.mjs"',
    'node scripts/verify-mobile-status-value-fit.mjs',
  ]);
}

if (failures.length > 0) {
  console.error('移动状态栏数值自适应验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('移动状态栏数值自适应验证通过。');
