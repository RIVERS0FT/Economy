import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content.endsWith('\n') ? content : content + '\n');
}

function replaceRequired(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) throw new Error(path + ' 缺少替换目标:\n' + before);
  write(path, source.replace(before, after));
}

function replaceAllRequired(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) throw new Error(path + ' 缺少替换目标:\n' + before);
  write(path, source.split(before).join(after));
}

function replaceSection(path, startMarker, endMarker, replacement) {
  const source = read(path);
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(path + ' 缺少章节边界');
  write(path, source.slice(0, start) + replacement + source.slice(end));
}

replaceRequired(
  'src/pages/MarketPage.tsx',
  "import { VirtualList } from '../components/ui/VirtualList';",
  "import { VirtualRecordTable } from '../components/ui/VirtualRecordTable';",
);

const marketSource = read('src/pages/MarketPage.tsx');
const localStart = '                  <ScrollArea\n                    axis="x"\n                    className="local-trades-scroll-area"';
const localEnd = '                  </ScrollArea>';
const localStartIndex = marketSource.indexOf(localStart);
const localEndIndex = marketSource.indexOf(localEnd, localStartIndex);
if (localStartIndex < 0 || localEndIndex < 0) throw new Error('MarketPage 本地成交旧结构不存在');
const localReplacement = `                  <VirtualRecordTable
                    items={localTrades}
                    getKey={localTradeKey}
                    estimateSize={54}
                    viewportHeight={520}
                    minViewportHeight={96}
                    overscan={6}
                    gap={0}
                    className="local-trades-scroll-area"
                    tableClassName="local-trades-virtual-table"
                    ariaLabel="本地成交记录"
                    header={(
                      <>
                        <span role="columnheader">资产</span>
                        <span role="columnheader" className="trade-side-cell">方向</span>
                        <span role="columnheader" className="numeric-cell">数量</span>
                        <span role="columnheader" className="numeric-cell">价格</span>
                        <span role="columnheader" className="numeric-cell">总额</span>
                        <span role="columnheader" className="numeric-cell">手续费 / 实收</span>
                        <span role="columnheader">时间</span>
                      </>
                    )}
                    renderRow={(trade) => (
                      <div className="virtual-record-row" role="row">
                        <span role="cell">{trade.type === 'commodity' && trade.productId
                          ? <ProductIconLabel productId={trade.productId}>{localTradeAssetName(trade)}</ProductIconLabel>
                          : <span className="product-icon-label facility-icon-label"><FactoryIcon />{localTradeAssetName(trade)}</span>}</span>
                        <span role="cell" className="trade-side-cell"><StatusTag tone={trade.side === 'buy' ? 'success' : 'danger'}>{trade.side === 'buy' ? '买入' : '卖出'}</StatusTag></span>
                        <span role="cell" className="numeric-cell">{formatNumber(trade.quantity)}</span>
                        <span role="cell" className="numeric-cell"><CurrencyAmount>{formatCurrency(trade.price)}</CurrencyAmount></span>
                        <span role="cell" className="numeric-cell"><CurrencyAmount>{formatCurrency(trade.total)}</CurrencyAmount></span>
                        <span role="cell" className="numeric-cell">{trade.side === 'sell' ? <><CurrencyAmount>{formatCurrency(trade.fee ?? 0)}</CurrencyAmount> / <CurrencyAmount>{formatCurrency(trade.netTotal ?? trade.total)}</CurrencyAmount></> : '—'}</span>
                        <span role="cell">{formatTime(trade.createdAt)}</span>
                      </div>
                    )}
                  />`;
write(
  'src/pages/MarketPage.tsx',
  marketSource.slice(0, localStartIndex) + localReplacement + marketSource.slice(localEndIndex + localEnd.length),
);
replaceAllRequired('src/pages/MarketPage.tsx', 'horizontalVisibility="always"', 'scrollbarVisibility="adaptive"');

replaceAllRequired('src/styles/market-page-polish.css', 'scroll-behavior: smooth;', 'scroll-behavior: auto;');
replaceAllRequired('src/styles/market-page-polish.css', 'scroll-snap-type: x proximity;', 'scroll-snap-type: none;');
replaceAllRequired('src/styles/unified-market-admin.css', 'scroll-snap-type: x proximity;', 'scroll-snap-type: none;');
replaceAllRequired('src/styles/unified-market-admin.css', '  scroll-snap-align: start;\n', '');

replaceRequired(
  'tests/browser/market-runtime-harness.tsx',
  "import '../../src/styles/viewport.css';",
  "import '../../src/styles/viewport.css';\nimport '../../src/styles/scrollbars.css';",
);
replaceRequired(
  'tests/browser/market-runtime-harness.tsx',
  "import '../../src/styles/market-funds.css';",
  "import '../../src/styles/market-funds.css';\nimport '../../src/styles/market-account-table.css';",
);
replaceRequired(
  'tests/browser/market-runtime-harness.tsx',
  '      localTrades: [],',
  `      localTrades: Array.from({ length: 80 }, (_, index) => {
        const side = index % 2 === 0 ? 'buy' as const : 'sell' as const;
        const quantity = (index % 5) + 1;
        const price = 2 + (index % 4);
        const total = quantity * price;
        const fee = side === 'sell' ? 1 : 0;
        return {
          id: 'trade-' + (index + 1),
          type: 'commodity' as const,
          productId: 'wheat',
          side,
          description: (side === 'buy' ? '买入 ' : '卖出 ') + '小麦',
          quantity,
          price,
          total,
          fee,
          netTotal: total - fee,
          createdAt: fixedNow - index * 60_000,
        };
      }),`,
);

replaceRequired(
  'docs/UI_DESIGN_SYSTEM.md',
  '> 更新时间：2026-07-20',
  '> 更新时间：2026-07-21',
);
replaceRequired(
  'docs/UI_DESIGN_SYSTEM.md',
  '- `VirtualList`\n- `CurrencyAmount`',
  '- `VirtualList`\n- `VirtualRecordTable`\n- `CurrencyAmount`',
);
const uiVirtualStart = '`VirtualList` 是高增长记录的唯一窗口化基础组件。';
const uiVirtualEnd = '\n\n`CurrencyAmount`';
const uiSource = read('docs/UI_DESIGN_SYSTEM.md');
const uiVirtualStartIndex = uiSource.indexOf(uiVirtualStart);
const uiVirtualEndIndex = uiSource.indexOf(uiVirtualEnd, uiVirtualStartIndex);
if (uiVirtualStartIndex < 0 || uiVirtualEndIndex < 0) throw new Error('UI 设计缺少窗口化段落');
const uiVirtualReplacement = '`VirtualList` 与 `VirtualRecordTable` 共用 `src/hooks/useVirtualWindow.ts` 的唯一窗口化内核。该内核根据滚动位置只挂载可视条目与少量 `overscan` 条目，使用模块级稳定业务 ID 取键，并通过 `ResizeObserver` 修正可变高度。滚动事件必须通过 `requestAnimationFrame` 合并为每帧最多一次 React 状态更新，可视起止索引必须使用累计偏移二分查找，不得每帧从第 0 项线性扫描。普通高增长列表使用 `VirtualList`；需要表头与数据共享横纵偏移的记录表使用单一双轴视口 `VirtualRecordTable`，不得各自实现另一套虚拟滚动器。';
write(
  'docs/UI_DESIGN_SYSTEM.md',
  uiSource.slice(0, uiVirtualStartIndex) + uiVirtualReplacement + uiSource.slice(uiVirtualEndIndex),
);

const scrollbarSection = `### 7.1 统一覆盖式滚动条

- \`src/components/ui/ScrollArea.tsx\` 是应用内覆盖式滚动区域的唯一共享组件，\`src/hooks/useOverlayScrollbar.ts\` 是尺寸、位置、拖动、轨道翻页、活动判断和双轴输入分派的唯一实现，\`src/styles/scrollbars.css\` 是滚动条视觉的唯一来源。
- 原生滚动容器继续负责可访问滚动、触控惯性与浏览器滚动链；原生滚动条视觉在 \`ScrollArea\` 视口内隐藏，项目轨道覆盖在内容上方且不占布局空间。
- 全局统一令牌为视觉宽度 \`6px\`、轨道命中尺寸 \`20px\`、透明滑块触控目标 \`44px\`、边缘偏移 \`2px\`、最小滑块 \`44px\`、鼠标空闲延迟 \`1200ms\`、触控纵向空闲延迟 \`1600ms\`、淡入淡出 \`120ms\`。横轴、纵轴、鼠标和触控不得定义第二套尺寸。
- 当前输入方式由最近一次有效输入动态决定：鼠标或触控板为 \`mouse\`，手指或笔为 \`touch\`，键盘为 \`keyboard\`；\`pointer: coarse\` 只决定首次默认值。混合输入设备必须在运行时切换，不得只按视口宽度判断。
- 鼠标模式下，横纵轨道在悬停、键盘聚焦、实际滚动、滑块拖动或轨道操作时显示；离开且空闲后隐藏。滑块必须使用 pointer capture，拖动写入通过 \`requestAnimationFrame\` 合并，指针离开轨道后仍连续工作。
- 触控模式下横向项目轨道始终 \`display: none\`，不得在横向滚动时闪现，也不得拦截内容。横向内容继续通过原生手指滑动、惯性与 \`touch-action: pan-x pan-y\` 操作。
- 触控模式下纵向轨道只在 \`scrollTop\` 实际变化后显示；显示期间允许触摸拖动滑块与点击轨道翻页，拖动或轨道操作期间不得隐藏，结束并空闲 \`1600ms\` 后淡出，隐藏时必须 \`pointer-events: none\`。
- \`scrollbarVisibility="adaptive"\` 是普通区域默认策略；\`always\` 只允许明确需要常驻轨道的管理工具使用，\`hidden\` 用于移动底栏等保留滚动但永久隐藏项目轨道的区域。触控模式隐藏横向轨道的规则高于 \`always\`。
- “活动”只由实际 \`scrollLeft\` 或 \`scrollTop\` 变化、滑块拖动或轨道操作产生；鼠标移动、触摸按下、点击、焦点、无法继续滚动的滚轮或边界手势本身不算活动。
- 普通滚轮和以 \`deltaY\` 为主的触控板输入优先垂直滚动；只有 \`Shift + 滚轮\`、明确以 \`deltaX\` 为主的触控板输入、水平滑块拖动或水平轨道点击才执行水平滚动。到达内部纵向边界后必须把滚动链交给外层，不得自动改成水平滚动。
- 同一滚轮事件经过嵌套视口时，最近且仍能沿当前方向滚动的后代视口拥有事件；祖先 \`ScrollArea\` 必须先检查事件目标到自身视口之间的原生或共享滚动容器，不得在后代尚未到边界时抢走滚动。
- 当前视口真正发生滚动时必须同时调用 \`preventDefault()\` 与 \`stopPropagation()\`；到顶、到底或该轴不可滚动时两者都不得调用，使事件继续交给祖先或浏览器。仅横向控件不得消费普通纵向滚轮。
- 双轴轨道同时存在时纵向轨道 \`z-index\` 更高，水平轨道在右侧避让纵向命中区，不绘制额外右下角块。触控模式隐藏横向轨道后不得留下空白或命中区域。
- 不得使用 \`overscroll-behavior: contain\` 阻断纵向滚动链；只有明确的横向视口可以使用 \`overscroll-behavior-x: contain\`，并保持 \`overscroll-behavior-y: auto\`。
- 移动页面纵向轨道固定到视口安全边缘：仅 \`.page-scroll-area > .ui-scrollbar--vertical\` 在不大于 \`720px\` 时使用 \`position: fixed\`，右侧使用 \`right: env(safe-area-inset-right, 0px)\`。固定的只有覆盖式轨道，工作区和卡片宽度不得改变。
- 市场商品与工厂资产目录必须支持无级滑动：不得使用 \`scroll-snap-type\`、\`scroll-snap-align\` 或容器级 \`scroll-behavior: smooth\`。手动滑动与滑块拖动使用即时连续位置，只有左右浏览按钮和明确的程序化定位可以显式使用平滑滚动。
- 本地成交记录必须使用单一双轴原生视口的 \`VirtualRecordTable\`；表头与虚拟数据共享同一个 \`scrollLeft\`，数据单元格本身必须能作为横向触控起点，不得恢复“外层横向 + 内层纵向”的正交嵌套视口。
- 滚动过程中不得用 React state 更新滑块位置；使用 ref、CSS transform、\`requestAnimationFrame\` 和 \`ResizeObserver\`。滑块保留 \`role="scrollbar"\`、方向和范围语义，支持拖动、轨道翻页与键盘控制。

`;
replaceSection('docs/UI_DESIGN_SYSTEM.md', '### 7.1 统一覆盖式滚动条', '### 7.2 滚轮事件归属与前端控件位置', scrollbarSection);
replaceRequired(
  'docs/UI_DESIGN_SYSTEM.md',
  '- 市场页“我的订单与成交 → 本地成交记录”：`MarketPage.tsx` 的 `.local-trades-scroll-area` 内层 `.virtual-record-viewport`。',
  '- 市场页“我的订单与成交 → 本地成交记录”：`MarketPage.tsx` 的 `.local-trades-scroll-area` 单一双轴 `.virtual-record-table`。',
);
replaceRequired(
  'docs/UI_DESIGN_SYSTEM.md',
  '`TradeRecord.type` 只用于内部图标与类型判断；资产列不得再显示“买入／卖出”前缀，方向只由 `TradeRecord.side` 和方向列表达。外层只负责横向滚动，内部 `VirtualList` 只负责纵向滚动，表头和内容列必须保持对齐。',
  '`TradeRecord.type` 只用于内部图标与类型判断；资产列不得再显示“买入／卖出”前缀，方向只由 `TradeRecord.side` 和方向列表达。本地成交使用单一双轴 `VirtualRecordTable`，表头和内容共享同一个横向位置；触控模式隐藏横向轨道但保留从任意数据单元格开始的原生横滑，纵向轨道在活动后显示并允许触摸操作。',
);

replaceRequired(
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  '> 更新时间：2026-07-20',
  '> 更新时间：2026-07-21',
);
const localLogSection = `## 5. 展示与窗口化

- 市场页显示商品和工厂统一资产的本地匿名成交，列为类型、资产、方向、数量、价格、成交总额、手续费／实收和时间，不设置“来源”列。
- 资产页显示资金、商品、仓库、工厂和生产变化。
- 概览页最多显示最近 6 条匿名成交。
- 所有界面必须标注“本地记录”。
- 资产页资产事件和市场页本地成交属于高增长记录，必须共用 \`useVirtualWindow\` 窗口化内核；普通列表使用 \`VirtualList\`，本地成交表使用 \`VirtualRecordTable\`。筛选和统计针对完整数组，DOM 只创建当前滚动视口及少量 \`overscan\` 范围内的记录。
- 本地成交表必须使用单一双轴原生滚动视口，sticky 表头、虚拟行 canvas 与数据行共享同一个 \`scrollLeft\`；不得嵌套外层横向视口和内层纵向 \`VirtualList\`。
- 触控模式下横向轨道始终隐藏，但资产、方向、价格、手续费和时间等任意数据单元格都必须可以作为原生横向滑动起点；纵向轨道在实际滚动后显示，允许触摸滑块和轨道，空闲后自动隐藏。
- 不得用分页、截断、\`slice\`、全量 \`.map()\` 或只显示最近记录替代窗口化，也不得降低本地存储上限。

`;
replaceSection('docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '## 5. 展示与窗口化', '## 6. 清除与错误', localLogSection);

const readmeRule = '- 顶部状态栏直接由固定玻璃胶囊承载五列状态内容，不包含 `ScrollArea`、内部滚动视口或自绘滚动条；窄桌面和移动端使用紧凑数值与自适应字号，状态栏最上层 `::after` 内描边必须在卡片后方滚动时保持连续。';
replaceRequired(
  'README.md',
  readmeRule,
  readmeRule + '\n- 滚动条使用全局统一尺寸并按最近输入方式工作：鼠标／触控板模式提供可操作的横纵轨道，触控模式完全隐藏横向轨道并保留原生横滑，只在实际纵向滚动后显示可触摸操作且会自动隐藏的纵向轨道；市场资产目录禁止吸附并支持无级滑动，本地成交使用单一双轴虚拟视口。',
);

replaceRequired(
  'scripts/verify-game-shell-layout.mjs',
  "  'verticalAutoHide',",
  "  'scrollbarVisibility=\"adaptive\"',",
);

replaceRequired(
  'scripts/verify-market-assets.mjs',
  "'src/utils/localActivityStore.ts','src/types.ts','src/components/ui/layout.tsx','src/components/ui/VirtualList.tsx','src/components/icons/GameIcons.tsx'",
  "'src/utils/localActivityStore.ts','src/types.ts','src/components/ui/layout.tsx','src/components/ui/VirtualList.tsx','src/components/ui/VirtualRecordTable.tsx','src/hooks/useVirtualWindow.ts','src/components/icons/GameIcons.tsx'",
);
replaceRequired(
  'scripts/verify-market-assets.mjs',
  "  'local-trades-virtual-table','virtual-record-viewport','VirtualList',",
  "  'local-trades-virtual-table','VirtualRecordTable',",
);
replaceRequired(
  'scripts/verify-market-assets.mjs',
  `for (const text of [
  'ResizeObserver','overscan','measuredSizesRef','aria-setsize','virtual-list__canvas',
]) requireText('src/components/ui/VirtualList.tsx', text);`,
  `for (const text of ['ResizeObserver','overscan','measuredSizesRef','requestAnimationFrame','findVisibleRange']) requireText('src/hooks/useVirtualWindow.ts', text);
for (const text of ['useVirtualWindow','aria-setsize','virtual-list__canvas']) requireText('src/components/ui/VirtualList.tsx', text);
for (const text of ['useVirtualWindow','axis="both"','virtual-record-canvas']) requireText('src/components/ui/VirtualRecordTable.tsx', text);`,
);
replaceRequired(
  'scripts/verify-market-assets.mjs',
  "  '必须使用共享 `VirtualList` 窗口化组件',",
  "  '必须共用 `useVirtualWindow` 窗口化内核',",
);

replaceRequired(
  'scripts/verify-page-content.mjs',
  "  'src/components/ui/VirtualList.tsx',",
  "  'src/components/ui/VirtualList.tsx',\n  'src/components/ui/VirtualRecordTable.tsx',\n  'src/hooks/useVirtualWindow.ts',",
);
replaceRequired(
  'scripts/verify-page-content.mjs',
  `for (const text of ['ResizeObserver', 'measuredSizesRef', 'overscan', 'aria-setsize', 'virtual-list__canvas']) {
  requireText('src/components/ui/VirtualList.tsx', text);
}`,
  `for (const text of ['ResizeObserver', 'measuredSizesRef', 'overscan', 'requestAnimationFrame', 'findVisibleRange']) {
  requireText('src/hooks/useVirtualWindow.ts', text);
}
for (const text of ['useVirtualWindow', 'aria-setsize', 'virtual-list__canvas']) requireText('src/components/ui/VirtualList.tsx', text);
for (const text of ['useVirtualWindow', 'axis="both"', 'virtual-record-canvas']) requireText('src/components/ui/VirtualRecordTable.tsx', text);`,
);

replaceRequired(
  'scripts/verify-market-page-layout.mjs',
  "const marketStyles = fs.readFileSync('src/styles/market-page-polish.css', 'utf8');",
  "const marketStyles = fs.readFileSync('src/styles/market-page-polish.css', 'utf8');\nconst sharedMarketStyles = fs.readFileSync('src/styles/unified-market-admin.css', 'utf8');",
);
replaceRequired(
  'scripts/verify-market-page-layout.mjs',
  "requireText(marketStyles, 'grid-template-rows: repeat(2', '资产目录必须使用两行连续目录。');",
  "requireText(marketStyles, 'grid-template-rows: repeat(2', '资产目录必须使用两行连续目录。');\nrequireText(marketStyles, 'scroll-snap-type: none', '市场资产目录必须关闭吸附并允许无级滑动。');\nforbidText(marketStyles, 'scroll-behavior: smooth', '市场资产目录不得用容器级平滑滚动干扰拖动。');\nforbidText(sharedMarketStyles, 'scroll-snap-align: start', '市场资产卡不得恢复吸附锚点。');",
);
replaceRequired(
  'scripts/verify-market-page-layout.mjs',
  "requireText(marketPage, 'orderDisabledReason', '下单禁用必须提供明确原因。');",
  "requireText(marketPage, 'orderDisabledReason', '下单禁用必须提供明确原因。');\nrequireText(marketPage, '<VirtualRecordTable', '本地成交必须使用单一双轴虚拟表格。');\nforbidText(marketPage, 'virtual-record-viewport', '本地成交不得恢复内层纵向视口。');",
);
replaceRequired(
  'scripts/verify-market-page-layout.mjs',
  "requireText(runtimeSpec, '向后浏览资产', 'Playwright 必须验证资产目录滚动控制。');",
  "requireText(runtimeSpec, '向后浏览资产', 'Playwright 必须验证资产目录滚动控制。');\nrequireText(runtimeSpec, 'desktop market asset directory supports continuous unsnapped scrolling', 'Playwright 必须验证资产目录无级滑动。');\nrequireText(runtimeSpec, 'touch input hides horizontal rails while local trade cells keep native two-axis scrolling', 'Playwright 必须验证触控横向轨道隐藏与成交数据横滑。');",
);

write('scripts/verify-overlay-scrollbars.mjs', `import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push('缺少文件: ' + path); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(path + ' 缺少: ' + text); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(path + ' 不应包含: ' + text); };

const paths = {
  modality: 'src/utils/inputModality.ts',
  scrollArea: 'src/components/ui/ScrollArea.tsx',
  hook: 'src/hooks/useOverlayScrollbar.ts',
  styles: 'src/styles/scrollbars.css',
  market: 'src/pages/MarketPage.tsx',
  marketStyles: 'src/styles/market-page-polish.css',
  sharedMarketStyles: 'src/styles/unified-market-admin.css',
  virtualHook: 'src/hooks/useVirtualWindow.ts',
  virtualList: 'src/components/ui/VirtualList.tsx',
  virtualTable: 'src/components/ui/VirtualRecordTable.tsx',
  status: 'src/components/shell/StatusBar.tsx',
  mobile: 'src/components/shell/MobileBottomNavigation.tsx',
  design: 'docs/UI_DESIGN_SYSTEM.md',
  localDesign: 'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  browser: 'tests/browser/scroll-input-modality.spec.ts',
};
Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  for (const text of ['dataInputModality', "pointerType === 'touch'", "publish('mouse')", "publish('keyboard')", 'useSyncExternalStore']) requireText(paths.modality, text);
  for (const text of ['scrollbarVisibility?: ScrollbarVisibility', "scrollbarVisibility = 'adaptive'", 'mouseIdleDelay = 1_200', 'touchVerticalIdleDelay = 1_600', 'data-scrollbar-visibility={scrollbarVisibility}', 'role="scrollbar"']) requireText(paths.scrollArea, text);
  for (const text of ['const MIN_THUMB_SIZE = 44', 'horizontalHideTimerRef', 'verticalHideTimerRef', "getInputModality() === 'touch'", 'setPointerCapture', 'window.requestAnimationFrame(commitPendingDrag)', 'descendantCanScrollInDirection', 'event.stopPropagation()', 'scrollbarTrackPressing']) requireText(paths.hook, text);
  for (const text of ['--scrollbar-visual-size: 6px;', '--scrollbar-hit-size: 20px;', '--scrollbar-touch-target-size: 44px;', '--scrollbar-min-thumb-size: 44px;', 'html[data-input-modality="touch"] .ui-scrollbar--horizontal', 'display: none !important;', 'html[data-input-modality="touch"] *:not(.ui-scroll-area__viewport)', 'right: env(safe-area-inset-right, 0px);']) requireText(paths.styles, text);
  for (const text of ['VirtualRecordTable', 'scrollbarVisibility="adaptive"', 'items={localTrades}', 'className="local-trades-scroll-area"']) requireText(paths.market, text);
  for (const text of ['scroll-snap-type: none;', 'scroll-behavior: auto;']) requireText(paths.marketStyles, text);
  forbidText(paths.marketStyles, 'scroll-snap-type: x proximity');
  forbidText(paths.marketStyles, 'scroll-behavior: smooth;');
  forbidText(paths.sharedMarketStyles, 'scroll-snap-align: start;');
  forbidText(paths.market, 'horizontalVisibility=');
  forbidText(paths.market, 'virtual-record-viewport');
  for (const text of ['useVirtualWindow', 'axis="both"', 'virtual-record-canvas']) requireText(paths.virtualTable, text);
  for (const text of ['ResizeObserver', 'requestAnimationFrame', 'findVisibleRange']) requireText(paths.virtualHook, text);
  for (const text of ['顶部状态栏不得包含 `ScrollArea`', '触控模式下横向项目轨道始终 `display: none`', '市场商品与工厂资产目录必须支持无级滑动', '单一双轴原生视口']) requireText(paths.design, text);
  for (const text of ['单一双轴原生滚动视口', '任意数据单元格都必须可以作为原生横向滑动起点']) requireText(paths.localDesign, text);
  for (const text of ['desktop market asset directory supports continuous unsnapped scrolling', 'touch input hides horizontal rails while local trade cells keep native two-axis scrolling', 'mixed input switches scrollbar policy at runtime']) requireText(paths.browser, text);
  for (const text of ["import { ScrollArea }", '<ScrollArea', 'asset-bar-scroll-area']) forbidText(paths.status, text);
  for (const text of ["import { ScrollArea }", '<ScrollArea', 'mobile-navigation-scroll-area']) forbidText(paths.mobile, text);
}

if (failures.length > 0) {
  console.error('输入方式滚动条、无级资产目录与单一双轴虚拟成交表验证失败：');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}
console.log('统一尺寸、鼠标与触控策略、隐藏触控横向轨道、无级资产目录和单一双轴虚拟成交表验证通过。');
`);

write('scripts/verify-virtual-list-scroll-chaining.mjs', `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const hook = read('src/hooks/useVirtualWindow.ts');
const list = read('src/components/ui/VirtualList.tsx');
const table = read('src/components/ui/VirtualRecordTable.tsx');
const styles = read('src/styles/virtual-list.css');
const design = read('docs/UI_DESIGN_SYSTEM.md');

for (const text of ['ResizeObserver', 'measuredSizesRef', 'requestAnimationFrame', 'findVisibleRange', 'visibleEntries']) assert.ok(hook.includes(text), '共享窗口化内核缺少: ' + text);
for (const text of ['useVirtualWindow', 'className="virtual-list-scroll-area"', 'viewportClassName={\`virtual-list']) assert.ok(list.includes(text), 'VirtualList 缺少: ' + text);
for (const text of ['useVirtualWindow', 'axis="both"', 'virtual-record-table', 'virtual-record-canvas']) assert.ok(table.includes(text), 'VirtualRecordTable 缺少: ' + text);
for (const text of ['overflow-x: auto;', 'overflow-y: auto;', 'overscroll-behavior-x: contain;', 'overscroll-behavior-y: auto;', 'touch-action: pan-x pan-y;']) assert.ok(styles.includes(text), '虚拟视口样式缺少: ' + text);
assert.equal(styles.includes('overscroll-behavior: contain;'), false, '不得使用同时吞掉纵向滚动链的 contain 简写');
for (const text of ['纵向滚动到顶或到底后必须把后续滚动链交给外层 `.page-scroll`', '单一双轴原生视口的 `VirtualRecordTable`']) assert.ok(design.includes(text), 'UI 设计文档缺少: ' + text);
console.log('Shared virtual windowing, single two-axis record viewport and boundary scroll chaining verification passed.');
`);

write('tests/browser/scroll-input-modality.spec.ts', `import { expect, test } from '@playwright/test';

test('desktop market asset directory supports continuous unsnapped scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');
  await expect(page.getByRole('heading', { name: '市场', exact: true })).toBeVisible();

  const directory = page.getByRole('tablist', { name: '选择交易资产' });
  const root = page.locator('.asset-directory-scroll-area');
  const styles = await directory.evaluate((element) => {
    const style = getComputedStyle(element);
    return { snap: style.scrollSnapType, behavior: style.scrollBehavior };
  });
  expect(styles.snap).toBe('none');
  expect(styles.behavior).toBe('auto');

  await directory.evaluate((element) => { element.scrollLeft = 173; });
  await page.waitForTimeout(180);
  const unsnapped = await directory.evaluate((element) => element.scrollLeft);
  expect(Math.abs(unsnapped - 173)).toBeLessThanOrEqual(1);

  await root.hover();
  const thumb = root.locator('.ui-scrollbar--horizontal .ui-scrollbar__thumb');
  await expect(thumb).toBeVisible();
  const box = await thumb.boundingBox();
  expect(box).not.toBeNull();
  const before = await directory.evaluate((element) => element.scrollLeft);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 37, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const after = await directory.evaluate((element) => element.scrollLeft);
  expect(after).toBeGreaterThan(before + 5);
  await page.waitForTimeout(180);
  expect(Math.abs((await directory.evaluate((element) => element.scrollLeft)) - after)).toBeLessThanOrEqual(1);
});

test('touch input hides horizontal rails while local trade cells keep native two-axis scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active');
  await expect(page.getByRole('heading', { name: '市场', exact: true })).toBeVisible();
  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 17 }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('touch');

  const horizontalDisplays = await page.locator('.ui-scrollbar--horizontal').evaluateAll((elements) => (
    elements.map((element) => getComputedStyle(element).display)
  ));
  expect(horizontalDisplays.length).toBeGreaterThan(0);
  expect(horizontalDisplays.every((display) => display === 'none')).toBe(true);

  const directory = page.getByRole('tablist', { name: '选择交易资产' });
  await directory.evaluate((element) => { element.scrollLeft = 140; });
  expect(await directory.evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);

  const tradeRoot = page.locator('.local-trades-scroll-area');
  const tradeViewport = tradeRoot.locator(':scope > .ui-scroll-area__viewport');
  await expect(tradeViewport.locator('.virtual-record-row').first()).toBeVisible();
  expect(await tradeViewport.locator('.ui-scroll-area').count()).toBe(0);
  const overflow = await tradeViewport.evaluate((element) => {
    const style = getComputedStyle(element);
    return { x: style.overflowX, y: style.overflowY, touchAction: style.touchAction };
  });
  expect(overflow.x).toBe('auto');
  expect(overflow.y).toBe('auto');
  expect(overflow.touchAction).toContain('pan-x');

  await tradeViewport.evaluate((element) => {
    element.scrollLeft = 180;
    element.scrollTop = 120;
  });
  expect(await tradeViewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);
  await expect.poll(() => tradeRoot.locator('.ui-scrollbar--vertical').evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await expect.poll(() => tradeRoot.locator('.ui-scrollbar--vertical').evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('auto');

  const beforeTrack = await tradeViewport.evaluate((element) => element.scrollTop);
  await tradeRoot.locator('.ui-scrollbar--vertical').evaluate((track) => {
    const thumb = track.querySelector('.ui-scrollbar__thumb');
    if (!(thumb instanceof HTMLElement)) throw new Error('missing vertical thumb');
    const rect = thumb.getBoundingClientRect();
    track.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 21,
      clientX: rect.left + rect.width / 2,
      clientY: rect.bottom + 20,
    }));
  });
  await expect.poll(() => tradeViewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(beforeTrack);

  const beforeDrag = await tradeViewport.evaluate((element) => element.scrollTop);
  await tradeRoot.locator('.ui-scrollbar--vertical .ui-scrollbar__thumb').evaluate((thumb) => {
    const rect = thumb.getBoundingClientRect();
    const startY = rect.top + rect.height / 2;
    thumb.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 22,
      clientX: rect.left + rect.width / 2,
      clientY: startY,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 22,
      clientY: startY + 45,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 22,
      clientY: startY + 45,
    }));
  });
  await expect.poll(() => tradeViewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(beforeDrag);

  await page.waitForTimeout(1850);
  await expect.poll(() => tradeRoot.locator('.ui-scrollbar--vertical').evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
});

test('mixed input switches scrollbar policy at runtime', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('market-runtime-test.html?scenario=active');
  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 31 }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('touch');
  await expect(page.locator('.asset-directory-scroll-area .ui-scrollbar--horizontal')).toHaveCSS('display', 'none');

  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 1 }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('mouse');
  await expect(page.locator('.asset-directory-scroll-area .ui-scrollbar--horizontal')).not.toHaveCSS('display', 'none');

  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 32 }));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('touch');
  await expect(page.locator('.asset-directory-scroll-area .ui-scrollbar--horizontal')).toHaveCSS('display', 'none');
});
`);

console.log('Adaptive scroll input redesign applied.');
