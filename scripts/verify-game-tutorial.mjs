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
const gameApp = read('src/app/GameApp.tsx');
const autoTrade = read('src/auto-trade/useOnlineAutoTrade.ts');
const autoSellCompat = read('src/auto-sell/useOnlineAutoSell.ts');
const guide = read('src/components/GameGuideStrip.tsx');
const guideStyle = read('src/styles/game-guide.css');
const overview = read('src/pages/OverviewPage.tsx');
const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
const strategicStyle = read('src/styles/strategic-game-shell.css');
const settings = read('src/pages/SettingsPage.tsx');
const serverApp = read('server/src/app.js');
const tutorialStore = read('server/src/tutorial-store.js');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const chromeDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');

requireText(storage, 'CURRENT_TUTORIAL_VERSION = 3', '教程客户端版本必须保持为 3');
requireText(storage, 'economy.game-tutorial.v', '教程本轮状态必须按玩家保存在浏览器本地');
requireText(storage, 'autoSellSettings', '教程必须记录本轮自动出售设置');
requireText(storage, "'set-auto-sell'", '教程必须包含自动出售设置步骤');
forbidText(storage, "  'work',", '教程不得恢复已删除的基础工作步骤');
requireText(storage, "rawStep === 'work' ? 'build-facility'", '旧工作步骤必须只读迁移到建设工厂');
forbidText(storage, 'workClicks:', '教程本轮统计不得恢复基础工作次数');
forbidText(storage, 'sellOrderBaselineIds', '教程不得继续依赖手动卖单基线');
for (const stepId of ['start-research', 'review-contracts', 'make-bank-deposit', 'review-leaderboard']) {
  requireText(storage, `'${stepId}'`, `教程缺少步骤 ${stepId}`);
}
forbidText(controller, 'game.stats.', '教程不得读取玩家全局累计统计');
requireText(controller, "updateCurrentRun('set-auto-sell', 'autoSellSettings'", '自动出售设置成功后必须推进第五步');
requireText(controller, "current.currentStep !== 'complete-sale'", '自动出售成交必须只推进当前第六步');
requireText(controller, 'current.context.productId !== productId', '自动出售成交必须绑定本轮商品');
requireText(controller, 'group.lifetimeOutput <= baseline', '生产步骤必须使用本轮设施产量基线');
requireText(controller, "run.currentStep !== 'review-contracts' || model.tab !== 'contracts'", '合同目标必须在玩家实际打开合同页后推进');
requireText(controller, "run.currentStep !== 'review-leaderboard' || model.tab !== 'leaderboard'", '排行榜目标必须在玩家实际打开排行榜后完成');
requireText(controller, 'requestAutoSellPanel(userId, productId)', '教程第五步必须直接打开市场自动交易工作区的自动出售方向');
requireText(controller, "subscribeStateAuthoritySlice('player.production', confirmProduction)", '生产完成检测必须只监听玩家生产子切片');
requireText(controller, "model.notify('教程已完成')", '教程完成提示必须使用当前展示名称');
requireText(controller, "model.notify('教程已从第一步重新开始')", '教程重开提示必须使用当前展示名称');
requireText(controller, "model.setTab('home');\n    model.notify('教程已从第一步重新开始')", '重新开始教程仍须回到概览');
const showStart = controller.indexOf('const show = useCallback');
const showEnd = controller.indexOf('const openCurrentTarget', showStart);
if (showStart < 0 || showEnd < 0) throw new Error('缺少教程显示控制器');
forbidText(controller.slice(showStart, showEnd), "model.setTab('home')", '显示教程不得再强制跳回概览');
requireText(definition, "id: 'set-auto-sell'", '教程第五步必须保持自动出售设置');
requireText(definition, "title: '设置商品自动出售'", '教程必须明确教玩家设置自动出售');
requireText(definition, '最低自由库存可填写 0', '教程必须说明最低自由库存是可选的额外保留');
requireText(definition, "targetTab: 'market'", '自动出售教程必须引导到市场自动交易工作区');

for (const text of [
  'const result = await model.buildFacility(facilityTypeId, quantity, procurement);',
  'if (result.ok) tutorial.recordBuildSubmit(facilityTypeId);',
  'const result = await model.startFacility(facilityTypeId);',
  'if (result.ok) tutorial.recordFacilityStartClick(facilityTypeId);',
  'const result = await model.startResearch(technologyId);',
  'if (result.ok) tutorial.recordResearchStart();',
  'const result = await model.bankDeposit(amount);',
  'if (result.ok) tutorial.recordBankDeposit();',
  'onAutoSellPolicyEnabled: tutorial.recordAutoSellSetting',
  'onSale: tutorial.recordAutoSellCompletion',
]) requireText(gameApp, text, `教程操作必须使用当前成功语义：${text}`);
forbidText(gameApp, 'tutorial.recordWorkClick', '基础工作移除后不得继续推进教程');
forbidText(gameApp, 'tutorial.recordSellOrderSubmit', '教程不得继续把手动卖单作为第五步');
requireText(autoTrade, "if (side === 'sell' && result.ok && result.message.includes('自动出售'))", '第六步必须只由服务器确认发生实际自动出售成交后推进，单纯挂出自动卖单不得推进');
requireText(autoTrade, 'callbacks.onSale?.(productId);', '统一自动交易控制器必须把实际自动出售成交回传教程');
requireText(autoSellCompat, "from '../auto-trade/useOnlineAutoTrade'", '旧自动出售 hook 入口必须转发到统一自动交易控制器');

requireText(guide, 'className="game-guide-strip panel"', '教程卡必须直接复用统一 panel 毛玻璃表面');
requireText(guide, '<span>教程</span>', '教程卡必须显示统一名称“教程”');
requireText(guide, 'aria-label="教程进度"', '教程进度必须有正确无障碍名称');
forbidText(guide, '经营成长线', '教程卡不得恢复旧展示名称');
forbidText(guideStyle, 'border: 1px solid color-mix(in srgb, var(--accent, #4f7cff)', '教程业务样式不得复制旧强调色卡片边框');
forbidText(guideStyle, 'background: color-mix(in srgb, var(--accent, #4f7cff) 8%', '教程业务样式不得复制旧强调色卡片背景');
requireText(strategicWorkspace, 'className="strategic-right-rail strategic-economic-event-rail"', '教程与公开事件必须共用统一右侧信息栏宿主');
requireText(strategicWorkspace, 'const showTutorial = Boolean(tutorial?.isVisible && tutorial.currentStep);', '桌面外壳必须按教程自身状态决定是否显示');
requireText(strategicWorkspace, 'if (!showEventRail && !showTutorial) return null;', '教程和公开事件必须独立决定右栏生命周期');
requireText(strategicWorkspace, "data-tutorial-visible={showTutorial ? 'true' : 'false'}", '右栏必须暴露教程可见状态供几何防回退');
requireText(strategicWorkspace, "data-event-log-visible={showEventRail ? 'true' : 'false'}", '右栏必须独立暴露事件日志可见状态');
requireText(strategicWorkspace, '{showTutorial && tutorial ? <GameGuideStrip tutorial={tutorial} /> : null}', '桌面教程必须由右栏直接持有');
requireText(strategicWorkspace, '{showEventRail ? (', '公开事件日志必须由独立条件控制');
forbidText(strategicWorkspace, "model.tab === 'home' && tutorial", '桌面教程不得重新绑定概览页面');
requireText(strategicStyle, '.strategic-right-rail {', '右侧信息栏必须拥有统一入场动画宿主');
requireText(strategicStyle, '@keyframes strategic-right-rail-enter', '右侧信息栏必须提供独立入场动画');
requireText(strategicStyle, 'clip-path: inset(0 0 0 100%);', '右侧信息栏必须从右侧揭开');
forbidText(strategicStyle, '.game-shell.strategic-tab-research:has(.strategic-economic-event-rail[data-tutorial-visible="true"])', 'fullscreen 页面不得因教程右栏出现而缩窄');
requireText(overview, 'className="overview-mobile-tutorial"', '概览必须保留移动端教程入口');
requireText(overview, '<GameGuideStrip tutorial={model.tutorial} />', '移动端教程入口必须复用统一组件');
forbidText(overview, 'overview-today-panel', '概览不得恢复今日经营卡');
forbidText(overview, 'OverviewWorkButton', '概览不得恢复基础工作入口');
requireText(settings, '>显示教程</Button>', '设置页必须提供显示教程按钮');
requireText(settings, '>重新开始教程</Button>', '设置页必须提供重新开始教程按钮');
requireText(settings, '自动出售设置、自动成交', '设置页重开说明必须反映新版教程');
requireText(settings, 'tutorial.restart()', '设置页重开必须只调用客户端教程状态机');
forbidText(settings, '经营成长线', '设置页不得恢复旧展示名称');

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
requireText(pageDesign, '设置商品自动出售、完成一次自动出售', '页面权威设计必须记录生产—自动出售教程');
requireText(pageDesign, '合法最低自由库存保留量（允许 `0`）', '页面权威设计必须记录自动出售自由库存设置');
requireText(pageDesign, '“显示教程”只原地恢复当前轮次', '页面权威设计必须锁定显示教程不跳转概览');
requireText(pageDesign, '桌面教程显示在外壳右侧信息栏顶部，只由教程自身显示状态控制', '页面权威设计必须锁定教程跨页面常驻');
requireText(pageDesign, '把教程与公开经济事件拆成两个右栏容器', '页面权威设计必须防止教程和公开事件拆分宿主');
requireText(pageDesign, 'economy_tutorial_completions', '页面权威设计必须记录教程完成表和服务器负担边界');
requireText(chromeDesign, '## 5. 玩家页面与右侧信息栏', '外壳权威设计必须记录通用右侧信息栏');
requireText(chromeDesign, '教程是桌面应用外壳级常驻模块', '外壳权威设计必须锁定桌面教程常驻');
requireText(chromeDesign, '教程卡根节点必须复用通用 `.panel`', '外壳权威设计必须锁定教程共享毛玻璃材质');
requireText(chromeDesign, 'fullscreen 主卡片始终保持完整工作区宽度', '外壳权威设计必须锁定 fullscreen 允许右栏覆盖正文');
requireText(chromeDesign, '`strategic-right-rail-enter` 入场动画', '外壳权威设计必须锁定右栏首次显示动画');

console.log('Tutorial verification passed.');
