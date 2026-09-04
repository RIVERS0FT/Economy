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

const storage = read('src/game-guide/tutorialStorage.ts');
const controller = read('src/game-guide/useGameTutorial.ts');
const definition = read('src/game-guide/tutorialDefinition.ts');
const tutorialEvents = read('src/game-guide/tutorialEvents.ts');
const facilityAutoOperation = read('src/components/facilities/FacilityAutoOperationControls.tsx');
const gameApp = read('src/app/GameApp.tsx');
const gameShell = read('src/components/shell/GameShell.tsx');
const autoTrade = read('src/auto-trade/useOnlineAutoTrade.ts');
const autoSellCompat = read('src/auto-sell/useOnlineAutoSell.ts');
const guide = read('src/components/GameGuideStrip.tsx');
const guideStyle = read('src/styles/game-guide.css');
const mobileStatusStyle = read('src/styles/mobile-status-layout.css');
const overview = read('src/pages/OverviewPage.tsx');
const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
const strategicOutliner = read('src/components/outliner/StrategicOutliner.tsx');
const settings = read('src/pages/SettingsPage.tsx');
const tutorialBrowser = read('tests/browser/tutorial-right-rail.spec.ts');
const serverApp = read('server/src/app.js');
const tutorialStore = read('server/src/tutorial-store.js');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const chromeDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');

requireText(storage, 'CURRENT_TUTORIAL_VERSION = 3', '教程客户端版本必须保持为 3');
requireText(storage, 'economy.game-tutorial.v', '教程本轮状态必须按玩家保存在浏览器本地');
requireText(storage, 'economy.game-tutorial-skipped.v', '教程跳过状态必须按玩家和教程版本独立保存');
requireText(storage, "(parsed as { status?: unknown }).status === 'hidden'", '旧隐藏状态必须只读迁移为已跳过');
requireText(storage, "writeItem(skippedKey(userId), '1')", '旧隐藏状态迁移后必须持久化跳过标记');
forbidText(storage, 'export type TutorialRunStatus', '教程本轮状态不得继续保留 active/hidden 模型');
forbidText(storage, 'status: TutorialRunStatus', '教程轮次不得继续保存隐藏状态');
requireText(storage, 'autoSellSettings', '教程必须保留 v3 本地统计键以兼容既有轮次');
requireText(storage, "'set-auto-sell'", '教程必须保留 v3 技术步骤 ID 以兼容既有轮次');
forbidText(storage, "  'work',", '教程不得恢复已删除的基础工作步骤');
requireText(storage, "rawStep === 'work' ? 'build-facility'", '旧工作步骤必须只读迁移到建设工厂');
forbidText(storage, 'workClicks:', '教程本轮统计不得恢复基础工作次数');
forbidText(storage, 'sellOrderBaselineIds', '教程不得继续依赖手动卖单基线');
for (const stepId of ['start-research', 'review-contracts', 'make-bank-deposit', 'review-leaderboard']) {
  requireText(storage, `'${stepId}'`, `教程缺少步骤 ${stepId}`);
}

forbidText(controller, 'game.stats.', '教程不得读取玩家全局累计统计');
requireText(controller, "updateCurrentRun('set-auto-sell', 'autoSellSettings'", '保存工厂自动经营后必须推进兼容步骤');
requireText(controller, 'FACTORY_AUTO_OPERATION_SAVED_EVENT', '教程必须监听工厂自动经营保存事件');
requireText(controller, 'facilityOutputProductId(model, detail.facilityTypeId)', '教程必须从本轮工厂当前生产配置绑定产成品');
requireText(controller, "window.addEventListener(FACTORY_AUTO_OPERATION_SAVED_EVENT, handleSaved)", '教程必须只在成功保存工厂自动经营后推进');
forbidText(controller, 'requestAutoSellPanel', '教程不得再打开已删除的商品自动交易设置面板');
requireText(controller, "current.currentStep !== 'complete-sale'", '自动出售成交必须只推进当前第五步');
requireText(controller, 'current.context.productId !== productId', '自动出售成交必须绑定本轮工厂产成品');
requireText(controller, 'group.lifetimeOutput <= baseline', '生产步骤必须使用本轮设施产量基线');
requireText(controller, "run.currentStep !== 'review-contracts' || model.tab !== 'contracts'", '合同目标必须在玩家实际打开合同页后推进');
requireText(controller, "run.currentStep !== 'review-leaderboard' || model.tab !== 'leaderboard'", '排行榜目标必须在玩家实际打开排行榜后完成');
requireText(controller, "subscribeStateAuthoritySlice('player.production', confirmProduction)", '生产完成检测必须只监听玩家生产子切片');
requireText(controller, "model.notify('教程已完成')", '教程完成提示必须使用当前展示名称');
requireText(controller, "model.notify('教程已从第一步重新开始')", '教程重开提示必须使用当前展示名称');
requireText(controller, "model.setTab('home');\n    model.notify('教程已从第一步重新开始')", '重新开始教程仍须回到概览');
requireText(controller, '&& !isTutorialSkipped(userId)', '跳过当前版本后不得在会话初始化时自动重建教程');
requireText(controller, 'const skip = useCallback(() => {', '教程控制器必须提供独立跳过动作');
requireText(controller, 'clearTutorialRun(userId);\n    setTutorialSkipped(userId, true);', '跳过必须清除本轮进度并记录跳过状态');
requireText(controller, "model.notify('已跳过教程，可在设置中重新开始')", '跳过提示必须明确设置中只能重新开始');
requireText(controller, "? '已跳过'", '设置页状态必须能够显示已跳过');
requireText(controller, 'setTutorialSkipped(userId, false);\n    const fresh = createTutorialRun();', '重新开始必须清除跳过标记并从第一步新建教程');
forbidText(controller, "status: 'hidden'", '教程控制器不得继续写入隐藏轮次');

requireText(definition, "id: 'set-auto-sell'", '教程必须保留兼容技术步骤 ID');
requireText(definition, "title: '设置工厂自动经营'", '教程必须教玩家设置工厂自动经营');
for (const text of ['原料保障']) {
  requireText(definition, text, `自动经营教程必须说明 ${text}`);
}
for (const text of ['经营模式', '产成品处理']) {
  forbidText(definition, text, `自动经营教程不得恢复 ${text}`);
}
requireText(definition, "actionLabel: '设置自动经营'", '自动经营教程操作名称必须指向工厂策略');
requireText(definition, "targetTab: 'buildings'", '自动经营教程必须引导到建筑页');
forbidText(definition, '最低自由库存可填写 0', '教程不得恢复商品级最低自由库存编辑说明');
forbidText(definition, '设置自动交易', '教程不得恢复商品级自动交易设置入口');

requireText(tutorialEvents, "FACTORY_AUTO_OPERATION_SAVED_EVENT = 'economy:factory-auto-operation-saved'", '教程必须使用唯一工厂自动经营保存事件');
requireText(facilityAutoOperation, 'announceFactoryAutoOperationSaved({', '工厂策略保存成功必须通知教程');
requireText(facilityAutoOperation, 'if (response.result.ok)', '失败的工厂策略保存不得推进教程');
for (const text of [
  'const result = await model.buildFacility(facilityTypeId, quantity, procurement);',
  'if (result.ok) tutorial.recordBuildSubmit(facilityTypeId);',
  'const result = await model.startFacility(facilityTypeId);',
  'if (result.ok) tutorial.recordFacilityStartClick(facilityTypeId);',
  'const result = await model.startResearch(technologyId);',
  'if (result.ok) tutorial.recordResearchStart();',
  'const result = await model.bankDeposit(amount);',
  'if (result.ok) tutorial.recordBankDeposit();',
  'onSale: tutorial.recordAutoSellCompletion',
]) requireText(gameApp, text, `教程操作必须使用当前成功语义：${text}`);
forbidText(gameApp, 'onAutoSellPolicyEnabled:', '教程不得再由商品级自动交易设置推进');
forbidText(gameApp, 'tutorial.recordWorkClick', '基础工作移除后不得继续推进教程');
forbidText(gameApp, 'tutorial.recordSellOrderSubmit', '教程不得继续把手动卖单作为自动经营步骤');
requireText(autoTrade, "if (side === 'sell' && result.ok && result.message.includes('自动出售'))", '自动出售步骤必须只由服务器确认实际自动出售成交后推进，单纯挂单不得推进');
requireText(autoTrade, 'callbacks.onSale?.(productId);', '统一自动交易控制器必须把实际自动出售成交回传教程');
requireText(autoSellCompat, "from '../auto-trade/useOnlineAutoTrade'", '旧自动出售 hook 入口必须转发到统一自动交易控制器');

requireText(guide, "variant?: 'panel' | 'outliner'", '教程组件必须同时支持普通面板与战略追踪器紧凑模式');
requireText(guide, "'game-guide-strip game-guide-strip--outliner'", '战略追踪器教程不得再嵌套独立 panel 外壳');
requireText(guide, '<strong id="game-guide-title">教程</strong>', '普通教程面板兼容模式必须保留统一名称“教程”');
requireText(guide, 'aria-label="教程总体进度"', '教程总体进度必须有明确无障碍名称');
requireText(guide, 'className="game-guide-task"', '当前任务必须与总体进度分成独立内容区');
requireText(guide, '>跳过</Button>', '教程卡必须提供跳过动作');
requireText(guide, '确定跳过教程吗？', '跳过教程必须先确认');
requireText(guide, '设置 / 游戏设置 / 教程', '跳过确认必须说明可在设置中重新开始');
forbidText(guide, '暂时隐藏', '教程卡不得恢复暂时隐藏动作');
forbidText(guide, '经营成长线', '教程卡不得恢复旧展示名称');
const progressIndex = guide.indexOf('className="game-guide-progress"');
const taskIndex = guide.indexOf('className="game-guide-task"');
if (progressIndex < 0 || taskIndex < 0 || progressIndex > taskIndex) {
  throw new Error('教程总体进度必须位于当前单个任务之前');
}
forbidText(guideStyle, 'border: 1px solid color-mix(in srgb, var(--accent, #4f7cff)', '教程业务样式不得复制旧强调色卡片边框');
forbidText(guideStyle, 'background: color-mix(in srgb, var(--accent, #4f7cff) 8%', '教程业务样式不得复制旧强调色卡片背景');
requireText(strategicWorkspace, '<StrategicOutliner', 'StrategicWorkspaceChrome 必须持有统一战略追踪器');
forbidText(strategicWorkspace, 'strategic-economic-event-rail', '不得恢复旧公开事件专用右栏');
requireText(strategicOutliner, 'const showTutorial = Boolean(tutorial?.isVisible && tutorial.currentStep);', '战略追踪器必须按教程自身状态决定是否显示教程分区');
requireText(strategicOutliner, "data-tutorial-visible={showTutorial ? 'true' : 'false'}", '战略追踪器必须暴露教程可见状态供移动几何防回退');
requireText(strategicOutliner, 'variant="outliner"', '教程必须由战略追踪器单一 DOM 以紧凑模式持有');
forbidText(strategicOutliner, "model.tab === 'home' && tutorial", '教程不得重新绑定概览页面');
requireText(gameShell, 'tutorial={tutorial}', '所有玩家页面必须向同一战略追踪器传递教程控制器');
requireText(gameShell, 'pendingItems={notificationCenter.pendingItems}', '战略追踪器必须复用统一待处理派生结果');
forbidText(gameShell, "pagePresentation !== 'fullscreen'", 'fullscreen 页面不得再控制教程或战略追踪器生命周期');
forbidText(gameShell, 'HIDDEN_EVENT_RAIL_TABS', '不得恢复按页面隐藏右栏的路由列表');
forbidText(gameShell, 'tutorial.skip()', '页面切换不得把展示变化实现成跳过');
requireText(mobileStatusStyle, '--mobile-below-status-top: calc(', '移动教程与通知必须共享状态栏下方顶部基准');
requireText(mobileStatusStyle, ".game-shell .strategic-outliner[data-tutorial-visible='true']", '移动断点必须复用同一战略追踪器 DOM 作为教程锚点');
requireText(mobileStatusStyle, 'top: var(--mobile-below-status-top);', '移动教程必须固定在状态栏下方');
requireText(mobileStatusStyle, 'right: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));', '移动教程右侧必须使用统一工作区安全沟槽');
requireText(mobileStatusStyle, 'left: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));', '移动教程左侧必须使用统一工作区安全沟槽');
requireText(mobileStatusStyle, ".strategic-outliner-section:not(.strategic-outliner-section--tutorial)", '移动断点必须隐藏桌面追踪分区而保留教程分区');
forbidText(overview, 'GameGuideStrip', '概览不得重新持有教程组件');
forbidText(overview, 'overview-mobile-tutorial', '概览不得恢复移动教程入口');
forbidText(overview, 'overview-today-panel', '概览不得恢复今日经营卡');
forbidText(overview, 'OverviewWorkButton', '概览不得恢复基础工作入口');
forbidText(settings, '>显示教程</Button>', '设置页不得恢复显示教程按钮');
forbidText(settings, 'onClick={tutorial.show}', '设置页不得提供继续被跳过教程的入口');
requireText(settings, '>重新开始教程</Button>', '设置页必须保留重新开始教程按钮');
requireText(settings, 'clearTutorialSkip(user.id);', '删除存档时必须清除教程跳过标记');
requireText(settings, '工厂自动经营设置、自动成交', '设置页重开说明必须反映新版教程');
requireText(settings, 'tutorial.restart()', '设置页重开必须只调用客户端教程状态机');
forbidText(settings, '经营成长线', '设置页不得恢复旧展示名称');

requireText(tutorialBrowser, 'desktop strategic outliner persists across business and fullscreen pages', '浏览器回归必须验证桌面追踪器跨普通与全宽页面保持同一 DOM');
requireText(tutorialBrowser, 'mobile tutorial stays shell-owned inside the shared outliner while pages and notifications cover it', '浏览器回归必须覆盖移动同一 Outliner 教程层级');
requireText(tutorialBrowser, "page.locator('.overview-mobile-tutorial')).toHaveCount(0)", '浏览器回归必须验证概览没有移动教程 DOM');
requireText(tutorialBrowser, "aria-label', '教程总体进度'", '浏览器回归必须验证教程总体进度语义');
requireText(tutorialBrowser, "toHaveAttribute('data-strategic-presentation', 'fullscreen')", '浏览器回归必须逐个验证全宽 presentation');
requireText(tutorialBrowser, "toHaveAttribute('data-browser-outliner-sentinel', 'persistent')", '浏览器回归必须验证全宽页面不会重建追踪器 DOM');
requireText(tutorialBrowser, "[data-outliner-section=\"activity\"]", '浏览器回归必须验证移动端隐藏进行中分区');
requireText(tutorialBrowser, "[data-outliner-section=\"pinned\"]", '浏览器回归必须验证移动端隐藏关注分区');
requireText(tutorialBrowser, "[data-outliner-section=\"events\"]", '浏览器回归必须验证移动端隐藏公开经济事件分区');
requireText(tutorialBrowser, '[data-mobile-workspace-sheet-host="true"]', '浏览器回归必须验证页面 Sheet 覆盖移动教程');
requireText(tutorialBrowser, '.notification-panel-layer[data-notification-layer="dialog"]', '浏览器回归必须验证通知面板覆盖移动教程');
requireText(tutorialBrowser, 'expect(layerOrder.dialog).toBe(3000);', '浏览器回归必须锁定根 Dialog 层');
requireText(tutorialBrowser, 'expect(layerOrder.chrome).toBe(3001);', '浏览器回归必须锁定状态栏 Chrome 最高层');

requireText(serverApp, "path === '/api/game/tutorial'", '服务器必须提供一次性教程状态读取接口');
requireText(serverApp, "path === '/api/game/tutorial/complete'", '服务器必须提供幂等完成记录接口');
requireText(tutorialStore, 'CURRENT_TUTORIAL_VERSION = 3', '服务器教程版本必须与客户端一致');
requireText(tutorialStore, 'economy_tutorial_completions', '服务器必须独立存储教程完成版本');
requireText(tutorialStore, 'game_tutorial_completion_migration_version', '老玩家默认完成必须有一次性迁移标记');
forbidText(tutorialStore, 'workClicks', '服务器教程完成记录不得保存步骤统计');
forbidText(tutorialStore, 'producedGoods', '服务器教程完成记录不得读取生产累计统计');
forbidText(tutorialStore, 'soldGoods', '服务器教程完成记录不得读取出售累计统计');

requireText(pageDesign, '### 11.1 客户端教程', '页面权威设计必须记录客户端教程规则');
requireText(pageDesign, '教程固定为九步', '页面权威设计必须锁定教程九步结构');
requireText(pageDesign, '设置工厂自动经营、完成一次自动出售', '页面权威设计必须记录生产—自动经营—统一商品出售教程');
requireText(pageDesign, '成功更新自动经营策略', '页面权威设计必须记录自动经营步骤只由成功更新推进');
requireText(pageDesign, '教程只有进行中、已跳过和已完成三种结果', '页面权威设计必须锁定教程结果状态');
requireText(pageDesign, '设置页不提供“显示教程”或继续教程入口', '页面权威设计必须锁定跳过后只能重新开始');
requireText(pageDesign, '桌面所有页面（包括六个 `fullscreen` 页面）都复用同一 Outliner DOM', '页面权威设计必须锁定桌面教程与路由生命周期解耦');
requireText(pageDesign, '移动端继续复用同一 Outliner DOM', '页面权威设计必须锁定移动教程单实例');
requireText(pageDesign, '页面切换不得重置分区折叠、关注、滚动或教程步骤', '页面权威设计必须锁定页面切换不修改教程和追踪器交互状态');
requireText(pageDesign, 'economy_tutorial_completions', '页面权威设计必须记录教程完成表和服务器负担边界');
requireText(chromeDesign, '## 5. 玩家页面与战略追踪器', '外壳权威设计必须记录统一战略追踪器');
requireText(chromeDesign, '战略追踪器与页面路由生命周期解耦', '外壳权威设计必须锁定桌面追踪器常驻');
requireText(chromeDesign, 'GameGuideStrip variant="outliner"', '外壳权威设计必须锁定教程紧凑 Outliner 模式');
requireText(chromeDesign, '同一个 `StrategicOutliner` DOM 仅呈现“教程”分区', '外壳权威设计必须锁定移动教程单实例和外壳归属');
requireText(chromeDesign, '--mobile-below-status-top', '外壳权威设计必须锁定移动教程状态栏下方基准');
requireText(chromeDesign, '左右使用 `--mobile-workspace-gutter` 与安全区较大值', '外壳权威设计必须锁定移动教程统一左右安全沟槽');
requireText(chromeDesign, '“跳过”', '外壳权威设计必须继续记录教程跳过语义');
requireText(chromeDesign, '地图／普通页面 < 移动教程 < 根 Sheet < 移动通知面板／通知灵动岛 < 状态栏', '外壳权威设计必须锁定移动教程覆盖层级');
requireText(chromeDesign, 'Outliner 变体不得带独立 `.panel` 外壳', '外壳权威设计必须锁定教程不嵌套第二层玻璃卡');

console.log('Tutorial verification passed.');
