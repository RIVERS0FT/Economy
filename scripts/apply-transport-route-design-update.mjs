import { readFileSync, writeFileSync, rmSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content, 'utf8');
}

function replaceRequired(source, matcher, replacement, label) {
  if (typeof matcher === 'string') {
    if (!source.includes(matcher)) throw new Error(`missing ${label}`);
    return source.replace(matcher, replacement);
  }
  if (!matcher.test(source)) throw new Error(`missing ${label}`);
  return source.replace(matcher, replacement);
}

function insertOnce(source, anchor, addition, label) {
  if (source.includes(addition.trim())) return source;
  if (!source.includes(anchor)) throw new Error(`missing ${label}`);
  return source.replace(anchor, `${anchor}${addition}`);
}

// PAGE_CONTENT_AND_NAVIGATION_DESIGN.md
{
  const path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
  let source = read(path);
  source = source.replace('> 更新时间：2026-09-01', '> 更新时间：2026-09-02');
  source = replaceRequired(
    source,
    /^\| 运输 \| `transport` \| `TransportPage` \|.*$/m,
    '| 运输 | `transport` | `TransportPage` | 只显示跨州运输路线目录；新路线只在常驻战略地图创建，`transport-route` 详情只读路径／行程／运输方式并查看当前运输与历史；创建后只允许改名或删除，发运由服务器自动执行 |',
    'transport navigation row',
  );
  source = replaceRequired(
    source,
    /州级概览以及未解锁建筑／仓库分区在正常状态下都只有一个一级业务模块，因此不得再为整个分区套 `PagePanel`／`\.panel` 圆角卡片；标题、指标、数据行和解锁操作直接排列在 `PageLayout` 正文内容区。只有同一内容区存在两个及以上需要视觉分组的同级业务模块时才创建一级圆角卡片，避免 `workspaceCard` 与唯一业务卡形成无信息增益的双层圆角外壳。\n/,
    '所有玩家页面的可滚动 `.page-card-scroll` 正文统一使用留白与细线分区，不以 `PagePanel`／`.panel` 的圆角、独立背景或阴影划分模块；州级概览、建筑、仓库以及其他页面均遵守同一规则。本文其他章节若仍以“卡片”“PagePanel”或“Panel”描述可滚动正文模块，只表示业务结构或兼容 React 入口，不授予圆角卡片视觉；视觉一律服从 `UI_DESIGN_SYSTEM.md` 的滚动正文细线分区规则。只有不随页面正文滚动的固定、sticky、浮动、Popover、Dialog、Tooltip、根级工作区等独立表面才允许使用圆角卡片。\n',
    'page scrolling surface rule',
  );
  source = replaceRequired(
    source,
    /路线只能通过唯一常驻战略地图编辑。新建路线点击“增加路线”后直接进入地图编辑模式；已有路线只能从 `transport-route` 详情点击“在地图上编辑路线”进入。[\s\S]*?退出地图编辑必须清理草稿连线与选州模式；路线卡 hover／聚焦继续高亮对应连线。\n/,
    '创建前的路线只能通过唯一常驻战略地图编辑。新建路线点击“增加路线”后进入地图创建模式；地图按顺序点击已解锁州面追加站点、再次点击起点州闭环，未解锁州与已在线路中的州给出提示且不进入序列。地图操作条同时负责运输方式、非闭环单程／往返、闭环、重置、一次性建线费预览、创建与取消；创建成功后立即退出编辑并回到运输上下文，失败时允许保留草稿重试。选州期间拦截“点击州面打开州级上下文页”的默认行为，并在州面之上绘制按首府坐标顺序连接的路线连线。路线创建后不提供编辑入口，路径、站点顺序、行程与运输方式永久只读；路线详情只允许改名，以及在没有运输在途时删除。桌面端运输页与地图同屏；移动端继续复用唯一 Mobile Workspace Sheet 的关闭路径回到纯地图。退出创建模式必须清理草稿连线与选州模式；路线卡 hover／聚焦继续按其运输方式高亮对应连线。\n',
    'first transport editor paragraph',
  );
  source = replaceRequired(
    source,
    /## 3\.1 运输页[\s\S]*?\n## 4\. 市场/,
    `## 3.1 运输页\n\n运输页只显示运输路线目录，并使用 \`building\` 战略展示。“增加路线”进入唯一常驻战略地图创建模式；路线目录使用与页面滚动正文一致的扁平列表和细线行分隔，不使用独立圆角路线卡。路线行显示名称、起终点、站点数、行程、运输方式、一次性建线投入以及“运输中／等待发运”状态，点击后通过受限页面栈 push \`{ type: 'transport-route', routeId }\`。\`transport-route\` 不是新的 \`TabId\` 或一级导航，返回恢复运输路线目录，关闭仍回到透明 \`map\`。\n\n运输记录唯一显示在对应路线页面。路线详情把该 \`routeId\` 的 \`transportShipments\` 分成当前运输和历史运输，展示每趟实际 \`manifest\`、运输方式、费用、到达状态与时间；一级运输页不得恢复“进行中运输／最近完成”的全局记录。路线名称允许单独修改，新建路线默认使用玩家可见州名形成“起始州-终点州”。路线创建后路径、站点顺序、行程和运输方式永久只读，不存在“在地图上编辑路线”入口，也不得通过页面下拉框、草稿或旧 \`route-update\` 修改；需要调整时只能在无在途运输后删除并重新创建，重新创建按 \`WAREHOUSE_EXPANSION_DESIGN.md\` 再次支付一次性建线费。\n\n创建前的路线只能通过唯一常驻战略地图编辑。地图创建模式按顺序点击已解锁州面追加站点，可再次点击起点闭环，并在同一操作条修改运输方式和非闭环单程／往返、查看一次性建线费并直接提交创建；创建成功才清理草稿，失败保留可重试状态。页面正文不得恢复起始州／目的州／中间站下拉、商品、运输数量或自动发运开关。\n\n运输路线不指定商品或固定数量，也不得显示手动“发运”按钮。服务器在正常世界推进中为没有在途任务的路线自动选择正预期净价差货物，条件满足时直接发运，条件不足时保持“等待发运”；每条路线同时最多一笔在途运输。有在途运输时禁止删除路线。自动选货、\`manifest\`／\`legPlan\`、一次性建线费、每次发运成本、到达与兼容规则以 \`WAREHOUSE_EXPANSION_DESIGN.md\` 为唯一业务权威。\n\n路线是玩家私有配置，\`transportRoutes\` 继续进入现有玩家分区的 \`player.misc\` slice；真实在途与到达记录 \`transportShipments\` 继续进入现有市场分区的 \`market.misc\` slice。运输页订阅 \`catalog + player.assets + player.misc + market.quotes + market.misc\`，不得为路线详情、自动发运或地图动画新增第七个状态分区、专用轮询或第二份运输记录。\n\n## 4. 市场`,
    'transport page section',
  );
  source = insertOnce(
    source,
    '## 14. 防回退\n\n不得：\n',
    '- 把可滚动玩家正文重新分割为多个圆角、独立背景或阴影一级卡片；本文其他章节的“卡片／PagePanel／Panel”在 `.page-card-scroll` 中只能作为结构语义并必须由 UI 设计系统扁平化为细线分区；\n- 恢复已保存运输路线的地图编辑入口、页面内路线编辑器或成功的 `route-update`，或允许创建后修改路径、站点、行程和运输方式；\n- 让公路、铁路和航空在战略地图使用相同线型，或让路线高亮丢失运输方式线型；\n',
    'page anti-regression anchor',
  );
  write(path, source);
}

// UI_DESIGN_SYSTEM.md
{
  const path = 'docs/UI_DESIGN_SYSTEM.md';
  let source = read(path);
  source = source.replace('> 更新时间：2026-09-01', '> 更新时间：2026-09-02');
  source = insertOnce(
    source,
    '| `src/styles/transport-page.css` | 独立运输页的路线编辑、路线卡、在途／最近完成记录与响应式布局 |\n',
    '| `src/styles/scrolling-page-sections.css` | 玩家可滚动正文的最终细线分区与圆角卡片视觉清除、运输路线方式线型以及运输地图创建面板状态栏安全定位；不得定义表单控件基础视觉 |\n',
    'UI style responsibility table',
  );
  source = replaceRequired(
    source,
    /`PagePanel` 是新增玩家端一级卡片的唯一 React 入口，[\s\S]*?`PagePanel` 只用于实际存在视觉分组意义的一级业务模块。[\s\S]*?禁止用第二层整页卡片重复边框、圆角和外层内边距。\n/,
    '`PagePanel` 继续作为旧玩家页面一级业务模块的 React 兼容入口，并固定复用 `Panel`、`.widget` 与 `.ui-primary-surface`；但它不再自动意味着可滚动正文可以显示成圆角卡片。可滚动 `.page-card-scroll` 正文统一由 `scrolling-page-sections.css` 把 `.ui-primary-surface` 扁平化为透明内容区与 `1px` 细线分区，清除圆角、独立背景、阴影和 `backdrop-filter`。新建可滚动业务模块优先使用语义化 `section`、列表或表格表面，不应为了分组新增 `PagePanel`。\n\n只有不随页面正文滚动的固定、sticky、浮动、Popover、Dialog、Tooltip、根级工作区等真正独立表面可以保留圆角卡片；这类获准表面若属于玩家端一级表面仍使用 `PagePanel` 与共享 inset。`.page-card-static` 只有在内容本身固定且不随页面滚动时才可按所属专项规则保留批准的圆角表面。该规则优先于页面专项中历史遗留的“卡片／PagePanel／Panel”措辞：若该模块位于 `.page-card-scroll`，这些词只表示结构，不允许恢复圆角卡片视觉。\n',
    'UI PagePanel paragraphs',
  );
  source = source.replace(
    '四类行统一使用 `1px` 弱边框、`var(--radius-control)` 圆角、同一半透明表面、横向内边距、列间距、右向 Chevron 与共享交互反馈',
    '四类行在可滚动正文中统一使用相邻行 `1px` 细线分隔、透明基础表面、横向内边距、列间距、右向 Chevron 与共享交互反馈，不为每一行重复创建圆角卡片边框',
  );
  source = replaceRequired(
    source,
    /(- 运输路线图层唯一挂载在 `UsMainlandMap`[\s\S]*?选州操作条位于地图层顶部安全区内，复用既有表面令牌，并同时承载站点序列、运输方式、单程／往返、闭环、重置、完成与取消。\n)/,
    `$1- 路线线型必须直接表达运输方式而不能只依赖颜色：公路使用连续实线，铁路使用短长节奏组合虚线表现轨道节奏，航空使用间隔更大的长虚线航线。草稿、已保存和卡片 hover／focus 高亮只改变强调色、透明度或粗细，不得覆盖运输方式线型。\n- 运输地图创建面板属于固定地图浮层，因此允许保留圆角表面，但其顶部必须显式避让状态栏：桌面使用状态栏实际高度、状态栏间距与工作区沟槽计算安全 top；移动直接复用 \`--mobile-below-status-top\`。面板必须限制最大高度并允许自身滚动，任何视口下都不得被状态栏覆盖。\n`,
    'UI transport map overlay rules',
  );
  source = insertOnce(
    source,
    '## 16. 防回退\n',
    '\n- 可滚动 `.page-card-scroll` 正文不得恢复圆角一级卡片、独立卡片背景、卡片阴影或卡片级毛玻璃分区；固定／sticky／浮动等不随正文滚动的表面才允许按规则使用圆角。\n- 公路、铁路、航空运输路线必须保持三种不同线型，保存、草稿和高亮状态均不得退化为同一线型；运输地图创建面板不得进入桌面或移动状态栏覆盖区域。\n',
    'UI anti-regression section',
  );
  write(path, source);
}

// PRIMARY_SURFACE_INSET_DESIGN.md: keep this document as geometry-only owner.
{
  const path = 'docs/PRIMARY_SURFACE_INSET_DESIGN.md';
  let source = read(path);
  source = source.replace('> 更新时间：2026-08-31', '> 更新时间：2026-09-02');
  source = insertOnce(
    source,
    '## 2. 唯一权威\n\n',
    '本文只负责获 `UI_DESIGN_SYSTEM.md` 允许保留圆角的非滚动玩家一级表面的 inset 几何。可滚动 `.page-card-scroll` 正文不属于圆角一级卡片适用范围；其模块边界统一由 UI 设计系统规定为透明内容与细线分区。历史组件即使继续输出 `.ui-primary-surface`，进入可滚动正文后也必须由最终滚动正文样式清除圆角、背景、阴影与卡片 padding 视觉，不得借本文恢复。\n\n',
    'primary surface scope',
  );
  source = source.replace('- 新增一级卡片必须使用 `PagePanel`。', '- 获准保留圆角的非滚动玩家一级表面必须使用 `PagePanel`；可滚动正文不得为了视觉分组新增圆角 `PagePanel`。');
  source = replaceRequired(
    source,
    /- 只有页面正文确实存在需要独立视觉分组的一级业务模块时才创建一级卡片；正常状态下若整个正文只有一个一级业务模块，[\s\S]*?双层边框、圆角和内边距。\n/,
    '- 可滚动 `.page-card-scroll` 正文不属于圆角一级卡片适用范围，无论有一个还是多个业务模块都只使用留白与细线分区；旧 `PagePanel` 只可作为结构兼容节点并由最终滚动正文样式扁平化。非滚动固定／sticky／浮动表面确实需要独立承载时，才进入本文的统一 inset 规则。\n',
    'primary component scope rule',
  );
  write(path, source);
}

// Keep the architecture verifier aligned with the clarified ownership boundary.
{
  const path = 'scripts/verify-primary-surface-insets.mjs';
  let source = read(path);
  source = source.replace("'新增一级卡片必须使用 `PagePanel`'", "'获准保留圆角的非滚动玩家一级表面必须使用 `PagePanel`'");
  source = source.replace("'正常状态下若整个正文只有一个一级业务模块'", "'可滚动 `.page-card-scroll` 正文不属于圆角一级卡片适用范围'");
  source = source.replace("'`PagePanel` 是新增玩家端一级卡片的唯一 React 入口'", "'`PagePanel` 继续作为旧玩家页面一级业务模块的 React 兼容入口'");
  source = source.replace("'若页面正文在正常状态下只有一个一级业务模块'", "'可滚动 `.page-card-scroll` 正文统一由 `scrolling-page-sections.css`'");
  write(path, source);
}

// Make the transport setup cost part of the client state contract and remove a stale import.
{
  const path = 'src/types.ts';
  let source = read(path);
  if (!/export interface TransportRoute[\s\S]*?setupCost: number;/.test(source)) {
    source = replaceRequired(source, /export interface TransportRoute \{\n  id: string;\n  name: string;\n/, 'export interface TransportRoute {\n  id: string;\n  name: string;\n  setupCost: number;\n', 'TransportRoute type');
  }
  write(path, source);
}

{
  const path = 'src/pages/TransportPage.tsx';
  let source = read(path);
  source = source.replace('import { useTransportRouteDraft, type TransportRouteDraft } from', 'import { useTransportRouteDraft } from');
  write(path, source);
}

// Ensure the one-time migration leaves no maintenance artifact in the branch.
rmSync('.github/workflows/apply-transport-route-design-update.yml', { force: true });
rmSync('scripts/apply-transport-route-design-update.mjs', { force: true });
