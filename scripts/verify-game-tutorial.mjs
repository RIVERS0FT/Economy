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
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');

requireText(storage, 'economy.game-tutorial.v', '教程本轮状态必须按玩家保存在浏览器本地');
requireText(storage, 'sellOrderBaselineIds', '教程必须记录本轮卖单基线');
forbidText(controller, 'game.stats.', '教程不得读取玩家全局累计统计');
requireText(controller, "candidate.remaining < candidate.quantity", '成交步骤必须观察本轮卖单的实际成交');
requireText(controller, 'group.lifetimeOutput <= baseline', '生产步骤必须使用本轮设施产量基线');
requireText(gameApp, 'tutorial.recordWorkClick();\n      return model.work();', '工作步骤必须在请求前由客户端推进');
requireText(gameApp, 'tutorial.recordSellOrderSubmit(assetKind, assetId, side);', '商品卖单步骤必须在请求前由客户端推进');
requireText(overview, '<GameGuideStrip tutorial={model.tutorial} />', '概览今日经营必须显示基础教程条');
requireText(overview, 'model.tutorial.isVisible ? 2 : 3', '教程显示时经营提醒必须限制为两条');
requireText(settings, '重新开始教程', '设置页必须提供重新开始教程按钮');
requireText(settings, 'tutorial.restart()', '设置页重开必须只调用客户端教程状态机');
requireText(serverApp, "path === '/api/game/tutorial'", '服务器必须提供一次性教程状态读取接口');
requireText(serverApp, "path === '/api/game/tutorial/complete'", '服务器必须提供幂等完成记录接口');
requireText(tutorialStore, 'economy_tutorial_completions', '服务器必须独立存储教程完成版本');
requireText(tutorialStore, 'game_tutorial_completion_migration_version', '老玩家默认完成必须有一次性迁移标记');
forbidText(tutorialStore, 'workClicks', '服务器教程完成记录不得保存步骤统计');
forbidText(tutorialStore, 'producedGoods', '服务器教程完成记录不得读取生产累计统计');
forbidText(tutorialStore, 'soldGoods', '服务器教程完成记录不得读取出售累计统计');
requireText(productDesign, '客户端本轮教程', '产品设计必须记录客户端本轮教程规则');
requireText(pageDesign, '重新开始教程', '页面设计必须记录设置页重开入口');
requireText(serverDesign, 'economy_tutorial_completions', '服务器设计必须记录教程完成表');

console.log('Game tutorial verification passed.');
