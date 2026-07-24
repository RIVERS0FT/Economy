import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createScanner, LanguageVariant, SyntaxKind } from 'typescript/unstable/ast';
import { buildAssetAllocation } from '../src/utils/assetAllocation.ts';
import { findVisibleRange } from '../src/utils/virtualListRange.ts';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function fail(message) {
  failures.push(message);
}

function importTargets(path) {
  const source = read(path);
  const scanner = createScanner(true, LanguageVariant.JSX, source);
  const dynamic = [];
  const staticImports = [];
  let token = scanner.scan();
  while (token !== SyntaxKind.EndOfFile) {
    if (token === SyntaxKind.ImportKeyword) {
      const next = scanner.scan();
      if (next === SyntaxKind.OpenParenToken) {
        const target = scanner.scan();
        if (target === SyntaxKind.StringLiteral) dynamic.push(scanner.getTokenValue());
      } else {
        let current = next;
        while (current !== SyntaxKind.EndOfFile && current !== SyntaxKind.SemicolonToken) {
          if (current === SyntaxKind.StringLiteral) {
            staticImports.push(scanner.getTokenValue());
            break;
          }
          current = scanner.scan();
        }
      }
    }
    token = scanner.scan();
  }
  return { dynamic, staticImports };
}

const appImports = importTargets('src/app/App.tsx');
for (const target of ['./AdminApp', './GameApp']) {
  if (!appImports.dynamic.includes(target)) fail(`App.tsx 必须动态导入 ${target}`);
  if (appImports.staticImports.includes(target)) fail(`App.tsx 不得静态导入 ${target}`);
}

const routerImports = importTargets('src/pages/PageRouter.tsx');
for (const target of [
  './AssetsPage', './AuctionPage', './ContractPage', './LeaderboardPage', './MarketPage',
  './OverviewPage', './ProductionPage', './GemShopPage', './SettingsPage',
]) {
  if (!routerImports.dynamic.includes(target)) fail(`PageRouter.tsx 必须动态导入 ${target}`);
  if (routerImports.staticImports.includes(target)) fail(`PageRouter.tsx 不得静态导入 ${target}`);
}

const viewModel = read('src/app/gameViewModel.ts');
if (/setInterval\s*\([^)]*1_?000/.test(viewModel) || /\bsetNow\b/.test(viewModel)) {
  fail('根游戏模型不得维护秒级 now 状态');
}
if (/\bworkRemaining\b/.test(viewModel)) fail('workRemaining 必须由局部页面计算');

for (const [path, pattern] of [
  ['src/pages/OverviewPage.tsx', /useNow\(game\.lastProcessedAt\)/],
  ['src/pages/ProductionPage.tsx', /useNow\(game\.lastProcessedAt\)/],
  ['src/pages/AuctionPage.tsx', /useNow\(model\.game\.lastProcessedAt\)/],
  ['src/pages/MarketPage.tsx', /const now = game\.lastProcessedAt/],
]) {
  if (!pattern.test(read(path))) fail(`${path} 必须以权威 lastProcessedAt 作为局部时间基准`);
}

const virtualWindow = read('src/hooks/useVirtualWindow.ts');
const virtualList = read('src/components/ui/VirtualList.tsx');
const virtualRecordTable = read('src/components/ui/VirtualRecordTable.tsx');
if (!/requestAnimationFrame\s*\(/.test(virtualWindow)) fail('共享窗口化内核必须使用 requestAnimationFrame 合并滚动更新');
if (!/findVisibleRange\s*\(/.test(virtualWindow)) fail('共享窗口化内核必须调用二分可视区间函数');
if (/while\s*\([^)]*(startIndex|endIndex)/.test(virtualWindow)) fail('共享窗口化内核不得在滚动渲染中线性扫描可视区间');
if (!virtualList.includes('useVirtualWindow')) fail('VirtualList 必须复用共享窗口化内核');
if (!virtualRecordTable.includes('useVirtualWindow')) fail('VirtualRecordTable 必须复用共享窗口化内核');

assert.deepEqual(findVisibleRange([], 0, 100), { startIndex: 0, endIndex: 0 });
const virtualItems = Array.from({ length: 10_000 }, (_, index) => ({ start: index * 20, size: 20 }));
assert.deepEqual(findVisibleRange(virtualItems, 100_000, 100), { startIndex: 4_999, endIndex: 5_005 });
assert.deepEqual(findVisibleRange(virtualItems, -1, 20), { startIndex: 0, endIndex: 1 });

for (const values of [
  [50.5, 49.5, 0],
  [1, 1, 1],
  [0, 0, 0],
  [Number.NaN, 25, 75],
]) {
  const allocation = buildAssetAllocation(...values);
  const sum = allocation.cashShare + allocation.commodityShare + allocation.facilityShare;
  if ((values.some((value) => Number.isFinite(value) && value > 0) && sum !== 100)
    || (values.every((value) => !Number.isFinite(value) || value <= 0) && sum !== 0)) {
    fail(`资产可见百分比合计错误: ${values.join('/')}`);
  }
  const gradient = String(allocation.allocationStyle.background || '');
  if (!gradient.startsWith('conic-gradient(') || !gradient.endsWith('360deg)')) {
    fail('资产圆环必须使用精确比例生成完整 360deg 渐变');
  }
}

const localActivity = read('src/utils/localActivityStore.ts');
for (const structure of [
  /documentCache\s*=\s*new Map/,
  /requestIdleCallback/,
  /addEventListener\(['"]pagehide['"]/,
  /function orderChanged\(/,
  /function listingChanged\(/,
]) {
  if (!structure.test(localActivity)) fail(`本地活动日志缺少结构: ${structure}`);
}
for (const functionName of ['orderChanged', 'listingChanged']) {
  const start = localActivity.indexOf(`function ${functionName}(`);
  const next = localActivity.indexOf('\nfunction ', start + 1);
  const body = localActivity.slice(start, next < 0 ? undefined : next);
  if (body.includes('JSON.stringify')) fail(`${functionName} 不得通过 JSON.stringify 比较整组数据`);
}

if (failures.length) {
  console.error(`运行时架构验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('运行时架构验证通过：页面动态拆包、局部时钟、虚拟列表二分与滚动合并、资产比例和本地日志缓存均已锁定。');
