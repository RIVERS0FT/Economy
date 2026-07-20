import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};

const paths = {
  registry: 'src/utils/authoritativeCountdowns.ts',
  coordinator: 'src/components/system/AuthoritativeCountdownRefresh.tsx',
  app: 'src/app/GameApp.tsx',
  production: 'src/pages/ProductionPage.tsx',
  overview: 'src/pages/OverviewPage.tsx',
  auction: 'src/pages/AuctionPage.tsx',
  design: 'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md',
  docsIndex: 'docs/README.md',
  package: 'package.json',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  for (const text of [
    'game.facilityConstruction?.completesAt',
    "group.status !== 'running'",
    'Number(group.cycleStartedAt) + recipe.cycleMs',
    "auction.status === 'open'",
    'auction.endsAt',
    'leaderboardsFromGame(game)?.period.endsAt',
    'return deadlines.sort((left, right) => left - right);',
  ]) requireText(paths.registry, text);

  for (const text of [
    'AUTHORITY_CONFIRMATION_RETRY_MS = 1_000',
    'nextAuthoritativeCountdownDeadline(game)',
    'game.lastProcessedAt + Math.max(0, Date.now() - receivedAt)',
    'confirmAuthority();',
    'window.setTimeout(beginConfirmation, remaining)',
    'window.setInterval(confirmAuthority, AUTHORITY_CONFIRMATION_RETRY_MS)',
    'window.clearTimeout(deadlineTimer)',
    'window.clearInterval(confirmationTimer)',
  ]) requireText(paths.coordinator, text);

  for (const text of [
    "import { AuthoritativeCountdownRefresh } from '../components/system/AuthoritativeCountdownRefresh';",
    '<AuthoritativeCountdownRefresh game={game} refresh={model.refresh} />',
  ]) requireText(paths.app, text);

  for (const text of [
    'constructionAwaitingConfirmation',
    "constructionRemaining === 0",
    '确认完工中…',
    '正在同步服务器结算结果',
    'disabled={hasConstruction || game.credits < selectedType.buildCost}',
  ]) requireText(paths.production, text);

  for (const text of [
    'const workRemaining = Math.max(0, game.work.cooldownUntil - now);',
    'disabled={isWorking || workRemaining > 0}',
  ]) requireText(paths.overview, text);

  for (const text of [
    "return remaining === 0 ? '等待服务器结算' : formatDuration(remaining);",
    "const openAuctions = assetAuctions.filter((auction) => auction.status === 'open');",
  ]) requireText(paths.auction, text);

  for (const text of [
    '本地资格倒计时',
    '权威状态转换倒计时',
    '`src/utils/authoritativeCountdowns.ts`',
    '每 `1,000ms` 再确认一次',
    '页面切换不得中止到期确认',
    '施工卡固定在归零后显示“确认完工中…”',
    '工作冷却 `work.cooldownUntil`',
    '`scripts/verify-authoritative-countdowns.mjs` 必须加入 `verify:architecture`',
  ]) requireText(paths.design, text);

  for (const text of [
    '`AUTHORITATIVE_COUNTDOWN_DESIGN.md`',
    '所有可见倒计时必须先区分本地资格到期与服务器权威状态转换',
    '`scripts/verify-authoritative-countdowns.mjs`',
  ]) requireText(paths.docsIndex, text);

  requireText(paths.package, '"verify:authoritative-countdowns": "node scripts/verify-authoritative-countdowns.mjs"');
  requireText(paths.package, 'node scripts/verify-authoritative-countdowns.mjs && node scripts/verify-primary-surface-insets.mjs');
}

if (failures.length > 0) {
  console.error('权威倒计时验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('权威倒计时验证通过：工作冷却本地解锁，施工、生产周期、拍卖和排行榜到期统一立即刷新并每秒确认，页面确认状态与文档规则均已锁定。');
