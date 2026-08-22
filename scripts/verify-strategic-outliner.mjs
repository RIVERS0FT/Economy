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
const mobileStyle = read('src/styles/mobile-status-layout.css');
const guide = read('src/components/GameGuideStrip.tsx');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const chromeDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');

requireText(shell, 'pendingItems={notificationCenter.pendingItems}', '战略追踪器必须复用通知中心待处理派生结果');
requireText(shell, 'tutorial={tutorial}', '战略追踪器必须始终接收当前教程控制器');
forbidText(shell, 'HIDDEN_EVENT_RAIL_TABS', '不得恢复按页面隐藏公开事件右栏的路由列表');
forbidText(shell, "pagePresentation !== 'fullscreen'", 'fullscreen 页面不得再控制战略追踪器生命周期');
requireText(workspace, '<StrategicOutliner', 'StrategicWorkspaceChrome 必须直接持有统一战略追踪器');
forbidText(workspace, 'strategic-economic-event-rail', '不得恢复旧公开事件专用右栏');

for (const section of ['tutorial', 'activity', 'pinned', 'events']) {
  requireText(outliner, `id="${section}"`, `战略追踪器缺少 ${section} 分区`);
}
requireText(outliner, 'className="strategic-outliner__scroll"', '战略追踪器必须只有一个根级纵向滚动容器');
requireText(outliner, 'createStrategicOutlinerPin', '战略追踪器必须支持持久关注引用');
requireText(outliner, 'model.game.research.active', '进行中分区必须直接读取权威研发状态');
requireText(outliner, 'pendingItems.map', '进行中分区必须复用统一待处理事项');
requireText(outliner, 'economicCalendar?.events', '公开经济事件必须直接读取权威经济日历');
requireText(outliner, 'variant="outliner"', '教程必须使用追踪器紧凑模式且不得嵌套第二层玻璃卡');
requireText(guide, "variant?: 'panel' | 'outliner'", '教程组件必须提供追踪器紧凑模式');

requireText(storage, 'economy:strategic-outliner:v', '关注和折叠偏好必须按玩家保存在浏览器本地');
for (const kind of ['province', 'commodity', 'facility', 'auction', 'contract']) {
  requireText(storage, `'${kind}'`, `战略追踪器必须支持 ${kind} 引用`);
}
forbidText(storage, 'lastTradePrice', '战略追踪器本地存储不得保存实时成交价');
forbidText(storage, 'inventory', '战略追踪器本地存储不得保存库存');
forbidText(storage, 'completesAt', '战略追踪器本地存储不得保存权威倒计时');

requireText(shellStyle, '--strategic-outliner-width:', '桌面外壳必须定义追踪器展开宽度');
requireText(shellStyle, '--strategic-outliner-collapsed-width: 44px', '中窄桌面追踪器折叠轨道必须保持 44px');
requireText(shellStyle, '.strategic-outliner[data-collapsed="true"]', '追踪器必须提供收起态');
requireText(shellStyle, 'overflow-y: auto;', '追踪器必须提供唯一纵向滚动视口');
requireText(shellStyle, 'backdrop-filter: var(--frosted-glass-filter);', '追踪器外层必须复用共享毛玻璃滤镜');
requireText(shellStyle, '@media (min-width: 1440px)', '宽屏必须为展开追踪器预留真实空间');
requireText(shellStyle, '@media (max-width: 1439px) and (min-width: 721px)', '中窄桌面必须只预留折叠轨道并允许展开覆盖');
requireText(mobileStyle, ".strategic-outliner[data-tutorial-visible='true']", '移动教程必须继续由同一战略追踪器 DOM 持有');
requireText(mobileStyle, ".strategic-outliner-section:not(.strategic-outliner-section--tutorial)", '移动端必须隐藏桌面追踪分区而保留教程');

requireText(pageDesign, '战略追踪器', '页面权威设计必须记录战略追踪器规则');
requireText(pageDesign, '页面路由生命周期解耦', '页面权威设计必须锁定追踪器与页面生命周期解耦');
requireText(chromeDesign, '战略追踪器', '外壳权威设计必须记录战略追踪器几何');
requireText(chromeDesign, '44px', '外壳权威设计必须记录中窄桌面折叠轨道宽度');

console.log('strategic outliner verification passed');
