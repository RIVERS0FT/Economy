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

for (const path of [
  'src/main.tsx',
  'src/app/LoginPage.tsx',
  'src/components/auth/AuthCardSurface.tsx',
  'src/components/ui/LiquidGlassSurface.tsx',
  'src/components/visual/FinancialBackdrop.tsx',
  'src/config/visualAssets.ts',
  'src/styles/auth.css',
  'src/styles/financial-backdrop.css',
  'src/styles/liquid-glass-surfaces.css',
  'src/styles/globals.css',
  'src/styles/card-system.css',
  'src/styles/invitations.css',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  'docs/README.md',
  'tests/browser/auth-three-layer.spec.ts',
]) requireFile(path);

for (const text of [
  "import { AuthCardSurface } from '../components/auth/AuthCardSurface'",
  "import { FinancialBackdrop } from '../components/visual/FinancialBackdrop'",
  '<FinancialBackdrop variant="auth" priority />',
  '<AuthCardSurface>',
  '</AuthCardSurface>',
  'login-content-layer',
]) requireText('src/app/LoginPage.tsx', text);
for (const text of ['className="login-card panel"', '.login-card panel']) forbidText('src/app/LoginPage.tsx', text);

for (const text of [
  "const MOBILE_AUTH_MEDIA_QUERY = '(max-width: 720px)'",
  "'desktopAuthCard' | 'mobileAuthCard'",
  "mediaQuery.matches ? 'mobileAuthCard' : 'desktopAuthCard'",
  'className="login-card"',
  'aria-label="账号认证"',
  'layout="content"',
]) requireText('src/components/auth/AuthCardSurface.tsx', text);

for (const text of [
  "| 'desktopAuthCard'",
  "| 'mobileAuthCard'",
  "export type LiquidGlassSurfaceLayout = 'fixed' | 'content'",
  'const DESKTOP_AUTH_CARD_GLASS = {',
  'const MOBILE_AUTH_CARD_GLASS = {',
  'displacementScale: 70',
  'blurAmount: 0.0625',
  'saturation: 140',
  'aberrationIntensity: 2',
  'elasticity: 0.15',
  'const hasLiquidMotion = preset.elasticity > 0;',
  'mouseContainer={hasLiquidMotion ? mouseContainerRef : null}',
  'globalMousePos={hasLiquidMotion ? undefined : STATIC_MOUSE_POSITION}',
  'mouseOffset={hasLiquidMotion ? undefined : STATIC_MOUSE_OFFSET}',
  'mouseContainerRef={surfaceRef}',
  'data-liquid-glass-layout={layout}',
  'useLayoutEffect(() => {',
  'new ResizeObserver',
  'new MutationObserver',
  'setContentHeight(nextHeight)',
  'contentElement.offsetHeight',
  'surfaceElement.clientWidth',
  'surfaceElement.clientHeight',
  "':scope > .liquid-glass-surface__effect'",
  "effectElement.setAttribute('data-liquid-glass-measuring', 'true')",
  "effectElement.removeAttribute('data-liquid-glass-measuring')",
  'void effectElement.offsetHeight',
  "window.dispatchEvent(new Event('resize'))",
  '<div ref={contentRef} className="liquid-glass-surface__content">{content}</div>',
  "contentRef={layout === 'content' ? contentRef : undefined}",
]) requireText('src/components/ui/LiquidGlassSurface.tsx', text);
for (const text of [
  'setSurfaceRevision',
  'liquid-glass-surface__material-fill',
  'contentElement.getBoundingClientRect().height',
  'key={`${variant}-${revision}`}',
]) forbidText('src/components/ui/LiquidGlassSurface.tsx', text);

for (const text of [
  'FINANCIAL_BACKGROUND_IMAGE_URL',
  'FINANCIAL_BACKGROUND_IMAGE_960_URL',
  'upload.wikimedia.org/wikipedia/commons/',
  'Carol M. Highsmith',
]) requireText('src/config/visualAssets.ts', text);

for (const text of [
  "type FinancialBackdropVariant = 'auth' | 'game'",
  "variant === 'auth' ? 'login' : 'game'",
  'financial-backdrop-image',
  'financial-backdrop-atmosphere',
  '<picture>',
  "fetchPriority={priority ? 'high' : 'auto'}",
  'aria-hidden="true"',
  'event.currentTarget.hidden = true;',
]) requireText('src/components/visual/FinancialBackdrop.tsx', text);

for (const text of [
  '.login-shell {',
  'display: block;',
  'margin: 0;',
  'border: 0;',
  'border-radius: 0;',
  'padding: 0;',
  'overflow: visible;',
  'box-shadow: none;',
  'backdrop-filter: none;',
  '.login-image-layer,',
  '.login-atmosphere-layer {',
  '.login-content-layer {',
  'position: fixed;',
  'z-index: 0;',
  'z-index: 1;',
  'z-index: 2;',
  'object-fit: cover;',
  'html[data-app-surface="auth"] body::before',
  'display: none;',
  'min-height: calc(100dvh - var(--space-8));',
  '.login-card {',
  'border-radius: var(--radius-card);',
  '.login-card .liquid-glass-surface__content {',
  'padding: var(--space-8);',
  'border-radius: var(--radius-card-mobile);',
  'padding: var(--space-5);',
  'rgba(1, 7, 4, 0.62) 0%',
  'rgba(2, 10, 6, 0.6) 36%',
  'rgba(2, 8, 5, 0.82) 100%',
  '.login-atmosphere-layer::before {\n    opacity: 0.12;',
  '.login-atmosphere-layer::after {\n    opacity: 0.05;',
]) requireText('src/styles/auth.css', text);
for (const text of [
  '.login-card.panel',
  'backdrop-filter: blur(22px)',
  '-webkit-backdrop-filter: blur(22px)',
  'backdrop-filter: blur(18px)',
  '-webkit-backdrop-filter: blur(18px)',
  'linear-gradient(145deg, rgba(15, 31, 22',
  'linear-gradient(155deg, rgba(12, 28, 19',
  'rgba(1, 7, 4, 0.78) 0%',
  'rgba(2, 10, 6, 0.76) 36%',
  'rgba(2, 8, 5, 0.93) 100%',
]) forbidText('src/styles/auth.css', text);

for (const text of [
  '--liquid-glass-contrast: rgba(194, 231, 214, 0.06);',
  '--liquid-glass-auth-fallback:',
  '.liquid-glass-surface[data-liquid-glass-layout="content"]',
  '.liquid-glass-surface[data-liquid-glass-layout="content"] .liquid-glass-surface__content {',
  'height: auto !important;',
  '.liquid-glass-surface__effect[data-liquid-glass-measuring=\"true\"] {',
  'transform: translate(-50%, -50%) scale(1) !important;',
  'transition: none !important;',
  '.liquid-glass-surface--desktopAuthCard .glass__warp,\n.liquid-glass-surface--mobileAuthCard .glass__warp {',
  '-webkit-backdrop-filter: blur(6px) saturate(140%);',
  '.liquid-glass-surface--desktopStatusBar,\n.liquid-glass-surface--mobileStatusBar,\n.liquid-glass-surface--mobileNavigation,\n.liquid-glass-surface--desktopAuthCard,\n.liquid-glass-surface--mobileAuthCard {',
  'background: var(--liquid-glass-contrast);',
  '.liquid-glass-surface--desktopStatusBar::after,\n.liquid-glass-surface--mobileStatusBar::after {',
  '.liquid-glass-surface--desktopAuthCard::after,\n.liquid-glass-surface--mobileAuthCard::after {',
  'content: none;',
  '.liquid-glass-surface--desktopAuthCard > span,\n.liquid-glass-surface--mobileAuthCard > span {',
  'display: block !important;',
  '.liquid-glass-surface--desktopAuthCard > div:not(.liquid-glass-surface__effect),',
  'background: var(--liquid-glass-auth-fallback);',
]) requireText('src/styles/liquid-glass-surfaces.css', text);
for (const text of [
  '--liquid-glass-auth-contrast:',
  '--liquid-glass-auth-mobile-contrast:',
  'liquid-glass-surface__material-fill',
]) forbidText('src/styles/liquid-glass-surfaces.css', text);

requireText('src/styles/invitations.css', '.banned-account-shell {');
requireText('src/styles/invitations.css', 'place-items: center;');

for (const text of [
  '.login-image-layer',
  '.login-atmosphere-layer',
  '.login-content-layer',
  '.game-image-layer',
  '.game-atmosphere-layer',
]) forbidText('src/styles/globals.css', text);
for (const text of ['.login-shell', '.login-card.panel']) forbidText('src/styles/card-system.css', text);
for (const text of ['AUTH_BACKGROUND_IMAGE_URL', 'AUTH_BACKGROUND_IMAGE_960_URL', 'upload.wikimedia.org']) {
  forbidText('src/app/LoginPage.tsx', text);
}

const backdropImport = "import './styles/financial-backdrop.css';";
const mainSource = read('src/main.tsx');
requireText('src/main.tsx', backdropImport);
const gameLayoutIndex = mainSource.indexOf("import './styles/game-shell-layout.css';");
const backdropIndex = mainSource.indexOf(backdropImport);
const glassIndex = mainSource.indexOf("import './styles/liquid-glass-surfaces.css';");
if (!(gameLayoutIndex >= 0 && backdropIndex > gameLayoutIndex && glassIndex > backdropIndex)) {
  failures.push('src/main.tsx 必须按 game-shell-layout.css → financial-backdrop.css → liquid-glass-surfaces.css 加载');
}

const finalStyleOrder = [
  "import './styles/design-system.css';",
  "import './styles/interaction-states.css';",
  "import './styles/primary-surfaces.css';",
  "import './styles/auth.css';",
  "import './styles/registration-auth.css';",
  "import './styles/form-controls.css';",
];
for (let index = 0; index < finalStyleOrder.length; index += 1) {
  const current = mainSource.indexOf(finalStyleOrder[index]);
  if (current < 0) {
    failures.push(`src/main.tsx 缺少最终样式入口: ${finalStyleOrder[index]}`);
    continue;
  }
  if (index > 0) {
    const previous = mainSource.indexOf(finalStyleOrder[index - 1]);
    if (previous >= current) failures.push(`src/main.tsx 样式顺序错误: ${finalStyleOrder[index - 1]} 必须早于 ${finalStyleOrder[index]}`);
  }
}

for (const text of [
  '登录、注册与玩家游戏共享三层视觉',
  '`src/components/visual/FinancialBackdrop.tsx`',
  '`AuthCardSurface`',
  '`desktopAuthCard`',
  '`mobileAuthCard`',
  '移动登录氛围层必须比原基线更透明',
  '`rgba(1, 7, 4, 0.62)`',
  '`rgba(2, 10, 6, 0.6)`',
  '`rgba(2, 8, 5, 0.82)`',
  '位于第三方 `.glass` 内的 `.liquid-glass-surface__content`',
  '不得通过 revision 或 React `key` 重建认证内容',
  '统一使用 `--liquid-glass-contrast`',
  '不得再创建 `.liquid-glass-surface__material-fill`',
  '官方默认值',
  '`displacementScale=70`',
  '`elasticity=0.15`',
  '官方 `mouseContainer` 接口',
  '两个边缘高光 `span` 必须可见',
  '中性测量态',
  '`scrollHeight`／`offsetHeight`',
  '不得绘制项目 `::after` 结构描边',
  '不得在 `auth.css` 手写另一套 `backdrop-filter`',
  '注册内容较高时由文档视口纵向滚动',
  'Carol M. Highsmith',
  '不得把整个移动登录页恢复为单张外层面板',
  '背景图片和氛围层唯一归属 `src/styles/financial-backdrop.css`',
  '`design-system.css → interaction-states.css → primary-surfaces.css → auth.css → registration-auth.css → form-controls.css`',
  '不得改变登录、注册或游戏业务流程来适配视觉布局',
]) requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);

for (const text of [
  '`DESKTOP_AUTH_CARD_GLASS`',
  '`MOBILE_AUTH_CARD_GLASS`',
  '`layout="content"`',
  '单个 `ResizeObserver`',
  '认证卡片任一时刻只能存在一个',
]) requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', text);

for (const text of [
  '登录／注册入口三层视觉',
  '未登录入口的图片背景、深色氛围背景、标语与认证卡片三层结构唯一归属 `REGISTRATION_INVITE_FLOW_DESIGN.md`',
  '认证卡片必须使用 `AuthCardSurface`',
]) requireText('docs/README.md', text);

for (const text of [
  "test.describe('auth three-layer layout'",
  'viewport: { width: 1440, height: 900 }',
  'viewport: { width: 390, height: 844 }',
  "page.locator('.login-image-layer')",
  "page.locator('.login-atmosphere-layer')",
  "page.locator('.login-content-layer')",
  "toHaveAttribute('data-liquid-glass-variant', 'desktopAuthCard')",
  "toHaveAttribute('data-liquid-glass-variant', 'mobileAuthCard')",
  "toHaveAttribute('data-liquid-glass-layout', 'content')",
  'keeps one authentication glass instance and form values while switching breakpoints',
  'registration content grows inside the same glass surface without an internal scrollport',
  'official liquid motion and highlights',
  'readMobileAtmosphere',
  "expect(atmosphere.gridOpacity).toBe('0.12')",
  "expect(atmosphere.noiseOpacity).toBe('0.05')",
  'expect(glass.surfaceBackground).toBe(glass.sharedContrast)',
  'expect(glass.contentInsideGlass).toBe(true)',
  'expect(glass.materialFillCount).toBe(0)',
  "expect(glass.outlineContent).toBe('none')",
  'expect(glass.visibleDirectDecorationSpanCount).toBe(2)',
  'expect(Math.abs(glass.displacementScales[0])).toBe(70)',
  'toMatch(/saturate\\((?:140%|1\\.4)\\)/)',
  'page.mouse.move',
  '.not.toBe(initialEffectTransform)',
  "await expect(email).toHaveValue('kept@example.com')",
]) requireText('tests/browser/auth-three-layer.spec.ts', text);

if (failures.length > 0) {
  console.error('登录三层结构与官方认证液态玻璃验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('登录三层结构、官方认证液态参数、鼠标运动、双层高光、几何同步与表单状态保持验证通过。');
}
