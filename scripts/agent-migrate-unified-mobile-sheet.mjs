import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`${label}: 未找到旧规则`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`${label}: 旧规则命中不唯一`);
  return `${source.slice(0, first)}${to}${source.slice(first + from.length)}`;
}

function patch(path, replacements) {
  let source = readFileSync(path, 'utf8');
  for (const [from, to, label] of replacements) source = replaceOnce(source, from, to, `${path} / ${label}`);
  writeFileSync(path, source);
}

patch('docs/UI_DESIGN_SYSTEM.md', [
  [
    '| `src/styles/mobile-detail-sheet.css` | 移动一级 Page Sheet 与工厂、研发详情／市场自动交易等二级 Detail Sheet 的共享圆角、拖动、滚动区、安全区和动效最终权威；一级 Sheet 留在 workspace，只有二级 Detail 使用根级 Dialog 遮罩 |',
    '| `src/styles/mobile-detail-sheet.css` | 唯一根级 Mobile Workspace Sheet 的工厂详情卡片容器、遮罩、圆角、拖动、页面／详情内容层、滚动区、安全区和动效最终权威；所有移动业务页面与业务详情共用同一个根 Sheet，允许覆盖移动底部导航，不得创建第二个 Sheet DOM |',
    '移动 Sheet 样式职责',
  ],
  [
    '- `PageLayout`\n- `MobileWorkspacePageSheet`',
    '- `PageLayout`\n- `MobileWorkspaceSheetHost`\n- `MobileWorkspacePageSheet`',
    '共享组件登记 Host',
  ],
  [
    '`MobileWorkspacePageSheet` 与 `MobileWorkspaceDetailSheet` 必须共同复用 `useMobileWorkspaceSheetDrag` 作为唯一向下拖动、速度判定、回弹、关闭和 reduced-motion 内核；业务页面与详情组件不得复制第二套 Sheet 手势状态机。',
    '`MobileWorkspaceSheetHost` 是移动端唯一根级 Sheet 宿主，并独占 `useMobileWorkspaceSheetDrag` 的向下拖动、速度判定、回弹、关闭和 reduced-motion 状态机。`MobileWorkspacePageSheet` 只保留为 `GameShell` 的零 DOM 兼容适配器，`MobileWorkspaceDetailSheet` 只向 Host 注册详情内容和固定底栏；两者都不得创建自己的 Sheet 外框、遮罩、Portal 或第二套手势状态机。',
    '共享 Sheet 内核',
  ],
  [
    '### 3.1.1 登录后根级 Dialog 与移动 Page Sheet\n\n移动工作区只允许两级 Sheet 语义。`MobileWorkspacePageSheet` 是不大于 `720px` 时除纯地图外玩家页面的移动一级 Page Sheet：它必须留在普通 workspace 页面层、位于常驻状态栏与移动底栏之间，继续承载原页面 `PageLayout` 的固定标题和正文 `ScrollArea`，不得进入 `.workspace-dialog-layer`，不得启用模态遮罩、焦点陷阱或全局页面滚动锁，也不得压暗常驻地图。业务页面之间切换只替换一级 Sheet 内的页面内容；关闭、选择纯地图或正文顶部的有效向下拖动共用收起流程。\n\n普通 Tooltip、Popover、菜单和不应覆盖应用 Chrome 的业务浮层继续使用 `.workspace-floating-layer`。必须覆盖完整移动视口的模态业务详情统一作为二级 Detail Sheet 使用 `SignedInShell` 唯一 `.workspace-dialog-layer` 根级 Dialog 层；该根位于 Chrome 与移动一级 Page Sheet 之上、保持开放采样链并只让实际 Dialog 恢复指针事件。移动工厂详情、移动研发详情与市场自动交易设置必须共同复用 `MobileWorkspaceDetailSheet`，由 `src/styles/mobile-detail-sheet.css` 唯一控制遮罩、圆角、最大高度、页面滚动锁、焦点限制、唯一 `ScrollArea`、固定底栏和安全区；工厂与研发详情首区共同复用 `MobileDetailSummary`，市场自动交易设置复用统一商品选择器、采购／出售页签和既有仓库表单信息层级，并把原子保存动作放在共享固定底栏。一级 Page Sheet 与二级 Detail Sheet 的拖动、速度阈值、回弹和 reduced-motion 只能来自 `useMobileWorkspaceSheetDrag`，页面业务 CSS 只能定义正文内容和按钮语义，不得重新定义根级 Sheet 几何、滚动区内边距、sticky 底栏或第二套 Portal；详情内富内容列表继续使用同一根并位于遮罩上方，不得追加到 `document.body`。',
    '### 3.1.1 登录后唯一根级 Mobile Workspace Sheet\n\n不大于 `720px` 时，除纯地图外的所有玩家业务页面与业务详情共用同一个唯一根级 Mobile Workspace Sheet。`MobileWorkspaceSheetHost` 通过 `SignedInShell` 唯一 `.workspace-dialog-layer` 只挂载一份 `.mobile-detail-sheet-backdrop > .mobile-detail-sheet`，其外框、遮罩、最大高度、顶部拖动把手、页面滚动锁、焦点限制、安全区和动效全部沿用工厂详情卡片容器。该根 Sheet 底边贴物理视口底部，允许覆盖移动底部导航；底部导航可继续保留在 Chrome DOM 中，但 Sheet 打开期间其命中区域由根遮罩／Sheet 接管，只有整个根 Sheet 关闭到纯地图后才恢复交互。实体 Sheet 顶边仍应位于移动状态栏下方，遮罩可以覆盖完整移动视口。\n\n一级业务页面作为 Host 的基础内容层继续承载原页面 `PageLayout` 固定标题和页面自己的正文 `ScrollArea`；业务页面之间切换只替换基础内容并保持同一个 `.mobile-detail-sheet` DOM。工厂详情、研发详情与市场自动交易设置继续使用 `MobileWorkspaceDetailSheet` API，但该组件只能把详情正文和可选固定底栏 Portal 到 Host 预留的详情槽位，不得创建第二个 Sheet DOM。打开详情时在同一根 Sheet 内把基础页面设为 `inert` 并显示详情内容层；关闭详情、点击遮罩、按 `Escape` 或有效向下拖动只收起当前详情层并恢复原页面与触发焦点，根 Sheet 不卸载。仅当不存在详情层时，关闭页面、点击遮罩、按 `Escape` 或正文已到顶部的有效向下拖动才收起整个根 Sheet并进入 `map`。\n\n`MobileWorkspaceSheetHost` 是唯一允许调用 `useMobileWorkspaceSheetDrag`、`useWorkspaceDialogLayer`、创建根遮罩和实施页面滚动锁／焦点陷阱的组件；`MobileWorkspacePageSheet` 只是零 DOM 兼容适配器，`MobileWorkspaceDetailSheet` 只是内容注册器。普通 Tooltip、通知 Popover 与不应覆盖应用 Chrome 的业务浮层继续使用 `.workspace-floating-layer`；来自唯一根 Sheet 内的富下拉可以继续以 `.workspace-dialog-layer` 作为安全定位边界并位于 Sheet 之上。任何业务页、工厂详情、研发详情或自动交易设置都不得创建嵌套 `.mobile-detail-sheet`、第二个 backdrop、第二个根级 Portal 或平行拖动状态机。',
    '唯一根级 Sheet 章节',
  ],
  [
    '打开页面或通知面板不得在地图之上添加深色遮罩，通知点击捕获层必须透明。',
    '桌面打开页面或通知面板不得在地图之上添加深色遮罩，通知点击捕获层必须透明；移动端唯一根级 Mobile Workspace Sheet 是明确例外，统一使用工厂详情卡片容器的根遮罩压暗／模糊其后的地图与 Chrome。',
    '地图遮罩例外',
  ],
  [
    '- 让移动一级 Page Sheet 进入 `.workspace-dialog-layer`、增加模态遮罩／焦点陷阱、遮挡状态栏或移动底栏，或为不同一级页面复制第二套拖动状态机；',
    '- 绕过唯一根级 Mobile Workspace Sheet 让业务页面或详情创建第二个 Sheet DOM、第二个 backdrop、第二个根级 Portal 或平行拖动状态机；不得让一级页面重新退回 workspace 内独立 Page Sheet，也不得为了露出移动底部导航而把根 Sheet 底边抬到导航栏上方；',
    '防回退旧一级 Sheet',
  ],
  [
    '- 任一浮层都不得与桌面顶部状态栏／管理员工作栏、桌面侧栏、移动顶部状态栏或移动底栏相交；浮层的四条边必须落在工作区浮层根的真实矩形内。',
    '- 普通 Tooltip、Popover、菜单、通知面板等工作区安全浮层不得与桌面顶部状态栏／管理员工作栏、桌面侧栏、移动顶部状态栏或移动底栏相交；唯一根级 Mobile Workspace Sheet 是明确例外，其工厂详情卡片容器位于根级 Dialog 层并允许覆盖移动底部导航。',
    '浮层安全区唯一例外',
  ],
  [
    '- 模态浮层的遮罩也只能覆盖工作区；即使视觉上不覆盖状态栏和侧栏，打开期间仍必须通过焦点陷阱、`inert` 或共享交互锁阻止背景误操作。',
    '- 普通工作区模态浮层的遮罩仍只能覆盖所属工作区；唯一根级 Mobile Workspace Sheet 的遮罩按工厂详情既有语义覆盖完整移动视口，并通过焦点陷阱、基础页 `inert`、页面滚动锁和根级命中接管阻止被覆盖 Chrome 与背景页面误操作。',
    '模态遮罩唯一例外',
  ],
  [
    '- 页面底部预留空间必须保证最后一张卡能滚动到导航栏上方。',
    '- 移动端业务页面进入唯一根级 Mobile Workspace Sheet 后不再为被覆盖的底部导航预留外层空间；最后一张卡必须能在 Sheet 自身正文滚动区内完整滚到可见位置，并尊重根 Sheet 与安全区内边距。',
    '移动页面底部空间',
  ],
]);

patch('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  [
    '不大于 `720px` 时，纯 `map` 保持常驻战略地图基础表面；除纯地图外的玩家页面（包含十个可见业务页面与隐藏 `province`）统一由 `GameShell` 的移动一级 Page Sheet 承载。移动一级 Page Sheet 必须位于状态栏与移动底栏之间，继续复用各页面自身 `PageLayout` 的固定标题栏和正文 `ScrollArea`，不得进入根级模态 Dialog、不得让状态栏或底栏失去交互，也不得为了页面打开额外压暗或模糊地图。业务页面之间切换只替换 Sheet 内部内容并保持同一一级 Sheet 容器；右上关闭、回到纯地图或正文已位于顶部时的有效向下拖动共用收起流程，最终进入 `map`。正文未滚到顶部时下拉继续属于正文滚动。工厂详情、研发详情与市场自动交易设置等二级业务详情可以继续作为根级 Detail Sheet 覆盖一级 Page Sheet，并独立承担模态遮罩、焦点限制和滚动锁。',
    '不大于 `720px` 时，纯 `map` 保持常驻战略地图基础表面；除纯地图外的十个可见业务页面、隐藏 `province` 以及工厂详情、研发详情、市场自动交易设置等所有移动业务页面与业务详情共用同一个唯一根级 Mobile Workspace Sheet。该 Sheet 由 `MobileWorkspaceSheetHost` 在 `SignedInShell` 唯一 `.workspace-dialog-layer` 中复用工厂详情卡片容器，只允许存在一份 `.mobile-detail-sheet-backdrop > .mobile-detail-sheet`；根 Sheet 底边贴物理视口底部并允许覆盖移动底部导航，导航栏在被覆盖期间不承担指针命中，整个根 Sheet 关闭到 `map` 后才恢复交互。基础业务页面继续复用自身 `PageLayout` 固定标题和正文 `ScrollArea`，业务页面之间切换只替换同一根 Sheet 内的基础内容并保持根 DOM 实例。打开工厂／研发／自动交易详情时不得挂载第二个 Sheet，而是在同一根内把基础页设为 `inert` 并显示详情内容层；详情关闭只恢复原页面和触发焦点，根 Sheet 保持。仅当没有详情层时，页面关闭、遮罩点击、`Escape` 或正文顶部的有效向下拖动才收起整个根 Sheet并进入 `map`；正文未滚到顶部时下拉继续属于当前正文滚动。',
    '移动唯一根 Sheet',
  ],
  [
    '页面打开、关闭或切换不得为地图追加深色遮罩或改变地图亮度；',
    '桌面页面打开、关闭或切换不得为地图追加深色遮罩或改变地图亮度；移动唯一根级 Mobile Workspace Sheet 统一沿用工厂详情卡片容器的遮罩，在 Sheet 存在期间允许压暗／模糊地图与被覆盖 Chrome；',
    '移动地图遮罩例外',
  ],
]);

patch('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  [
    '- 不大于 `720px` 时桌面侧栏和右侧事件栏隐藏，`workspaceCard` 退化为无额外材质的结构容器；纯地图页继续只显示常驻战略地图，除纯地图外的玩家页面统一进入移动一级 Page Sheet。移动一级 Page Sheet 位于状态栏与移动底栏之间的工作区，不进入根级 Dialog，不遮挡或禁用两处 Chrome，不额外压暗或模糊地图；页面本身仍使用共享 `PageLayout` 的固定标题与内部唯一正文滚动区。',
    '- 不大于 `720px` 时桌面侧栏和右侧事件栏隐藏，`workspaceCard` 退化为无额外材质的结构容器；纯地图页继续只显示常驻战略地图，除纯地图外的玩家页面与工厂／研发／自动交易等业务详情统一进入唯一根级 Mobile Workspace Sheet。该 Host 在 `.workspace-dialog-layer` 中只挂载一份工厂详情卡片容器 `.mobile-detail-sheet-backdrop > .mobile-detail-sheet`，底边贴物理视口底部，允许覆盖移动底部导航；实体 Sheet 顶边保持在状态栏下方，根遮罩可覆盖完整视口并统一压暗／模糊其后的地图和 Chrome。页面本身仍使用共享 `PageLayout` 的固定标题与内部唯一正文滚动区。',
    '移动唯一 Sheet 外壳',
  ],
  [
    '- 移动一级 Page Sheet 只在首次由纯地图进入业务页面时执行底部打开动效；业务页面之间切换只替换 Sheet 内部页面内容并保持同一一级容器。右上关闭、移动底栏回到地图或正文已经位于顶部时的有效向下拖动都共用收起动效并最终切换到 `map`；正文 `scrollTop > 0` 时向下手势继续属于正文滚动。一级 Sheet 不使用焦点陷阱、页面滚动锁或模态遮罩。',
    '- 唯一根级 Mobile Workspace Sheet 只在首次由纯地图进入业务页面时执行根容器底部打开动效；业务页面之间切换只替换基础内容并保持同一 `.mobile-detail-sheet` DOM。工厂、研发或自动交易详情打开时在根内增加详情内容层并把基础页设为 `inert`，详情层使用同一拖动内核从底部进入；关闭详情只收起详情层并恢复原页面。没有详情层时，右上关闭、遮罩点击、`Escape` 或正文已经位于顶部时的有效向下拖动才收起整个根并切换到 `map`；正文 `scrollTop > 0` 时向下手势继续属于正文滚动。根 Sheet 统一承担工厂详情既有的页面滚动锁、焦点限制和遮罩。',
    '移动 Sheet 内容栈',
  ],
  [
    '- 根级业务 Dialog 只用于必须覆盖当前工作区的二级 Detail Sheet，并继续高于状态栏、移动底栏和移动一级 Page Sheet；工厂详情、研发详情、市场自动交易设置等二级 Detail Sheet 可以使用模态遮罩、焦点限制和页面滚动锁。普通 Tooltip、Popover 与菜单限制在工作区安全浮层内，一级 Page Sheet 不得进入 `.workspace-dialog-layer`。',
    '- 根级业务 Dialog 在移动玩家端由唯一 `MobileWorkspaceSheetHost` 统一占用，承载一级业务页面以及同根内的详情内容层，并继续高于移动底栏和普通工作区浮层。`MobileWorkspacePageSheet` 不再拥有可见根容器，只是 Host 的零 DOM 适配器；`MobileWorkspaceDetailSheet` 不再创建 Dialog，只向 Host 注册详情内容和固定底栏。普通 Tooltip、Popover 与通知面板继续限制在工作区安全浮层内；来自唯一根 Sheet 内的富下拉可以使用根 Dialog 作为安全边界。不得创建第二份 `.mobile-detail-sheet`、第二个 backdrop 或第二个根级 Portal。',
    '根级业务 Dialog 新职责',
  ],
  [
    '- `scripts/verify-mobile-page-sheet.mjs`：锁定移动一级 Page Sheet 与二级 Detail Sheet 的层级分离、共享拖动内核、地图关闭语义、常驻 Chrome、样式加载顺序和禁止一级 Sheet 进入根级 Dialog。',
    '- `scripts/verify-mobile-page-sheet.mjs`：锁定唯一根级 Mobile Workspace Sheet、工厂详情卡片容器单实例、页面／详情内容复用、共享拖动内核、导航覆盖、地图关闭语义和样式加载顺序，禁止恢复第二个 Sheet DOM。',
    '移动 Sheet 防回退说明',
  ],
  [
    '- `tests/browser/mobile-workspace-overlay.spec.ts`：移动一级 Page Sheet 必须位于状态栏下方、移动底栏上方，关闭后回到常驻地图且两处 Chrome 保持可操作；页面卡片滚动条到达安全右边缘且不改变正文宽度，防止 fixed/backdrop-filter 包含块偏移回归。',
    '- `tests/browser/mobile-workspace-overlay.spec.ts`：唯一根级 Mobile Workspace Sheet 必须复用工厂详情全宽容器、底边贴物理视口并覆盖移动底栏，关闭后回到常驻地图并恢复导航命中；页面卡片滚动条必须留在根 Sheet 安全右边缘且不改变正文宽度。',
    '移动 Sheet 浏览器说明',
  ],
]);

patch('scripts/verify-game-shell-layout.mjs', [
  [
    "check('src/components/ui/MobileWorkspaceDetailSheet.tsx', [\n  'useWorkspaceDialogLayer',\n  'WorkspaceFloatingLayerContext.Provider value={dialogLayer}',\n  '!dialogLayer',\n  'dialogLayer,',\n]);\nforbid('src/components/ui/MobileWorkspaceDetailSheet.tsx', [\n  'document.body,',\n  'useWorkspaceFloatingLayer',\n]);",
    "check('src/components/ui/MobileWorkspaceSheetHost.tsx', [\n  'useWorkspaceDialogLayer',\n  'WorkspaceFloatingLayerContext.Provider value={dialogLayer}',\n  'className=\"mobile-detail-sheet-backdrop\"',\n  'className=\"mobile-detail-sheet mobile-workspace-sheet-host\"',\n  'data-mobile-workspace-sheet-host=\"true\"',\n]);\ncheck('src/components/ui/MobileWorkspaceDetailSheet.tsx', [\n  'useMobileWorkspaceSheetHost()',\n  'registerDetail(registration);',\n  'createPortal(children, host.detailContentLayer)',\n]);\nforbid('src/components/ui/MobileWorkspaceDetailSheet.tsx', [\n  'document.body,',\n  'useWorkspaceFloatingLayer',\n  'useWorkspaceDialogLayer',\n  'className=\"mobile-detail-sheet\"',\n]);",
    '共享 Sheet Host 验证',
  ],
]);

patch('scripts/verify-unified-factory-recipes-grid.mjs', [
  [
    "const sharedSheet = read('src/components/ui/MobileWorkspaceDetailSheet.tsx');\nconst sharedDrag = read('src/components/ui/useMobileWorkspaceSheetDrag.ts');",
    "const sharedSheet = read('src/components/ui/MobileWorkspaceDetailSheet.tsx');\nconst sharedHost = read('src/components/ui/MobileWorkspaceSheetHost.tsx');\nconst sharedDrag = read('src/components/ui/useMobileWorkspaceSheetDrag.ts');",
    '读取唯一 Sheet Host',
  ],
  [
    '${sharedSheet}\n${sharedDrag}',
    '${sharedSheet}\n${sharedHost}\n${sharedDrag}',
    '组合源码加入 Host',
  ],
  [
    "  'return createPortal(',",
    "  'createPortal(children, host.detailContentLayer)',",
    '详情 Portal 检查',
  ],
  [
    "  \"sheet?.focus({ preventScroll: true });\",",
    "  \"root.focus({ preventScroll: true });\",",
    'Host 初始焦点',
  ],
  [
    "assert.equal(\n  sharedSheet.includes(\"from './useMobileWorkspaceSheetDrag'\"),\n  true,\n  '移动工厂详情必须复用共享工作区 Sheet 拖动内核',\n);",
    "assert.equal(\n  sharedHost.includes(\"from './useMobileWorkspaceSheetDrag'\"),\n  true,\n  '移动工厂详情必须通过唯一 Host 复用共享工作区 Sheet 拖动内核',\n);\nassert.equal(\n  sharedSheet.includes(\"from './MobileWorkspaceSheetHost'\"),\n  true,\n  '移动工厂详情必须只向唯一 Host 注册内容',\n);",
    '共享拖动内核归属',
  ],
  [
    "  'Final authority for signed-in mobile workspace sheets',",
    "  'Final authority for the single signed-in mobile workspace sheet',",
    'Sheet 样式权威文案',
  ],
  [
    "  '.mobile-workspace-page-sheet',\n  '.mobile-workspace-page-sheet .page-card-scroll',",
    "  '.mobile-workspace-sheet-page-layer',\n  '.mobile-workspace-sheet-detail-view',\n  '.mobile-workspace-sheet-page-content .page-card-scroll',",
    'Sheet 样式选择器',
  ],
  [
    "  '.workspace-dialog-layer > .mobile-workspace-page-sheet',\n  '.research-detail-sheet-scroll {',",
    "  '.mobile-workspace-page-sheet',\n  '.research-detail-sheet-scroll {',",
    '禁止旧 Page Sheet 选择器',
  ],
]);

console.log('UNIFIED_MOBILE_SHEET_MIGRATION_APPLIED');
