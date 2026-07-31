import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
const requireOrder = (path, entries) => {
  const content = read(path);
  let previous = -1;
  for (const entry of entries) {
    const current = content.indexOf(entry);
    if (current < 0 || current <= previous) {
      failures.push(`${path} 加载顺序错误: ${entries.join(' -> ')}`);
      return;
    }
    previous = current;
  }
};
const walk = (path) => readdirSync(resolve(root, path)).flatMap((entry) => {
  const relative = `${path}/${entry}`;
  return statSync(resolve(root, relative)).isDirectory() ? walk(relative) : [relative];
});

const files = {
  surface: 'src/components/ui/LiquidGlassSurface.tsx',
  authCard: 'src/components/auth/AuthCardSurface.tsx',
  styles: 'src/styles/liquid-glass-surfaces.css',
  authStyles: 'src/styles/auth.css',
  compatibility: 'src/styles/liquid-glass-chrome.css',
  sharedShell: 'src/components/shell/SignedInShell.tsx',
  gameShell: 'src/components/shell/GameShell.tsx',
  adminBar: 'src/components/shell/AdminDesktopBar.tsx',
  status: 'src/components/shell/StatusBar.tsx',
  mobile: 'src/components/shell/MobileBottomNavigation.tsx',
  mobileFrame: 'src/components/shell/MobileBottomNavigationFrame.tsx',
  viewport: 'src/styles/viewport.css',
  scrollbars: 'src/styles/scrollbars.css',
  layout: 'src/styles/game-shell-layout.css',
  mobileNavigation: 'src/styles/mobile-status-navigation.css',
  mobileStatus: 'src/styles/mobile-status-layout.css',
  adminNavigation: 'src/styles/admin-navigation.css',
  design: 'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  authDesign: 'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
  browser: 'tests/browser/liquid-glass-layout.spec.ts',
  authBrowser: 'tests/browser/auth-three-layer.spec.ts',
  referenceBrowser: 'tests/browser/liquid-glass-reference.spec.ts',
  referenceHarness: 'tests/browser/liquid-glass-reference-harness.tsx',
  referenceStyles: 'tests/browser/liquid-glass-reference.css',
  adminBrowser: 'tests/browser/admin-runtime.spec.ts',
  mobileBrowser: 'tests/browser/mobile-workspace-overlay.spec.ts',
  navigationBrowser: 'tests/browser/mobile-navigation-scrollbar.spec.ts',
  main: 'src/main.tsx',
  package: 'package.json',
};

Object.values(files).forEach(requireFile);

if (failures.length === 0) {
  const packageJson = JSON.parse(read(files.package));
  if (packageJson.dependencies?.['liquid-glass-react'] !== '1.1.1') {
    failures.push('liquid-glass-react 必须固定为 1.1.1');
  }

  const directImports = walk('src')
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .filter((path) => read(path).includes("from 'liquid-glass-react'"));
  if (directImports.length !== 1 || directImports[0] !== files.surface) {
    failures.push(`只有 ${files.surface} 可以直接导入 liquid-glass-react`);
  }

  for (const text of [
    "| 'desktopStatusBar'",
    "| 'mobileStatusBar'",
    "| 'mobileNavigation'",
    "| 'desktopAuthCard'",
    "| 'mobileAuthCard'",
    "export type LiquidGlassSurfaceLayout = 'fixed' | 'content'",
    'const DESKTOP_STATUS_GLASS = {',
    'displacementScale: 70',
    'blurAmount: 0',
    'saturation: 140',
    'aberrationIntensity: 2',
    'elasticity: 0',
    'const MOBILE_CHROME_GLASS = {',
    'displacementScale: 70',
    'blurAmount: 0',
    'saturation: 140',
    'aberrationIntensity: 2',
    'const DESKTOP_AUTH_CARD_GLASS = {',
    'const MOBILE_AUTH_CARD_GLASS = {',
    'displacementScale: 70',
    'saturation: 140',
    'aberrationIntensity: 2',
    'desktopStatusBar: DESKTOP_STATUS_GLASS',
    'mobileStatusBar: MOBILE_CHROME_GLASS',
    'mobileNavigation: MOBILE_CHROME_GLASS',
    'desktopAuthCard: DESKTOP_AUTH_CARD_GLASS',
    'mobileAuthCard: MOBILE_AUTH_CARD_GLASS',
    'elasticity={preset.elasticity}',
    'mouseContainer={null}',
    'globalMousePos={STATIC_MOUSE_POSITION}',
    'mouseOffset={STATIC_MOUSE_OFFSET}',
    'const GLOBAL_OVER_LIGHT = false;',
    'overLight = GLOBAL_OVER_LIGHT,',
    'overLight={overLight}',
    "data-liquid-glass-over-light={overLight ? 'true' : 'false'}",
    'data-liquid-glass-layout={layout}',
    'data-liquid-glass-elasticity={preset.elasticity}',
    "data-liquid-glass-over-light={overLight ? 'true' : 'false'}",
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
  ]) requireText(files.surface, text);
  for (const text of [
    'setSurfaceRevision',
    'liquid-glass-surface__material-fill',
    '--liquid-glass-tint-dark',
    'data-liquid-glass-tint',
    'contentElement.getBoundingClientRect().height',
    'const IOS_CLEAR_THICK_GLASS = {',
    'statusBar: IOS_CLEAR_THICK_GLASS',
    "mode: 'prominent'",
    'mode="shader"',
    'cornerRadius: 20',
    'elasticity: 0.15',
    'const hasLiquidMotion = preset.elasticity > 0;',
    'mouseContainerRef',
  ]) forbidText(files.surface, text);
  if ((read(files.surface).match(/displacementScale:\s*70,/g) ?? []).length !== 4) {
    failures.push('四个玻璃预设必须全部固定 displacementScale: 70');
  }
  if ((read(files.surface).match(/blurAmount:\s*0,/g) ?? []).length !== 4) {
    failures.push('四个玻璃预设必须全部固定 blurAmount: 0');
  }
  if ((read(files.surface).match(/saturation:\s*140,/g) ?? []).length !== 4) {
    failures.push('四个玻璃预设必须全部固定 saturation: 140');
  }
  if ((read(files.surface).match(/aberrationIntensity:\s*2,/g) ?? []).length !== 4) {
    failures.push('四个玻璃预设必须全部固定 aberrationIntensity: 2');
  }
  if ((read(files.surface).match(/elasticity:\s*0,/g) ?? []).length !== 4) {
    failures.push('桌面状态栏、移动 Chrome、桌面认证卡和移动认证卡必须全部固定 elasticity: 0');
  }
  if ((read(files.surface).match(/cornerRadius:\s*24/g) ?? []).length !== 2) {
    failures.push('桌面状态栏与桌面认证卡必须各定义一个 24px cornerRadius 预设');
  }
  if ((read(files.surface).match(/cornerRadius:\s*40/g) ?? []).length !== 2) {
    failures.push('移动 Chrome 与移动认证卡必须各定义一个 40px cornerRadius 预设');
  }

  for (const text of [
    "const MOBILE_AUTH_MEDIA_QUERY = '(max-width: 720px)'",
    'type AuthCardSurfaceVariant = Extract<',
    "'desktopAuthCard' | 'mobileAuthCard'",
    'variant={surfaceVariant}',
    'layout="content"',
    'overLight={false}',
    'blurAmount={0}',
    'saturation={140}',
    'className="login-card"',
  ]) requireText(files.authCard, text);

  for (const text of [
    "type StatusBarSurfaceVariant = Extract<LiquidGlassSurfaceVariant, 'desktopStatusBar' | 'mobileStatusBar'>",
    "const MOBILE_STATUS_MEDIA_QUERY = '(max-width: 720px)'",
    "return window.matchMedia(MOBILE_STATUS_MEDIA_QUERY).matches ? 'mobileStatusBar' : 'desktopStatusBar'",
    '<LiquidGlassSurface variant={surfaceVariant}>',
    'className="asset-bar"',
    'className="asset-bar-content"',
  ]) requireText(files.status, text);
  for (const text of ["import { ScrollArea }", '<ScrollArea', 'asset-bar-scroll-area', 'asset-bar-scroll-track']) {
    forbidText(files.status, text);
  }

  for (const text of [
    "import { ScrollArea } from '../ui/ScrollArea'",
    "'signed-in-shell'",
    'className="mobile-page-overlay"',
    "'mobile-chrome-overlay'",
    'className="page-scroll-area"',
    "'page-scroll'",
    'scrollbarVisibility="adaptive"',
  ]) requireText(files.sharedShell, text);
  for (const text of [
    "import { SignedInShell } from './SignedInShell'",
    '<SignedInShell',
    '<StatusBar items={statusItems} />',
    '<MobileBottomNavigation',
  ]) requireText(files.gameShell, text);
  for (const text of [
    "import { LiquidGlassSurface } from '../ui/LiquidGlassSurface'",
    'className="asset-bar admin-command-bar"',
    'variant="desktopStatusBar"',
  ]) requireText(files.adminBar, text);
  for (const text of [
    'className="sidebar mobile-bottom-navigation"',
    '<LiquidGlassSurface variant="mobileNavigation">',
    'className="mobile-bottom-navigation__viewport"',
  ]) requireText(files.mobileFrame, text);
  for (const text of ["import { ScrollArea }", '<ScrollArea', 'mobile-navigation-frame', 'mobile-navigation-scroll-area']) {
    forbidText(files.mobile, text);
    forbidText(files.mobileFrame, text);
  }

  for (const text of [
    '--liquid-glass-auth-fallback:',
    '.liquid-glass-surface {',
    'overflow: hidden;',
    '.liquid-glass-surface[data-liquid-glass-layout="content"] {',
    '.liquid-glass-surface[data-liquid-glass-layout="content"] .liquid-glass-surface__content {',
    'height: auto !important;',
    '.liquid-glass-surface__effect[data-liquid-glass-measuring="true"] {',
    'transform: translate(-50%, -50%) scale(1) !important;',
    'transition: none !important;',
    'pointer-events: auto;',
    '.liquid-glass-surface--desktopStatusBar .glass__warp,',
    '.liquid-glass-surface--mobileStatusBar .glass__warp,',
    '.liquid-glass-surface--mobileNavigation .glass__warp,',
    '.liquid-glass-surface--desktopAuthCard .glass__warp,',
    '.liquid-glass-surface--mobileAuthCard .glass__warp {',
    '-webkit-backdrop-filter: blur(4px) saturate(140%);',
    '.liquid-glass-surface--desktopStatusBar,',
    '.liquid-glass-surface--mobileStatusBar,',
    '.liquid-glass-surface--mobileNavigation,',
    '.liquid-glass-surface--desktopAuthCard,',
    '.liquid-glass-surface--mobileAuthCard {',
    'background: transparent;',
    'box-shadow: none;',
    '.liquid-glass-surface--desktopStatusBar::after,',
    '.liquid-glass-surface--mobileNavigation::after,',
    '.liquid-glass-surface--desktopAuthCard::after,',
    'content: none;',
    '.liquid-glass-surface--desktopStatusBar > span,',
    '.liquid-glass-surface--mobileNavigation > span,',
    '.liquid-glass-surface--desktopAuthCard > span,',
    'display: block !important;',
    'visibility: visible !important;',
    'position: absolute !important;',
    'inset: 0 !important;',
    'width: 100% !important;',
    'height: 100% !important;',
    'padding: 0 !important;',
    'background: transparent !important;',
    '-webkit-mask: none !important;',
    'mask: none !important;',
    '-webkit-mask-composite: source-over !important;',
    'mask-composite: add !important;',
    'background: var(--liquid-glass-auth-fallback);',
    'border-radius: 24px !important;',
    'border-radius: 40px !important;',
    'grid-template-columns: repeat(5, minmax(0, 1fr));',
    '.mobile-bottom-navigation .liquid-glass-surface__content {',
    'padding: 8px 0;',
  ]) requireText(files.styles, text);
  for (const text of [
    '--liquid-glass-auth-contrast:',
    '--liquid-glass-auth-mobile-contrast:',
    '--liquid-glass-contrast:',
    '--liquid-glass-structure-border:',
    'liquid-glass-surface__material-fill',
    '.liquid-glass-surface--statusBar',
    'border-radius: 999px !important;',
    '.workspace::before',
    'contain: paint;',
    'isolation: isolate;',
    'overflow: clip;',
    'padding: 1.5px !important;',
    'mask-composite: exclude;',
    '.liquid-glass-surface--mobileNavigation > span:first-of-type',
  ]) forbidText(files.styles, text);
  if (/^\s*backdrop-filter\s*:/m.test(read(files.styles))) {
    failures.push('项目 CSS 不得重写 liquid-glass-react 的非前缀 backdrop-filter');
  }
  if (/[^{}]*\.login-card[^{}]*\.glass[^{}]*\{[^}]*box-shadow:\s*none\s*!important;/m.test(read(files.styles))) {
    failures.push('认证卡片不得覆盖 liquid-glass-react 的官方 .glass 阴影');
  }
  for (const text of ['.login-card.panel', 'backdrop-filter: blur(22px)', 'backdrop-filter: blur(18px)']) {
    forbidText(files.authStyles, text);
  }

  requireOrder(files.main, [
    "import './styles/viewport.css'",
    "import './styles/scrollbars.css'",
    "import './styles/game-shell-layout.css'",
    "import './styles/financial-backdrop.css'",
    "import './styles/liquid-glass-surfaces.css'",
  ]);
  requireOrder(files.compatibility, [
    "@import './performance.css';",
    "@import './scrollbars.css';",
    "@import './game-shell-layout.css';",
    "@import './financial-backdrop.css';",
    "@import './liquid-glass-surfaces.css';",
  ]);

  for (const text of [
    'html[data-app-surface="admin"]',
    '.signed-in-shell {',
    '--layout-gutter: var(--mobile-primary-surface-gap);',
    'padding-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));',
    'padding-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));',
    'isolation: auto;',
    '.mobile-page-overlay,',
    '.mobile-chrome-overlay {',
    'z-index: auto;',
    'order: 1;',
    'order: 2;',
    'pointer-events: none;',
  ]) requireText(files.viewport, text);
  if (/\.mobile-bottom-navigation\s*\{[\s\S]*?position:\s*fixed;/.test(read(files.viewport))) {
    failures.push('移动底栏不得恢复 position: fixed');
  }
  if (!/\.asset-bar\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*auto;[^}]*top:\s*0;/.test(read(files.viewport))) {
    failures.push('桌面状态栏必须使用普通绘制顺序，不得建立正 z-index 合成层');
  }
  if (!/\.page-scroll\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*0;[^}]*padding-top:\s*calc\(var\(--desktop-asset-bar-height\)/.test(read(files.viewport))) {
    failures.push('桌面页面滚动层必须使用零层级封装业务子层，同时保持状态栏背景采样开放');
  }

  for (const text of [
    '.signed-in-shell.sidebar-layout {',
    '--desktop-layout-gutter: var(--space-3);',
    '--desktop-page-top-offset:',
    '.signed-in-shell .asset-bar {',
    '.signed-in-shell .page-scroll-area > .ui-scrollbar--vertical {',
    'right: 0;',
  ]) requireText(files.layout, text);
  if (!/\.signed-in-shell \.asset-bar\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*auto;/.test(read(files.layout))) {
    failures.push('桌面外壳不得用正 z-index 覆盖状态栏普通绘制顺序');
  }
  forbidText(files.layout, 'html[data-app-surface="game"]');

  for (const text of [
    '.admin-command-bar-content {',
    '.admin-page-frame .page-heading {',
    'display: none;',
    '.admin-command-bar {',
    '.admin-page-scroll {',
  ]) requireText(files.adminNavigation, text);
  for (const text of ['max-width: 1600px;', 'top: 112px;']) forbidText(files.adminNavigation, text);

  for (const text of [
    '--mobile-workspace-gutter: var(--space-3);',
    '.mobile-bottom-navigation {',
    'padding: 0;',
    '.mobile-bottom-navigation__viewport {',
    'padding-inline: var(--mobile-nav-scroll-gutter);',
    'overflow-x: auto;',
    'overflow-y: hidden;',
    'scrollbar-width: none;',
    'box-shadow: inset 0 0 0 2px rgba(123, 228, 158, .72);',
  ]) requireText(files.mobileNavigation, text);
  for (const text of ['.mobile-navigation-frame', '.mobile-navigation-scroll-area', 'outline-offset: 2px;']) {
    forbidText(files.mobileNavigation, text);
  }

  for (const text of [
    '.asset-bar {',
    'display: block;',
    'padding: 0;',
    'overflow: visible;',
    'grid-template-columns: repeat(5, minmax(0, 1fr));',
    'min-height: var(--mobile-asset-bar-height);',
    'max-height: var(--mobile-asset-bar-height);',
  ]) requireText(files.mobileStatus, text);
  for (const text of [
    '.page-scroll-area {',
    'overflow: visible;',
    '.page-scroll-area > .ui-scrollbar--vertical {',
    'position: fixed;',
    'right: env(safe-area-inset-right, 0px);',
    'transform: none;',
    '.page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb {',
    'right: var(--scrollbar-edge-offset);',
    'left: auto;',
  ]) requireText(files.scrollbars, text);

  for (const text of [
    '`liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现',
    '`DESKTOP_STATUS_GLASS`',
    '`MOBILE_CHROME_GLASS`',
    '`DESKTOP_AUTH_CARD_GLASS`',
    '`MOBILE_AUTH_CARD_GLASS`',
    '`desktopStatusBar`',
    '`mobileStatusBar`',
    '`mobileNavigation`',
    '`desktopAuthCard`',
    '`mobileAuthCard`',
    '`layout="content"`',
    '单个 `ResizeObserver`',
    '认证卡片任一时刻只能存在一个',
    '中性测量态',
    '`scrollHeight`／`offsetHeight`',
    '真实认证内容与状态栏内容使用相同的 `.glass` 内部位置',
    '所有宿主保持透明',
    '不得创建低密度宿主染色',
    '`blur(4px) saturate(140%)`',
    '两个辅助节点必须保留完整宿主几何但保持透明',
    '两个直属边缘高光 `span` 必须全部可见',
    '第三方 `.glass` 默认外部阴影必须保留',
    '任一时刻只能渲染一个状态栏玻璃实例',
    '顶部状态栏不得包含 `ScrollArea`',
    '固定五列布局',
    '不得创建 `::after` 结构描边',
    '固定到视口安全边缘',
    'right: env(safe-area-inset-right, 0px)',
    '开放的背景采样链',
    '`contain: paint`',
    '`isolation: isolate`',
    '`overflow: clip`',
    '`-webkit-backdrop-filter`',
    '浏览器运行时 harness 必须加载真实的滚动条与外壳几何样式',
    '语义化 `<nav>` 是移动底栏唯一横向滚动视口',
    '不得重新引入 `ScrollArea`',
    '移动底栏垂直留白只允许由 `.liquid-glass-surface__content` 提供',
    '`SignedInShell`',
    '管理员桌面玻璃工作栏',
    '所有四个用途预设都必须固定 `elasticity: 0`',
    '`mouseContainer={null}`',
    '不得开启鼠标、触控板、触笔或触摸跟踪',
  ]) requireText(files.design, text);
  for (const text of [
    '认证卡片必须使用 `src/components/auth/AuthCardSurface.tsx`',
    '位于第三方 `.glass` 内的 `.liquid-glass-surface__content`',
    '所有宿主背景必须透明',
    '统一悬浮玻璃对照参数',
    '第三方 `.glass` 的官方 `0 12px 40px rgba(0, 0, 0, 0.25)` 阴影不得被项目 CSS 覆盖',
    '`displacementScale=70`',
    '`elasticity=0`',
    '`mouseContainer={null}`',
    '不得开启鼠标、触控板、触笔或触摸跟踪',
    '两个边缘高光 `span` 必须全部可见',
    '都不得绘制项目 `::after` 结构描边',
    '不得在 `auth.css` 手写另一套 `backdrop-filter`',
    '注册内容较高时由文档视口纵向滚动',
  ]) requireText(files.authDesign, text);

  for (const text of [
    'desktop status bar uses the shared authentication-card material and shell inset',
    'status bar changes platform preset in place without rendering duplicate glass hosts',
    'mobile status and navigation share the authentication-card material while status remains single-shell',
    "toHaveAttribute('data-liquid-glass-variant', 'desktopStatusBar')",
    "toHaveAttribute('data-liquid-glass-variant', 'mobileStatusBar')",
    "toHaveAttribute('data-liquid-glass-variant', 'mobileNavigation')",
  ]) requireText(files.browser, text);
  for (const text of [
    "toHaveAttribute('data-liquid-glass-variant', 'desktopAuthCard')",
    "toHaveAttribute('data-liquid-glass-variant', 'mobileAuthCard')",
    "toHaveAttribute('data-liquid-glass-layout', 'content')",
    "toHaveAttribute('data-liquid-glass-elasticity', '0')",
    "toHaveAttribute('data-liquid-glass-over-light', 'false')",
    'keeps one authentication glass instance and form values while switching breakpoints',
    'keeps photography, atmosphere and authentication glass in one isolated sampling root',
    'expect(glass.contentInsideGlass).toBe(true)',
    'expect(glass.materialFillCount).toBe(0)',
    "expect(glass.outlineContent).toBe('none')",
    "expect(glass.surfaceElasticity).toBe('0')",
    'expect(glass.visibleDirectDecorationSpanCount).toBe(2)',
    "expect(glass.surfaceBackground).toBe('rgba(0, 0, 0, 0)')",
    "expect(glass.surfaceBoxShadow).toBe('none')",
    "expect(glass.glassBoxShadow).toContain('0px 12px 40px')",
    'expect(glass.visibleDirectAuxiliaryDivCount).toBe(0)',
    "expect(glass.directAuxiliaryPaddings).toEqual(['0px', '0px'])",
    "expect(glass.directAuxiliaryMaskImages).toEqual(['none', 'none'])",
    'expect(Math.abs(glass.displacementScales[0])).toBe(70)',
    'page.mouse.move',
    '.toBe(initialEffectTransform)',
    '.toEqual(initialHighlightBackgrounds)',
  ]) requireText(files.authBrowser, text);
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
  ]) requireText(files.referenceHarness, text);
  for (const text of [
    'width: 440px;',
    'height: 352px;',
    'background: transparent;',
    '.liquid-glass-reference-sampling-layer > .application-image-layer,',
    '.liquid-glass-reference-sampling-layer > .application-atmosphere-layer {',
    'z-index: -2;',
    'z-index: -1;',
    'isolation: auto;',
  ]) requireText(files.referenceStyles, text);
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
  ]) requireText(files.referenceBrowser, text);
  for (const text of [
    'admin desktop shares the game shell gutter, command bar and edge scrollbar',
    '.liquid-glass-surface--desktopStatusBar',
    'expect(geometry.commandHeight).toBeCloseTo(76, 0)',
  ]) requireText(files.adminBrowser, text);
  for (const text of ['mobile page scrollbar reaches the safe right edge without changing content width', 'viewportRight - geometry.thumbRight']) {
    requireText(files.mobileBrowser, text);
  }
  for (const text of [
    'mobile navigation uses one native scroll viewport without clipping its buttons',
    "locator('.ui-scroll-area')",
    "expect(state.contentPaddingTop).toBe('8px')",
  ]) requireText(files.navigationBrowser, text);
}

if (failures.length > 0) {
  console.error('liquid-glass-react 统一外壳与认证卡片架构验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('liquid-glass-react 登录后外壳、认证光学参数、全预设零弹性、静态鼠标输入、双层高光、认证透明宿主与统一透明宿主、平台预设、内容自适应、开放背景采样链与安全边缘滚动条验证通过。');
