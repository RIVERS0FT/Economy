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
  'liquid-glass-reference-test.html',
  'tests/browser/liquid-glass-reference-harness.tsx',
  'tests/browser/liquid-glass-reference.css',
  'tests/browser/liquid-glass-reference.spec.ts',
]) requireFile(path);

for (const text of [
  "import { AuthCardSurface } from '../components/auth/AuthCardSurface'",
  '<AuthCardSurface>',
  '</AuthCardSurface>',
  'login-content-layer',
]) requireText('src/app/LoginPage.tsx', text);
for (const text of [
  "import { FinancialBackdrop } from '../components/visual/FinancialBackdrop'",
  '<FinancialBackdrop',
  'className="login-card panel"',
  '.login-card panel',
]) forbidText('src/app/LoginPage.tsx', text);

for (const text of [
  "const MOBILE_AUTH_MEDIA_QUERY = '(max-width: 720px)'",
  "'desktopAuthCard' | 'mobileAuthCard'",
  "mediaQuery.matches ? 'mobileAuthCard' : 'desktopAuthCard'",
  'className="login-card"',
  'aria-label="账号认证"',
  'layout="content"',
  'overLight={false}',
  'blurAmount={0}',
  'saturation={140}',
]) requireText('src/components/auth/AuthCardSurface.tsx', text);

for (const text of [
  "| 'desktopAuthCard'",
  "| 'mobileAuthCard'",
  "export type LiquidGlassSurfaceLayout = 'fixed' | 'content'",
  'const DESKTOP_AUTH_CARD_GLASS = {',
  'const MOBILE_AUTH_CARD_GLASS = {',
  'displacementScale: 70',
  'blurAmount: 0',
  'saturation: 140',
  'aberrationIntensity: 2',
  'elasticity: 0',
  'mouseContainer={null}',
  'globalMousePos={STATIC_MOUSE_POSITION}',
  'mouseOffset={STATIC_MOUSE_OFFSET}',
  'const GLOBAL_OVER_LIGHT = true;',
  'overLight = GLOBAL_OVER_LIGHT,',
  'overLight={overLight}',
  "data-liquid-glass-over-light={overLight ? 'true' : 'false'}",
  'data-liquid-glass-displacement-scale={preset.displacementScale}',
  'data-liquid-glass-blur-amount={blurAmount}',
  'data-liquid-glass-saturation={saturation}',
  'data-liquid-glass-aberration-intensity={preset.aberrationIntensity}',
  'function readContentHeight(element: HTMLElement)',
  'const measuredContentHeightRef = useRef<number | null>(null);',
  'const nextHeight = readContentHeight(contentRef.current);',
  'measuredContentHeightRef.current = nextHeight;',
  'data-liquid-glass-layout={layout}',
  'data-liquid-glass-elasticity={preset.elasticity}',
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
  '--liquid-glass-tint-dark',
  'data-liquid-glass-tint',
  'contentElement.getBoundingClientRect().height',
  'key={`${variant}-${revision}`}',
  'elasticity: 0.15',
  'const hasLiquidMotion = preset.elasticity > 0;',
  'mouseContainerRef',
]) forbidText('src/components/ui/LiquidGlassSurface.tsx', text);
if ((read('src/components/ui/LiquidGlassSurface.tsx').match(/displacementScale:\s*70,/g) ?? []).length !== 4) {
  failures.push('四个玻璃预设必须全部固定 displacementScale: 70');
}
if ((read('src/components/ui/LiquidGlassSurface.tsx').match(/blurAmount:\s*0,/g) ?? []).length !== 4) {
  failures.push('四个玻璃预设必须全部固定 blurAmount: 0');
}
if ((read('src/components/ui/LiquidGlassSurface.tsx').match(/saturation:\s*140,/g) ?? []).length !== 4) {
  failures.push('四个玻璃预设必须全部固定 saturation: 140');
}
if ((read('src/components/ui/LiquidGlassSurface.tsx').match(/aberrationIntensity:\s*2,/g) ?? []).length !== 4) {
  failures.push('四个玻璃预设必须全部固定 aberrationIntensity: 2');
}
if ((read('src/components/ui/LiquidGlassSurface.tsx').match(/elasticity:\s*0,/g) ?? []).length !== 4) {
  failures.push('五种玻璃变体对应的四个参数预设必须全部固定 elasticity: 0');
}

for (const text of [
  'FINANCIAL_BACKGROUND_IMAGE_URL',
  'FINANCIAL_BACKGROUND_IMAGE_960_URL',
  'upload.wikimedia.org/wikipedia/commons/',
  'Carol M. Highsmith',
]) requireText('src/config/visualAssets.ts', text);

for (const text of [
  "export type FinancialBackdropVariant = 'auth' | 'game' | 'admin';",
  "export type FinancialBackdropTone = 'normal' | 'critical';",
  'export function FinancialBackdrop()',
  'application-image-layer financial-backdrop-image',
  'data-persistent-financial-photography="true"',
  'application-atmosphere-layer financial-backdrop-atmosphere',
  '<picture>',
  'loading="eager"',
  'fetchPriority="high"',
  'aria-hidden="true"',
  'event.currentTarget.hidden = true;',
]) requireText('src/components/visual/FinancialBackdrop.tsx', text);

for (const text of [
  '.login-shell {',
  'z-index: auto;',
  'isolation: auto;',
  'filter: none;',
  'transform: none;',
  'display: block;',
  'margin: 0;',
  'border: 0;',
  'border-radius: 0;',
  'padding: 0;',
  'overflow: visible;',
  'box-shadow: none;',
  'backdrop-filter: none;',
  '.login-content-layer {',
  'min-height: calc(100dvh - var(--space-8));',
  '.login-card {',
  'border-radius: var(--radius-card);',
  '.login-card .liquid-glass-surface__content {',
  'padding: var(--space-8);',
  'border-radius: var(--radius-card-mobile);',
  'padding: var(--space-5);',
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
  '.application-image-layer,',
  '.application-atmosphere-layer {',
  'html[data-app-backdrop="auth"] .application-image-layer img',
  'html[data-app-backdrop="auth"] .application-atmosphere-layer',
  'rgba(1, 7, 4, 0.62) 0%',
  'rgba(2, 10, 6, 0.6) 36%',
  'rgba(2, 8, 5, 0.82) 100%',
  'html[data-app-backdrop="auth"] .application-atmosphere-layer::before',
  'opacity: 0.12;',
  'html[data-app-backdrop="auth"] .application-atmosphere-layer::after',
  'opacity: 0.05;',
  '.application-content-root .login-shell',
  'background: transparent !important;',
  'html[data-app-surface="auth"] .application-content-root {',
  'html[data-app-surface="auth"] .application-image-layer {',
  'z-index: -2;',
  'html[data-app-surface="auth"] .application-atmosphere-layer {',
  'z-index: -1;',
]) requireText('src/styles/financial-backdrop.css', text);

for (const text of [
  '--liquid-glass-contrast: rgba(194, 231, 214, 0.06);',
  '--liquid-glass-auth-fallback:',
  '.liquid-glass-surface[data-liquid-glass-layout="content"]',
  '.liquid-glass-surface[data-liquid-glass-layout="content"] .liquid-glass-surface__content {',
  'height: auto !important;',
  '.liquid-glass-surface__effect[data-liquid-glass-measuring="true"] {',
  'transform: translate(-50%, -50%) scale(1) !important;',
  'transition: none !important;',
  '.liquid-glass-surface--desktopAuthCard .glass__warp,',
  '.liquid-glass-surface--mobileAuthCard .glass__warp {',
  '-webkit-backdrop-filter: blur(4px) saturate(140%);',
  '.liquid-glass-surface--desktopAuthCard::after,',
  '.liquid-glass-surface--mobileAuthCard::after {',
  'content: none;',
  '.liquid-glass-surface--desktopAuthCard > span,',
  '.liquid-glass-surface--mobileAuthCard > span {',
  'display: block !important;',
  '.liquid-glass-surface[data-liquid-glass-over-light="true"] > div:not(.liquid-glass-surface__effect)',
  '.liquid-glass-surface[data-liquid-glass-over-light="true"]:not(.liquid-glass-surface--desktopAuthCard):not(.liquid-glass-surface--mobileAuthCard) > div:not(.liquid-glass-surface__effect)',
  'background: #000 !important;',
  'padding: 1.5px !important;',
  '-webkit-mask-composite: xor;',
  'mask-composite: exclude;',
  'mix-blend-mode: overlay !important;',
  'background: transparent;',
  'box-shadow: none;',
  'position: absolute !important;',
  'inset: 0 !important;',
  'width: 100% !important;',
  'height: 100% !important;',
  'box-sizing: border-box !important;',
  'padding: 0 !important;',
  'transform: none !important;',
  '-webkit-mask: none !important;',
  'mask: none !important;',
  '-webkit-mask-composite: source-over !important;',
  'mask-composite: add !important;',
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
  '.application-image-layer',
  '.application-atmosphere-layer',
  '.login-content-layer',
]) forbidText('src/styles/globals.css', text);
for (const text of ['.login-shell', '.login-card.panel']) forbidText('src/styles/card-system.css', text);
for (const text of ['AUTH_BACKGROUND_IMAGE_URL', 'AUTH_BACKGROUND_IMAGE_960_URL', 'upload.wikimedia.org']) {
  forbidText('src/app/LoginPage.tsx', text);
}

const mainSource = read('src/main.tsx');
for (const text of [
  "import { FinancialBackdrop } from './components/visual/FinancialBackdrop';",
  "document.documentElement.dataset.appSurface = 'loading';",
  'document.documentElement.dataset.appBackdrop =',
  "document.documentElement.dataset.appTone = 'normal';",
  '<FinancialBackdrop />',
  '<div className="application-content-root">',
]) requireText('src/main.tsx', text);
const backdropNodeIndex = mainSource.indexOf('<FinancialBackdrop />');
const strictModeIndex = mainSource.indexOf('<React.StrictMode>');
if (!(backdropNodeIndex >= 0 && strictModeIndex > backdropNodeIndex)) {
  failures.push('持久摄影节点必须在 StrictMode 与错误边界之外先渲染');
}
const gameLayoutIndex = mainSource.indexOf("import './styles/game-shell-layout.css';");
const backdropStyleIndex = mainSource.indexOf("import './styles/financial-backdrop.css';");
const glassIndex = mainSource.indexOf("import './styles/liquid-glass-surfaces.css';");
if (!(gameLayoutIndex >= 0 && backdropStyleIndex > gameLayoutIndex && glassIndex > backdropStyleIndex)) {
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
  '整个应用生命周期只允许一个摄影 `<picture>` 节点',
  '`AuthCardSurface`',
  '`desktopAuthCard`',
  '`mobileAuthCard`',
  '移动登录氛围层必须比原基线更透明',
  '`rgba(1, 7, 4, 0.62)`',
  '`rgba(2, 10, 6, 0.6)`',
  '`rgba(2, 8, 5, 0.82)`',
  '位于第三方 `.glass` 内的 `.liquid-glass-surface__content`',
  '不得通过 revision 或 React `key` 重建认证内容',
  '认证宿主背景必须透明',
  '不得再创建 `--liquid-glass-tint-dark`、`.liquid-glass-surface__material-fill`',
  '认证专用对照参数',
  '`displacementScale=70`',
  '`elasticity=0`',
  '`mouseContainer={null}`',
  '不得开启鼠标、触控板、触笔或触摸跟踪',
  '首次绘制前同步提交宿主高度',
  '两个边缘高光 `span` 必须直接使用宿主的 `100%` 宽高',
  '不得保留第三方尺寸过渡',
  '中性测量态',
  '`scrollHeight`／`offsetHeight`',
  '不得绘制项目 `::after` 结构描边',
  '认证宿主背景必须透明',
  '认证专用对照参数',
  '第三方 `.glass` 的官方 `0 12px 40px rgba(0, 0, 0, 0.25)` 阴影不得被项目 CSS 覆盖',
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
  '`elasticity: 0`',
  '`mouseContainer={null}`',
  '首次绘制前同步提交',
  '可见高光几何直接绑定认证宿主',
  '两个透明辅助 `div`',
  '认证宿主必须透明且无项目阴影',
  '摄影 `<picture>` 固定挂载在 `main.tsx`',
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
  "page.locator('.application-image-layer')",
  "page.locator('.application-atmosphere-layer')",
  "page.locator('.login-content-layer')",
  "toHaveAttribute('data-liquid-glass-variant', 'desktopAuthCard')",
  "toHaveAttribute('data-liquid-glass-variant', 'mobileAuthCard')",
  "toHaveAttribute('data-liquid-glass-layout', 'content')",
  "toHaveAttribute('data-liquid-glass-elasticity', '0')",
  "toHaveAttribute('data-liquid-glass-over-light', 'false')",
  'keeps photography, atmosphere and authentication glass in one isolated sampling root',
  'expect(stacking.sharesRoot).toBe(true)',
  "expect(stacking.image.zIndex).toBe('-2')",
  "expect(stacking.atmosphere.zIndex).toBe('-1')",
  'keeps one authentication glass instance and form values while switching breakpoints',
  'registration content grows inside the same glass surface without an internal scrollport',
  'keeps the official auth highlights aligned with the card bottom on the first frame of mode changes',
  'expectAuthVisibleGeometryAlignedNextFrame',
  'requestAnimationFrame(() => resolve())',
  'directDecorationBottoms',
  'directDecorationTransitionProperties',
  'glassTransitionProperty',
  "expect(glass.glassTransitionProperty).toBe('none')",
  "expect(glass.directDecorationTransitionProperties).toEqual(['none', 'none'])",
  'keeps photography, atmosphere and authentication glass in one isolated sampling root',
  'readMobileAtmosphere',
  "expect(atmosphere.gridOpacity).toBe('0.12')",
  "expect(atmosphere.noiseOpacity).toBe('0.05')",
  "expect(glass.surfaceBackground).toBe('rgba(0, 0, 0, 0)')",
  "expect(glass.surfaceBoxShadow).toBe('none')",
  "expect(glass.glassBoxShadow).toContain('0px 12px 40px')",
  "expect(glass.glassBoxShadow).toContain('rgba(0, 0, 0, 0.25)')",
  "expect(glass.surfaceElasticity).toBe('0')",
  'expect(glass.contentInsideGlass).toBe(true)',
  'expect(glass.materialFillCount).toBe(0)',
  "expect(glass.outlineContent).toBe('none')",
  'expect(glass.visibleDirectDecorationSpanCount).toBe(2)',
  'expect(glass.visibleDirectAuxiliaryDivCount).toBe(0)',
  "expect(glass.directAuxiliaryPaddings).toEqual(['0px', '0px'])",
  "expect(glass.directAuxiliaryBackgroundColors).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'])",
  "expect(glass.directAuxiliaryOpacities).toEqual(['1', '1'])",
  "expect(glass.directAuxiliaryMaskImages).toEqual(['none', 'none'])",
  '!/xor|exclude/.test(value)',
  'expect(Math.abs(glass.displacementScales[0])).toBe(70)',
  'toMatch(/saturate\\((?:140%|1\\.4)\\)/)',
  'page.mouse.move',
  '.toBe(initialEffectTransform)',
  '.toEqual(initialHighlightBackgrounds)',
  "await expect(email).toHaveValue('kept@example.com')",
]) requireText('tests/browser/auth-three-layer.spec.ts', text);
for (const text of [
  "import LiquidGlass from 'liquid-glass-react'",
  "import { LiquidGlassSurface } from '../../src/components/ui/LiquidGlassSurface'",
  "import { FinancialBackdrop } from '../../src/components/visual/FinancialBackdrop'",
  '<FinancialBackdrop />',
  'data-comparison-sampling-layer="true"',
  'overLight={false}',
  'variant="desktopAuthCard"',
  'blurAmount={0}',
  'saturation={140}',
  'globalMousePos={STATIC_MOUSE_POSITION}',
  'mouseOffset={STATIC_MOUSE_OFFSET}',
  'data-comparison-surface="official"',
  'data-comparison-surface="project"',
]) requireText('tests/browser/liquid-glass-reference-harness.tsx', text);
for (const text of [
  'width: 440px;',
  'height: 352px;',
  'background: transparent;',
  '.liquid-glass-reference-sampling-layer > .application-image-layer,',
  '.liquid-glass-reference-sampling-layer > .application-atmosphere-layer {',
  'z-index: -2;',
  'z-index: -1;',
  'isolation: auto;',
]) requireText('tests/browser/liquid-glass-reference.css', text);
for (const text of [
  'matches official material under identical background, geometry, content and static input',
  'cardRect: { width: 440, height: 352 }',
  "surfaceBackground: 'rgba(0, 0, 0, 0)'",
  "glassBoxShadow: expect.stringContaining('0px 12px 40px')",
  '/blur\\(4px\\) saturate\\((?:140%|1\\.4)\\)/',
  "expect(comparison.imageSource).toContain('No_Known_Restrictions_Trading_Floor')",
  "expect(comparison.imageFilter).toBe('saturate(0.72) contrast(1.08) brightness(0.72)')",
  "expect(comparison.atmosphereBackground).toContain('linear-gradient')",
  'expect(comparison.imageAndAtmosphereShareParent).toBe(true)',
  'expect(comparison.backgroundAndGlassShareSamplingRoot).toBe(true)',
  'expect(comparison.glassSharesSamplingRoot).toBe(true)',
  "expect(comparison.imageLayerZIndex).toBe('-2')",
  "expect(comparison.atmosphereLayerZIndex).toBe('-1')",
  "expect(comparison.glassWrapperZIndexes).toEqual(['auto', 'auto', 'auto', 'auto'])",
  "expect(comparison.contentZIndex).toBe('auto')",
  "expect(comparison.samplingLayerIsolation).toBe('isolate')",
  "maskImage: 'none'",
  'expect(comparison.projectBackground).toBe(comparison.officialBackground)',
]) requireText('tests/browser/liquid-glass-reference.spec.ts', text);

if (failures.length > 0) {
  console.error('登录三层结构与持久摄影背景验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('登录三层结构、根级持久摄影、认证首帧高度同步、宿主绑定双层高光、静态输入、几何同步与表单状态保持验证通过。');
}
