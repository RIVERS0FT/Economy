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
const guide = read('src/components/GameGuideStrip.tsx');
const overview = read('src/pages/OverviewPage.tsx');
const settings = read('src/pages/SettingsPage.tsx');
const serverApp = read('server/src/app.js');
const tutorialStore = read('server/src/tutorial-store.js');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');

requireText(storage, 'CURRENT_TUTORIAL_VERSION = 2', '经营成长线客户端版本必须升级为 2');
requireText(storage, 'economy.game-tutorial.v', '成长线本轮状态必须按玩家保存在浏览器本地');
requireText(storage, 'sellOrderBaselineIds', '成长线必须记录本轮卖单基线');
for (const stepId of ['start-research', 'review-contracts', 'make-bank-deposit', 'review-leaderboard']) {
  requireText(storage, `'${stepId}'`, `经营成长线缺少步骤 ${stepId}`);
}
forbidText(controller, 'game.stats.', '成长线不得读取玩家全局累计统计');
requireText(controller, "candidate.remaining < candidate.quantity", '成交步骤必须观察本轮卖单的实际成交');
requireText(controller, 'group.lifetimeOutput <= baseline', '生产步骤必须使用本轮设施产量基线');
requireText(controller, "run.currentStep !== 'review-contracts' || model.tab !== 'contracts'", '合同目标必须在玩家实际打开合同页后推进');
requireText(controller, "run.currentStep !== 'review-leaderboard' || model.tab !== 'leaderboard'", '排行榜目标必须在玩家实际打开排行榜后完成');
requireText(definition, "targetTab: 'research'", '成长线必须把产业方向引导到研发页');
requireText(definition, "targetTab: 'contracts'", '成长线必须包含合同协作目标');
requireText(definition, "targetTab: 'bank'", '成长线必须包含银行资产配置目标');
requireText(definition, "targetTab: 'leaderboard'", '成长线必须以长期排行榜目标收束');

for (const text of [
  'const result = await model.work();',
  'if (result.ok) tutorial.recordWorkClick();',
  'const result = await model.buildFacility(facilityTypeId, quantity, procurement);',
  'if (result.ok) tutorial.recordBuildSubmit(facilityTypeId);',
  'const result = await model.startFacility(facilityTypeId);',
  'if (result.ok) tutorial.recordFacilityStartClick(facilityTypeId);',
  'const result = await model.placeAssetOrder(assetKind, assetId, side, quantity, price);',
  'if (result.ok) tutorial.recordSellOrderSubmit(assetKind, assetId, side);',
  'const result = await model.startResearch(technologyId);',
  'if (result.ok) tutorial.recordResearchStart();',
  'const result = await model.bankDeposit(amount);',
  'if (result.ok) tutorial.recordBankDeposit();',
]) requireText(gameApp, text, `经营成长线操作必须等待服务器成功结果：${text}`);

requireText(guide, '<span>经营成长线</span>', '概览引导条必须显示经营成长线名称');
requireText(guide, 'aria-label="经营成长线进度"', '成长线进度必须有正确无障碍名称');
requireText(overview, '<GameGuideStrip tutorial={model.tutorial} />', '概览今日经营必须显示经营成长线');
requireText(overview, 'model.tutorial.isVisible ? 2 : 3', '成长线显示时经营提醒必须限制为两条');
requireText(settings, '重新开始成长线', '设置页必须提供重新开始成长线按钮');
requireText(settings, '显示经营成长线', '设置页必须提供恢复显示成长线入口');
requireText(settings, 'tutorial.restart()', '设置页重开必须只调用客户端成长线状态机');
requireText(serverApp, "path === '/api/game/tutorial'", '服务器必须提供一次性成长线状态读取接口');
requireText(serverApp, "path === '/api/game/tutorial/complete'", '服务器必须提供幂等完成记录接口');
requireText(tutorialStore, 'CURRENT_TUTORIAL_VERSION = 2', '服务器成长线版本必须与客户端一致');
requireText(tutorialStore, 'economy_tutorial_completions', '服务器必须独立存储成长线完成版本');
requireText(tutorialStore, 'game_tutorial_completion_migration_version', '老玩家默认完成必须有一次性迁移标记');
forbidText(tutorialStore, 'workClicks', '服务器成长线完成记录不得保存步骤统计');
forbidText(tutorialStore, 'producedGoods', '服务器成长线完成记录不得读取生产累计统计');
forbidText(tutorialStore, 'soldGoods', '服务器成长线完成记录不得读取出售累计统计');
requireText(pageDesign, '### 11.1 客户端经营成长线', '页面权威设计必须记录客户端经营成长线规则');
requireText(pageDesign, '固定为十步', '页面权威设计必须锁定经营成长线十步结构');
requireText(pageDesign, 'economy_tutorial_completions', '页面权威设计必须记录成长线完成表和服务器负担边界');
requireText(pageDesign, '重新开始成长线', '页面权威设计必须记录设置页重开入口');

console.log('Operating growth line verification passed.');
