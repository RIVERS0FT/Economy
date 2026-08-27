import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, texts) => {
  const source = read(path);
  for (const text of texts) if (!source.includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, texts) => {
  const source = read(path);
  for (const text of texts) if (source.includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

const files = [
  'src/components/visual/ApplicationLayerRoot.tsx',
  'src/components/visual/FinancialBackdrop.tsx',
  'src/components/auth/AuthCardSurface.tsx',
  'src/components/ui/FrostedGlassSurface.tsx',
  'src/app/App.tsx',
  'src/app/LoginPage.tsx',
  'src/api/auth.ts',
  'src/styles/financial-backdrop.css',
  'src/styles/frosted-glass-surfaces.css',
  'src/styles/auth.css',
  'src/styles/registration-auth.css',
  'src/main.tsx',
  'tests/browser/auth-three-layer.spec.ts',
  'tests/browser/application-error-state.spec.ts',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
];
files.forEach(requireFile);

requireText('src/components/visual/ApplicationLayerRoot.tsx', [
  '<FinancialBackdrop />',
  'className="application-map-layer"',
  'className="application-ui-layer"',
  'className="application-content-root"',
]);
requireText('src/components/visual/FinancialBackdrop.tsx', [
  'className="application-image-layer financial-backdrop-image"',
  'className="application-atmosphere-layer financial-backdrop-atmosphere"',
]);
requireText('src/components/auth/AuthCardSurface.tsx', [
  "import { FrostedGlassSurface } from '../ui/FrostedGlassSurface'",
  '<section className="login-card" aria-label="账号认证">',
  '<FrostedGlassSurface variant="authCard" layout="content">',
]);
forbidText('src/components/auth/AuthCardSurface.tsx', [
  'useEffect',
  'useLayoutEffect',
  'useState',
  'matchMedia',
  'ResizeObserver',
  'MutationObserver',
]);
requireText('src/components/ui/FrostedGlassSurface.tsx', [
  'export function FrostedGlassSurface',
  'data-frosted-glass-variant={variant}',
  'data-frosted-glass-layout={layout}',
  'className="frosted-glass-surface__content"',
]);
forbidText('src/components/ui/FrostedGlassSurface.tsx', ['LiquidGlass', '<svg', 'ResizeObserver']);

requireText('src/styles/frosted-glass-surfaces.css', [
  '--frosted-glass-filter: blur(18px) saturate(128%);',
  '.frosted-glass-surface {',
  '.frosted-glass-surface::before {',
  '.frosted-glass-surface--statusBar,',
  '.frosted-glass-surface--authCard {',
  '@media (max-width: 720px)',
]);
requireText('src/styles/auth.css', [
  '.login-card {',
  '.login-card .frosted-glass-surface__content {',
  'padding: var(--space-8);',
  'padding: var(--space-5);',
  '.auth-service-warning {',
  'grid-template-columns: 44px minmax(0, 1fr) 44px;',
  '.auth-service-warning > span {',
  '.auth-service-warning > .browser-refresh-button {',
]);
forbidText('src/styles/auth.css', ['backdrop-filter: blur(', 'backdrop-filter: var(', '.login-card.panel']);
requireText('src/app/App.tsx', [
  '<div className="auth-service-warning" role="alert">',
  '<span>{authError}</span>',
  '<RefreshPageButton />',
]);
requireText('src/api/auth.ts', [
  "const REQUEST_ABORTED_MESSAGE = '连接已中断，请刷新页面后重试';",
  "String((reason as { name?: unknown }).name || '') === 'AbortError'",
  "code: 'CLIENT_REQUEST_ABORTED'",
]);

const packageJson = JSON.parse(read('package.json'));
if (packageJson.dependencies?.['liquid-glass-react'] || read('package-lock.json').includes('node_modules/liquid-glass-react')) {
  failures.push('认证外壳不得保留 liquid-glass-react 依赖');
}
if (existsSync(resolve(root, 'src/components/ui/LiquidGlassSurface.tsx'))) {
  failures.push('旧 LiquidGlassSurface.tsx 必须删除');
}

const main = read('src/main.tsx');
for (const text of [
  "import './styles/financial-backdrop.css';",
  "import './styles/frosted-glass-surfaces.css';",
  "import './styles/auth.css';",
]) {
  if (!main.includes(text)) failures.push(`src/main.tsx 缺少: ${text}`);
}
if (!(main.indexOf("import './styles/financial-backdrop.css';")
  < main.indexOf("import './styles/frosted-glass-surfaces.css';")
  && main.indexOf("import './styles/frosted-glass-surfaces.css';")
  < main.indexOf("import './styles/auth.css';"))) {
  failures.push('生产样式顺序必须为 financial-backdrop → frosted-glass-surfaces → auth');
}

requireText('tests/browser/auth-three-layer.spec.ts', [
  'desktop keeps one photography root and one CSS frosted authentication card',
  'login and registration grow naturally in the same frosted host and retain form values across breakpoints',
  'mobile authentication has no internal scrollport and remains inside the viewport',
  "surfaceVariant).toBe('authCard')",
  "backdropFilter).toContain('blur(18px)')",
  'liquidDomCount).toBe(0)',
]);
requireText('tests/browser/application-error-state.spec.ts', [
  'mobile authentication abort warning centers recoverable text beside a fixed refresh target',
  "toContainText('连接已中断，请刷新页面后重试')",
  "not.toContainText('signal is aborted without reason')",
  "expect(geometry.display).toBe('grid')",
  'expect(geometry.refreshWidth).toBe(44)',
]);
requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', [
  '唯一 `FrostedGlassSurface` 的 `authCard` 变体',
  '`blur(18px) saturate(128%)`',
  '不得恢复组件测高状态',
  '`src/styles/frosted-glass-surfaces.css`',
  '`44px minmax(0, 1fr) 44px`',
  '`signal is aborted without reason`',
]);

if (failures.length) {
  console.error('认证三层与毛玻璃卡片验证失败：\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('认证三层验证通过：唯一摄影根、单一 CSS 毛玻璃认证宿主、自然内容高度、断点表单保持和认证错误恢复布局满足当前基线。');
