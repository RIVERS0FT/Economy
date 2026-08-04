import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content, 'utf8');

function replaceRequired(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Missing authority migration anchor: ${label}`);
  return content.replace(before, after);
}

const liquidPath = 'docs/LIQUID_GLASS_CHROME_DESIGN.md';
let liquid = read(liquidPath);

liquid = replaceRequired(
  liquid,
  '| `GameShell.tsx` | 向共享外壳提供玩家侧栏、单一状态栏、移动通知和玩家移动导航；不得挂载背景节点 |',
  '| `GameShell.tsx` | 向共享外壳提供玩家侧栏、单一状态栏、统一通知入口、关闭态 Toast、通知面板和玩家移动导航；不得挂载背景节点 |\n| `notificationCenter.ts` | 普通通知二十条历史、稳定待处理键、状态派生、已读与删除纯函数；不得创建通知专用轮询 |\n| `useNotificationCenter.ts` | 按玩家隔离的通知持久化、面板开关、打开态 Toast 抑制、关闭态 Toast 队列和待处理状态转换监听 |\n| `NotificationCenter.tsx` | 状态栏入口、工作区通知面板、待处理与普通通知列表、清除已读、单条删除和可点击关闭态 Toast；不得导入液态玻璃组件 |',
  'GameShell file responsibility',
);
liquid = replaceRequired(
  liquid,
  '| `StatusBar.tsx` | 保持单一玩家状态栏实例，按 `720px` 断点选择预设，直接承载固定五列状态内容，并使用单一 `ResizeObserver` 与合并后的 `requestAnimationFrame` 对移动端真实溢出的主数值逐项缩小字号；不得引入 `ScrollArea` |',
  '| `StatusBar.tsx` | 保持单一玩家状态栏实例，按 `720px` 断点选择预设；`.asset-bar-layout` 左侧直接承载固定五列状态内容，右侧只承载独立通知工具位，并使用单一 `ResizeObserver` 与合并后的 `requestAnimationFrame` 对移动端真实溢出的主数值逐项缩小字号；不得引入 `ScrollArea` |',
  'StatusBar file responsibility',
);
liquid = replaceRequired(
  liquid,
  '| `mobile-status-layout.css` | 移动状态栏固定五列、图标与数值几何、数值自适应 CSS 变量、`clip` 溢出策略和移动通知定位 |',
  '| `mobile-status-layout.css` | 移动状态栏固定五列、图标与数值几何、数值自适应 CSS 变量、`clip` 溢出策略、关闭态 Toast 定位及其点击恢复 |\n| `notification-center.css` | 状态栏独立通知工具轨道、桌面／移动面板几何、待处理与普通通知视觉、关闭态 Toast 队列和响应式交互 |\n| `verify-notification-center.mjs` | 二十条上限、待处理稳定键、打开态抑制、清除与删除边界、单一工作区 Portal、无新增玻璃和文档规则防回退 |\n| `notification-center.spec.ts` | 桌面工作区右上角、移动状态栏下方安全区、固定五列、单玻璃实例与可点击关闭态 Toast 浏览器几何回归 |',
  'mobile notification style responsibility',
);
liquid = replaceRequired(
  liquid,
  '- Chrome Overlay 使用 `pointer-events: none`，只有状态栏和底栏恢复交互；',
  '- Chrome Overlay 使用 `pointer-events: none`，只有状态栏、底栏和实际显示的关闭态 Toast 恢复交互；通知面板位于工作区浮层，不得借用 Chrome Overlay；',
  'mobile chrome pointer boundary',
);
liquid = replaceRequired(
  liquid,
  '- 移动操作结果通知必须位于 `GameShell` 的 `.mobile-chrome-overlay` 内容内，DOM 顺序固定为 `StatusBar` 后、`MobileBottomNavigation` 前；不得放入 `.mobile-page-overlay` 或 `.page-scroll`；\n- 通知顶部固定为安全区顶部 + `48px` 状态栏 + `8px` 间距，左右各 `8px`，内容水平居中且最大宽度 `30rem`；通知使用普通半透明提示样式，不新增液态玻璃实例；\n- 通知宿主与提示本体均不得拦截指针事件，通知显示／隐藏不得推动页面内容、状态栏或底栏，也不得改变页面滚动高度；',
  '- 玩家通知按钮固定为同一状态栏玻璃内容层最右侧独立工具位；五项经济状态仍由 `.asset-bar-content` 固定五列承载，通知按钮不得成为第六个等宽状态项。\n- 移动通知面板必须 Portal 到 `SignedInShell` 现有 `.workspace-floating-layer`，顶部从 `48px` 状态栏下方开始，底部止于 `68px` 移动导航上方；面板不得进入 `.mobile-chrome-overlay`、`.page-scroll`、根级 Dialog 层或 `document.body`，也不得新增液态玻璃实例。\n- 面板关闭时，操作结果以及新增或原因变化的待处理事项使用 `.mobile-chrome-overlay` 内的关闭态 Toast；DOM 顺序固定为 `StatusBar` 后、`MobileBottomNavigation` 前。Toast 顶部固定为安全区顶部 + `48px` 状态栏 + `8px`，左右各 `8px`，内容水平居中且最大宽度 `30rem`。\n- 关闭态 Toast 宿主保持 `pointer-events:none`，实际 `.notification-toast` 必须恢复 `pointer-events:auto`，点击后打开通知面板；面板打开时立即清空 Toast 队列，并禁止同时显示面板外 Toast。面板与 Toast 显示／隐藏都不得推动页面内容、状态栏或底栏，也不得改变页面滚动高度；',
  'mobile notification behavior bullets',
);
liquid = replaceRequired(
  liquid,
  '- 玩家状态栏 DOM 固定为 `header.asset-bar → LiquidGlassSurface → .liquid-glass-surface__content → .asset-bar-content → 五个状态项`；状态栏范围内不得出现 `.ui-scroll-area`、`.ui-scroll-area__viewport`、`.ui-scrollbar`、`.asset-bar-scroll-area` 或 `.asset-bar-scroll-track`；\n- 状态栏固定五列布局，玻璃宽度始终等于宿主可视宽度，内容不得扩大玻璃最小宽度；',
  '- 玩家状态栏 DOM 固定为 `header.asset-bar → LiquidGlassSurface → .liquid-glass-surface__content → .asset-bar-layout → (.asset-bar-content → 五个状态项) + (.asset-bar-action → 唯一通知按钮)`；状态栏范围内不得出现 `.ui-scroll-area`、`.ui-scroll-area__viewport`、`.ui-scrollbar`、`.asset-bar-scroll-area` 或 `.asset-bar-scroll-track`；\n- `.asset-bar-content` 继续固定五列，`.asset-bar-action` 使用桌面 `56px`、紧凑桌面 `48px`、移动 `40px` 的独立轨道；玻璃宽度始终等于宿主可视宽度，状态内容和通知工具位都不得扩大玻璃最小宽度；',
  'status bar DOM rule',
);
write(liquidPath, liquid);

const uiPath = 'docs/UI_DESIGN_SYSTEM.md';
let ui = read(uiPath);
if (!ui.includes('## 通知面板与关闭态 Toast')) {
  ui = `${ui.trimEnd()}\n\n## 通知面板与关闭态 Toast\n\n- 玩家通知入口只有状态栏最右侧按钮。数字只表示当前未解决待处理事项，普通未读通知使用独立圆点；二者不得合并成同一数字。\n- 桌面通知面板在工作区右上角展开，移动通知面板在状态栏下方、底部导航上方展开。面板使用普通高不透明度深色表面、单一纵向滚动区和工作区安全浮层，不使用液态玻璃、根级 Dialog 或页面内嵌卡片。\n- 待处理条目使用严重程度文字、图标和左侧标记三重表达，只提供前往处理，不提供删除；问题解决后由状态派生自动移除。普通通知显示图标、标题、可选说明、时间与至少 `40×40px` 删除按钮。\n- 面板头部固定提供“清除已读”和关闭按钮。“清除已读”只删除已读普通通知，禁用态必须可辨识；单条删除不弹确认框，也不得产生新的成功通知。\n- 面板关闭时使用关闭态 Toast。桌面最多同时显示三条，移动只显示队列最后一条；Toast 必须可点击打开通知面板。面板打开时清空 Toast 并停止外部弹出。\n- 面板支持外部点击、`Escape` 和关闭按钮，关闭后焦点返回通知入口；入口使用 `aria-expanded`／`aria-controls`，面板使用命名 `dialog`，删除按钮必须包含具体通知标题的可访问名称。\n- `prefers-reduced-motion` 下关闭 Toast 位移动画；颜色不得作为待处理严重程度、未读状态或操作结果的唯一表达。\n`;
  write(uiPath, ui);
}

const verifierPath = 'scripts/verify-notification-center.mjs';
let verifier = read(verifierPath);
verifier = replaceRequired(
  verifier,
  "assert.match(styles, /\\.notification-toast:not\\(:last-child\\)/);\n\nconst pageDesign",
  "assert.match(styles, /\\.notification-toast:not\\(:last-child\\)/);\n\nconst mobileStatusStyles = read('src/styles/mobile-status-layout.css');\nassert.match(mobileStatusStyles, /\\.mobile-notice-region \\.notification-toast/);\nassert.match(mobileStatusStyles, /pointer-events:\\s*auto/);\n\nconst pageDesign",
  'mobile toast click verification',
);
verifier = replaceRequired(
  verifier,
  "assert.match(pageDesign, /待处理事项不能删除/);\n\nconsole.log",
  "assert.match(pageDesign, /待处理事项不能删除/);\n\nconst liquidDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');\nassert.match(liquidDesign, /\\.asset-bar-layout/);\nassert.match(liquidDesign, /实际 `\\.notification-toast` 必须恢复 `pointer-events:auto`/);\nassert.match(liquidDesign, /面板打开时立即清空 Toast 队列/);\n\nconst uiDesign = read('docs/UI_DESIGN_SYSTEM.md');\nassert.match(uiDesign, /## 通知面板与关闭态 Toast/);\nassert.match(uiDesign, /移动只显示队列最后一条/);\nassert.match(uiDesign, /关闭后焦点返回通知入口/);\n\nconsole.log",
  'notification authority verification',
);
write(verifierPath, verifier);

const browserPath = 'tests/browser/notification-center.spec.ts';
let browser = read(browserPath);
browser = replaceRequired(
  browser,
  '        panelMaxHeight: getComputedStyle(panel).maxHeight,',
  '        panelMaxHeight: getComputedStyle(panel).maxHeight,\n        toastPointerEvents: getComputedStyle(toast).pointerEvents,',
  'mobile toast pointer geometry',
);
browser = replaceRequired(
  browser,
  "    expect(geometry.panelMaxHeight).not.toBe('none');",
  "    expect(geometry.panelMaxHeight).not.toBe('none');\n    expect(geometry.toastPointerEvents).toBe('auto');",
  'mobile toast pointer assertion',
);
write(browserPath, browser);
