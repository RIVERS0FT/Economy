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
const gameApp = read('src/app/GameApp.tsx');
const overview = read('src/pages/OverviewPage.tsx');
const settings = read('src/pages/SettingsPage.tsx');
const serverApp = read('server/src/app.js');
const tutorialStore = read('server/src/tutorial-store.js');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');

requireText(storage, 'CURRENT_TUTORIAL_VERSION = 2', '教程版本必须升级到七步经营任务链 v2');
requireText(storage, "'expand-business'", '教程必须包含扩大经营步骤');
requireText(storage, 'expansionActions', '教程必须记录本轮扩大经营操作');
requireText(storage, 'economy.game-tutorial.v', '教程本轮状态必须按玩家保存在浏览器本地');
requireText(storage, 'sellOrderBaselineIds', '教程必须记录本轮卖单基线');
forbidText(controller, 'game.stats.', '教程不得读取玩家全局累计统计');
requireText(controller, "candidate.remaining < candidate.quantity", '成交步骤必须观察本轮卖单的实际成交');
requireText(controller, "currentStep: 'expand-business'", '首次成交后必须推进到扩大经营步骤');
requireText(controller, 'recordExpansionAction', '研发或仓库扩容必须完成扩大经营步骤');
requireText(controller, "recordTutorialEvent('hidden'", '隐藏教程必须发送轻量聚合事件');
requireText(controller, "recordTutorialEvent('restarted'", '重开教程必须发送轻量聚合事件');
requireText(controller, 'group.lifetimeOutput <= baseline', '生产步骤必须使用本轮设施产量基线');
requireText(gameApp, 'tutorial.recordWorkClick();\n      return model.work();', '工作步骤必须在请求前由客户端推进');
requireText(gameApp, 'tutorial.recordSellOrderSubmit(assetKind, assetId, side);', '商品卖单步骤必须在请求前由客户端推进');
requireText(gameApp, 'tutorial.recordExpansionAction();', '研发和仓库扩容必须在请求前记录扩大经营');
requireText(overview, '<GameGuideStrip tutorial={model.tutorial} />', '概览今日经营必须显示基础教程条');
requireText(overview, 'model.tutorial.isVisible ? 2 : 3', '教程显示时经营提醒必须限制为两条');
requireText(settings, '重新开始教程', '设置页必须提供重新开始教程按钮');
requireText(settings, 'tutorial.restart()', '设置页重开必须只调用客户端教程状态机');
requireText(serverApp, "path === '/api/game/tutorial'", '服务器必须提供一次性教程状态读取接口');
requireText(serverApp, "path === '/api/game/tutorial/complete'", '服务器必须提供幂等完成记录接口');
requireText(serverApp, "path === '/api/game/tutorial/event'", '服务器必须提供隐藏与重开的幂等事件接口');
requireText(tutorialStore, 'CURRENT_TUTORIAL_VERSION = 2', '服务器教程版本必须与客户端 v2 一致');
requireText(tutorialStore, 'economy_tutorial_completions', '服务器必须独立存储教程完成版本');
requireText(tutorialStore, 'completion_source', '教程完成必须区分迁移与玩家主动完成');
requireText(tutorialStore, 'economy_tutorial_events', '服务器必须聚合隐藏与重开事件');
requireText(tutorialStore, "event_type IN ('hidden', 'restarted')", '教程事件类型必须保持有界');
requireText(tutorialStore, 'game_tutorial_completion_migration_version', '老玩家默认完成必须有一次性迁移标记');
forbidText(tutorialStore, 'workClicks', '服务器教程完成记录不得保存步骤统计');
forbidText(tutorialStore, 'producedGoods', '服务器教程完成记录不得读取生产累计统计');
forbidText(tutorialStore, 'soldGoods', '服务器教程完成记录不得读取出售累计统计');
requireText(pageDesign, '### 11.1 客户端本轮教程', '页面权威设计必须记录客户端本轮教程规则');
requireText(pageDesign, 'economy_tutorial_completions', '页面权威设计必须记录教程完成表和服务器负担边界');
requireText(pageDesign, '七步', '页面权威设计必须记录七步经营任务链');
requireText(pageDesign, '扩大经营', '页面权威设计必须记录扩大经营收束步骤');
requireText(pageDesign, '重新开始教程', '页面权威设计必须记录设置页重开入口');
requireText(pageDesign, 'economy_tutorial_events', '页面权威设计必须记录教程事件聚合边界');
requireText(pageDesign, '不得保存步骤、目标、设施、商品、订单基线', '页面权威设计必须禁止服务器保存教程上下文');

console.log('Game tutorial verification passed.');
