import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message);
}

function forbidText(source, text, message) {
  if (source.includes(text)) throw new Error(message);
}

const shell = read('src/components/shell/GameShell.tsx');
const workspace = read('src/components/shell/StrategicWorkspace.tsx');
const outliner = read('src/components/outliner/StrategicOutliner.tsx');
const storage = read('src/components/outliner/useStrategicOutliner.ts');
const shellStyle = read('src/styles/strategic-game-shell.css');
const outlinerStyle = read('src/styles/strategic-outliner.css');
const mobileStyle = read('src/styles/mobile-status-layout.css');
const guide = read('src/components/GameGuideStrip.tsx');
const runtimeHtml = read('runtime-test.html');
const browserSpec = read('tests/browser/tutorial-right-rail.spec.ts');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const chromeDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
const integrityDesign = read('docs/OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md');

requireText(shell, 'pendingItems={notificationCenter.pendingItems}', '战略追踪器必须复用通知中心待处理派生结果');
requireText(shell, 'tutorial={tutorial}', '战略追踪器必须始终接收当前教程控制器');
forbidText(shell, 'HIDDEN_EVENT_RAIL_TABS', '不得恢复按页面隐藏公开事件右栏的路由列表');
forbidText(shell, "pagePresentation !== 'fullscreen'", 'fullscreen 页面不得控制战略追踪器生命周期');
requireText(workspace, '<StrategicOutliner', 'StrategicWorkspaceChrome 必须直接持有统一战略追踪器');
forbidText(workspace, 'strategic-economic-event-rail', '不得恢复旧公开事件专用右栏');
requireText(workspace, 'const outlinerModel = strategicOutlinerModel(model);', '战略追踪器必须通过外壳展示投影适配器接收状态');
requireText(workspace, 'research: game.research ?? { active: null }', '缺少研发子投影时必须退化为空进行中状态而不是中断挂载');
requireText(workspace, 'facilityConstruction: game.facilityConstruction ?? null', '缺少施工子投影时必须退化为空进行中状态而不是中断挂载');
requireText(workspace, 'economicCalendar: game.economicCalendar ?? { events: [] }', '缺少经济日历子投影时必须退化为空事件列表而不是中断挂载');
requireText(workspace, "selectedProvinceId = typeof model.selectedProvinceId === 'string'", '战略追踪器必须为缺省地区上下文提供展示层回退');

for (const section of ['tutorial', 'activity', 'pinned', 'events']) {
  requireText(outliner, `id="${section}"`, `战略追踪器缺少 ${section} 分区`);
}
requireText(outliner, 'className="strategic-outliner__scroll"', '战略追踪器必须只有一个根级纵向滚动容器');
requireText(outliner, 'createStrategicOutlinerPin', '战略追踪器必须支持持久关注引用');
requireText(outliner, 'model.game.research.active', '进行中分区必须直接读取适配后的权威研发状态');
requireText(outliner, 'pendingItems.map', '进行中分区必须复用统一待处理事项');
requireText(outliner, 'economicCalendar?.events', '公开经济事件必须直接读取适配后的权威经济日历');
requireText(outliner, 'variant="outliner"', '教程必须使用追踪器紧凑模式且不得嵌套第二层玻璃卡');
forbidText(outliner, 'className="strategic-outliner__collapse"', '战略追踪器不得恢复整体展开／收起按钮');
forbidText(outliner, 'BackIcon', '战略追踪器不得保留整体收起按钮图标依赖');
forbidText(outliner, 'MapIcon', '战略追踪器不得保留整体收起轨道图标依赖');
forbidText(outliner, 'strategic-outliner__collapsed-map', '战略追踪器不得保留整体收起轨道 DOM');
requireText(guide, "variant?: 'panel' | 'outliner'", '教程组件必须提供追踪器紧凑模式');

requireText(storage, 'economy:strategic-outliner:v', '关注和分区折叠偏好必须按玩家保存在浏览器本地');
requireText(storage, 'collapsedSections', '战略追踪器必须持久化四个分区的折叠状态');
for (const kind of ['province', 'commodity', 'facility', 'auction', 'contract']) {
  requireText(storage, `'${kind}'`, `战略追踪器必须支持 ${kind} 引用`);
}
forbidText(storage, 'collapsed: boolean', '战略追踪器不得持久化整体收起状态');
forbidText(storage, 'defaultCollapsed', '战略追踪器整体几何不得由本地偏好初始化');
forbidText(storage, 'setCollapsed', '战略追踪器不得提供整体收起状态写入口');
forbidText(storage, 'lastTradePrice', '战略追踪器本地存储不得保存实时成交价');
forbidText(storage, 'inventory', '战略追踪器本地存储不得保存库存');
forbidText(storage, 'completesAt', '战略追踪器本地存储不得保存权威倒计时');
for (const legacy of ['--strategic-outliner-collapsed-width', '.strategic-outliner[data-collapsed=', '.strategic-outliner__collapse', '.strategic-outliner__collapsed-map']) {
  forbidText(shellStyle, legacy, `战略追踪器基础样式不得恢复整体横向收起实现: ${legacy}`);
  forbidText(outlinerStyle, legacy, `战略追踪器最终样式不得恢复整体横向收起实现: ${legacy}`);
}

requireText(shellStyle, '--strategic-outliner-width:', '桌面外壳必须定义追踪器展开宽度');
requireText(shellStyle, 'overflow-y: auto;', '追踪器必须提供唯一纵向滚动视口');
requireText(shellStyle, 'backdrop-filter: var(--frosted-glass-filter);', '追踪器外层必须复用共享毛玻璃滤镜');
requireText(outlinerStyle, '@media (min-width: 1440px)', '宽屏必须为普通页展开追踪器预留真实空间');
requireText(outlinerStyle, '@media (max-width: 1439px) and (min-width: 721px)', '中窄桌面必须允许完整追踪器覆盖展开');
requireText(outlinerStyle, '--strategic-outliner-reserved-width: var(--strategic-outliner-width);', '宽屏普通页必须预留完整追踪器宽度');
requireText(outlinerStyle, '.game-shell .strategic-outliner {\n  z-index: 2;', '战略追踪器最终层级必须与桌面 Toast 同为局部 z-index 2');
requireText(outlinerStyle, ':has(.strategic-page-host--fullscreen)', 'fullscreen 页面必须由页面 presentation 自动驱动追踪器可见性');
requireText(outlinerStyle, 'visibility: hidden;', 'fullscreen 页面必须隐藏同一战略追踪器 DOM');
requireText(outlinerStyle, 'pointer-events: none;', 'fullscreen 隐藏追踪器必须禁止命中');
requireText(outlinerStyle, '--strategic-outliner-reserved-width: 0px;', 'fullscreen 必须释放全部追踪器横向预留');
requireText(outlinerStyle, '100% - var(--strategic-panel-gap) * 2', 'fullscreen 主卡片必须只保留左右 8px 战略沟槽');
requireText(outlinerStyle, '.game-shell:not(:has(.strategic-page-host--fullscreen)) .strategic-outliner', '离开 fullscreen 后必须自动恢复普通页追踪器完整显示');
requireText(runtimeHtml, '<link rel="stylesheet" href="/src/styles/strategic-outliner.css" />', 'runtime 浏览器夹具必须加载正式入口的战略追踪器最终级联');
requireText(mobileStyle, ".strategic-outliner[data-tutorial-visible='true']", '移动教程必须继续由同一战略追踪器 DOM 持有');
requireText(mobileStyle, ".strategic-outliner-section:not(.strategic-outliner-section--tutorial)", '移动端必须隐藏桌面追踪分区而保留教程');

requireText(browserSpec, "toHaveAttribute('data-strategic-presentation', 'fullscreen')", '浏览器回归必须覆盖 fullscreen presentation');
requireText(browserSpec, 'await expect(outliner).toBeHidden()', '浏览器回归必须验证 fullscreen 追踪器隐藏');
requireText(browserSpec, "toHaveAttribute('data-strategic-presentation', 'building')", '浏览器回归必须覆盖离开 fullscreen 后恢复普通页');
requireText(browserSpec, 'collapseButton', '浏览器回归必须验证整体收起按钮不存在');
requireText(browserSpec, 'toHaveCount(0)', '浏览器回归必须验证整体收起按钮 DOM 已删除');
requireText(browserSpec, 'toBeCloseTo(8, 0)', '浏览器回归必须验证 fullscreen 主卡片右侧只保留 8px 屏幕边距');

requireText(pageDesign, '战略追踪器', '页面权威设计必须记录战略追踪器规则');
requireText(pageDesign, '页面路由生命周期解耦', '页面权威设计必须锁定追踪器与页面生命周期解耦');
requireText(pageDesign, '不得提供整体横向展开／收起按钮', '页面权威设计必须锁定无整体横向收起按钮');
requireText(pageDesign, '六个 `fullscreen` 页面在桌面端隐藏同一追踪器 DOM', '页面权威设计必须锁定 fullscreen 隐藏同一追踪器 DOM');
requireText(chromeDesign, '战略追踪器', '外壳权威设计必须记录战略追踪器几何');
requireText(chromeDesign, '不得提供追踪器整体横向展开／收起按钮', '外壳权威设计必须锁定无整体横向收起按钮');
requireText(chromeDesign, '六个 `fullscreen` 页面在桌面端隐藏同一追踪器', '外壳权威设计必须锁定 fullscreen 隐藏同一追踪器');
requireText(integrityDesign, '展示层缺省归一化', '概览布局权威设计必须锁定战略追踪器缺省子投影的安全降级规则');
requireText(integrityDesign, '不得写回权威状态、伪造经济值或中断整个 React 外壳挂载', '缺省投影规则必须限制为展示层兼容而非权威状态替代');

console.log('strategic outliner verification passed');
