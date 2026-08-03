import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const file = (path) => resolve(root, path);

function read(path) {
  return readFileSync(file(path), 'utf8');
}

function write(path, content) {
  writeFileSync(file(path), content, 'utf8');
}

function replace(path, from, to) {
  const source = read(path);
  if (!source.includes(from)) {
    throw new Error(`${path} 缺少待替换内容：${from.slice(0, 120)}`);
  }
  write(path, source.replace(from, to));
}

replace(
  'src/config/navigation.ts',
  "  { id: 'production', label: '生产' },\n  { id: 'auction', label: '拍卖' },",
  "  { id: 'production', label: '生产' },\n  { id: 'research', label: '研发' },\n  { id: 'auction', label: '拍卖' },",
);

replace(
  'src/components/icons/GameIcons.tsx',
  "export type NavigationIconName = 'home' | 'market' | 'production' | 'auction' | 'contracts' | 'bank' | 'leaderboard' | 'gem-shop' | 'settings';",
  "export type NavigationIconName = 'home' | 'market' | 'production' | 'research' | 'auction' | 'contracts' | 'bank' | 'leaderboard' | 'gem-shop' | 'settings';",
);
replace(
  'src/components/icons/GameIcons.tsx',
  "export function FactoryIcon(props: GameIconProps) {",
  "export function ResearchIcon(props: GameIconProps) {\n  return (\n    <GameIcon {...props}>\n      <path d=\"M9 3h6M10 3v5.2L5.7 16a3.3 3.3 0 0 0 2.9 5h6.8a3.3 3.3 0 0 0 2.9-5L14 8.2V3\" />\n      <path d=\"M7.5 15h9M9.2 12h5.6\" />\n      <circle cx=\"9.2\" cy=\"17.8\" r=\".6\" fill=\"currentColor\" stroke=\"none\" />\n      <circle cx=\"14.8\" cy=\"18.2\" r=\".6\" fill=\"currentColor\" stroke=\"none\" />\n    </GameIcon>\n  );\n}\n\nexport function FactoryIcon(props: GameIconProps) {",
);
replace(
  'src/components/icons/GameIcons.tsx',
  "    case 'production': return <ProductionIcon {...props} />;\n    case 'auction': return <AuctionIcon {...props} />;",
  "    case 'production': return <ProductionIcon {...props} />;\n    case 'research': return <ResearchIcon {...props} />;\n    case 'auction': return <AuctionIcon {...props} />;",
);

replace(
  'src/pages/PageRouter.tsx',
  "const ProductionPage = lazy(() => import('./ProductionPage').then((module) => ({ default: module.ProductionPage })));\nconst GemShopPage",
  "const ProductionPage = lazy(() => import('./ProductionPage').then((module) => ({ default: module.ProductionPage })));\nconst ResearchPage = lazy(() => import('./ResearchPage').then((module) => ({ default: module.ResearchPage })));\nconst GemShopPage",
);
replace(
  'src/pages/PageRouter.tsx',
  "        </FacilityRecipeProfitMarketsProvider>\n      );\n      break;\n    case 'auction':",
  "        </FacilityRecipeProfitMarketsProvider>\n      );\n      break;\n    case 'research':\n      page = <ResearchPage model={model} />;\n      break;\n    case 'auction':",
);

write('src/pages/ResearchPage.tsx', `import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import {
  DataList,
  DataRow,
  EmptyState,
  PageLayout,
  PagePanel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { formatNumber } from '../utils/formatters';

export function ResearchPage({ model }: { model: TutorialAwareGameViewModel }) {
  const ownedGroups = model.game.facilityGroups.filter((group) => group.count > 0);
  const ownedFacilities = ownedGroups.reduce((sum, group) => sum + group.count, 0);
  const runningFacilities = ownedGroups.reduce((sum, group) => (
    sum + (group.status === 'running' ? group.participatingCount : 0)
  ), 0);
  const blockedGroups = ownedGroups.filter((group) => group.status === 'error').length;

  return (
    <PageLayout title="研发" description="查看当前产业基础与未来技术路线；研发玩法尚未开放。">
      <PagePanel className="research-baseline-card">
        <WidgetHeading title="当前产业基础" action={<StatusTag tone="neutral">只读</StatusTag>} />
        <DataList>
          <DataRow label="已拥有工厂" value={formatNumber(ownedFacilities)} />
          <DataRow label="已布局工厂类型" value={formatNumber(ownedGroups.length)} />
          <DataRow label="当前参与生产" value={formatNumber(runningFacilities)} />
          <DataRow
            label="异常工厂集群"
            value={formatNumber(blockedGroups)}
            tone={blockedGroups > 0 ? 'danger' : 'success'}
          />
        </DataList>
      </PagePanel>

      <PagePanel className="research-roadmap-card">
        <WidgetHeading title="技术路线" action={<StatusTag tone="info">规划中</StatusTag>} />
        <p>研发页面是生产页右侧的独立一级入口，后续承载技术路线与产业升级，不与生产配方、作业制度或工厂启停混用。</p>
        <EmptyState>
          <strong>研发功能尚未开放</strong>
          <p>当前版本不扣除资金或宝石，不生成研发进度，也不改变工厂产量、周期、成本、配方或仓库容量。</p>
        </EmptyState>
      </PagePanel>
    </PageLayout>
  );
}
`);

replace(
  'docs/README.md',
  '> 更新时间：2026-08-02',
  '> 更新时间：2026-08-03',
);
replace(
  'docs/README.md',
  '| `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` | 九个正式页面、银行资产总览与存贷款、商品／工厂资产拍卖、排行榜生产数量纯数字显示、统一导航角标语义与已读规则、进行中的合同默认视图、可审计合同历史、登录注册入口、独立商店、分享链接、邀请码、封禁提示、模块唯一归属和页面防回退规则 |',
  '| `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` | 十个正式页面、研发只读入口与技术路线边界、银行资产总览与存贷款、商品／工厂资产拍卖、排行榜生产数量纯数字显示、统一导航角标语义与已读规则、进行中的合同默认视图、可审计合同历史、登录注册入口、独立商店、分享链接、邀请码、封禁提示、模块唯一归属和页面防回退规则 |',
);

replace(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '概览｜市场｜生产｜拍卖｜合同｜银行｜排行｜商店｜设置',
  '概览｜市场｜生产｜研发｜拍卖｜合同｜银行｜排行｜商店｜设置',
);
replace(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '| 生产 | `production` | `ProductionPage` | 仓库、建设、工厂集群，以及玩家可见“生产产物／作业制度”配置 |\n| 拍卖 |',
  '| 生产 | `production` | `ProductionPage` | 仓库、建设、工厂集群，以及玩家可见“生产产物／作业制度”配置 |\n| 研发 | `research` | `ResearchPage` | 当前产业基础只读摘要、技术路线入口和研发未开放边界 |\n| 拍卖 |',
);
replace(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '艺术资产页面及相关玩法已经永久移除。玩家导航固定为九项；客户端不得保留 `collections` 兼容路由，旧书签回到默认概览，不创建空壳页面或重定向分支。',
  '艺术资产页面及相关玩法已经永久移除。玩家导航固定为十项；客户端不得保留 `collections` 兼容路由，旧书签回到默认概览，不创建空壳页面或重定向分支。\n\n研发页是生产右侧的独立一级页面，只读取现有游戏状态，展示当前产业基础和技术路线边界。研发玩法未开放前不得扣除普通货币或宝石，不得生成研发进度，不得修改工厂产量、周期、成本、配方、作业制度、仓库容量或其他服务器权威状态；后续引入实际研发机制时必须先在产品、产业、页面和服务器权威文档中定义，再同步状态版本、接口、测试和防回退。',
);
replace(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '概览、银行、商店和设置暂不显示角标但保留统一 `TabId` 映射能力。',
  '概览、研发、银行、商店和设置暂不显示角标但保留统一 `TabId` 映射能力。',
);
replace(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '移动底部导航允许横向滚动，九个页面不得通过隐藏导航项、缩写中文名称或创建二级菜单规避空间限制。',
  '移动底部导航允许横向滚动，十个页面不得通过隐藏导航项、缩写中文名称或创建二级菜单规避空间限制。',
);
replace(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '管理员入口、游戏入口和九个页面按需拆包；',
  '管理员入口、游戏入口和十个页面按需拆包；',
);
replace(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '| 建设、周期、农场改种、启停和工厂状态 | 生产 |\n| 资产组成、存贷款、利息、抵押、还款与权威银行记录 | 银行 |',
  '| 建设、周期、农场改种、启停和工厂状态 | 生产 |\n| 技术路线入口、产业基础只读摘要和研发未开放边界 | 研发 |\n| 资产组成、存贷款、利息、抵押、还款与权威银行记录 | 银行 |',
);
replace(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '- 把仓库扩容移出生产页；',
  '- 把仓库扩容移出生产页；\n- 把研发入口移回生产页、让研发页执行尚未定义的服务器写操作，或在研发机制未设计前显示虚构的研发点、成本、进度和加成；',
);

replace(
  'docs/UI_DESIGN_SYSTEM.md',
  '管理员入口、游戏入口和九个游戏页面必须使用 `React.lazy` 与动态 `import()` 按需加载；',
  '管理员入口、游戏入口和十个游戏页面必须使用 `React.lazy` 与动态 `import()` 按需加载；',
);
replace(
  'docs/UI_DESIGN_SYSTEM.md',
  '玩家九个正式页面和管理员分区必须使用共享 `PageLayout`；',
  '玩家十个正式页面和管理员分区必须使用共享 `PageLayout`；',
);
replace(
  'docs/UI_DESIGN_SYSTEM.md',
  '不得把九个导航按钮平均拉伸到整列高度。',
  '不得把十个导航按钮平均拉伸到整列高度。',
);
replace(
  'docs/UI_DESIGN_SYSTEM.md',
  '概览、资产、商店和设置暂不显示但必须保留统一映射能力。',
  '概览、研发、银行、商店和设置暂不显示但必须保留统一映射能力。',
);
replace(
  'docs/UI_DESIGN_SYSTEM.md',
  '或把九个导航按钮平均分散到整个侧栏高度；',
  '或把十个导航按钮平均分散到整个侧栏高度；',
);

write('scripts/verify-research-page.mjs', `import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(\`缺少文件: \${path}\`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(\`\${path} 缺少: \${text}\`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(\`\${path} 不应包含: \${text}\`);
};

for (const path of [
  'src/config/navigation.ts',
  'src/components/icons/GameIcons.tsx',
  'src/pages/PageRouter.tsx',
  'src/pages/ResearchPage.tsx',
  'docs/README.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
]) requireFile(path);

requireText(
  'src/config/navigation.ts',
  "{ id: 'production', label: '生产' },\\n  { id: 'research', label: '研发' },\\n  { id: 'auction', label: '拍卖' },",
);
for (const text of [
  "const ResearchPage = lazy(() => import('./ResearchPage')",
  "case 'research':",
  '<ResearchPage model={model} />',
]) requireText('src/pages/PageRouter.tsx', text);
for (const text of [
  "'production' | 'research' | 'auction'",
  'export function ResearchIcon',
  "case 'research': return <ResearchIcon",
]) requireText('src/components/icons/GameIcons.tsx', text);
for (const text of [
  'title="研发"',
  '当前产业基础',
  '技术路线',
  '研发功能尚未开放',
  '不扣除资金或宝石',
  '<PagePanel',
  '<DataList>',
  '<EmptyState>',
]) requireText('src/pages/ResearchPage.tsx', text);
for (const text of ['gameActions', 'showResult(', '<Button']) {
  forbidText('src/pages/ResearchPage.tsx', text);
}
for (const text of [
  '概览｜市场｜生产｜研发｜拍卖｜合同｜银行｜排行｜商店｜设置',
  '| 研发 | `research` | `ResearchPage` | 当前产业基础只读摘要、技术路线入口和研发未开放边界 |',
  '玩家导航固定为十项',
  '研发玩法未开放前不得扣除普通货币或宝石',
  '概览、研发、银行、商店和设置暂不显示角标',
  '技术路线入口、产业基础只读摘要和研发未开放边界 | 研发',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
requireText('docs/README.md', '十个正式页面、研发只读入口与技术路线边界');
for (const text of [
  '十个游戏页面必须使用 `React.lazy`',
  '玩家十个正式页面和管理员分区必须使用共享 `PageLayout`',
  '十个导航按钮',
  '概览、研发、银行、商店和设置暂不显示',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

if (failures.length) {
  console.error(\`研发页面与导航防回退验证失败:\\n- \${failures.join('\\n- ')}\`);
  process.exit(1);
}

console.log('研发页面、导航顺序、只读边界与设计文档验证通过。');
`);

replace(
  'package.json',
  'node scripts/verify-page-content.mjs && node scripts/verify-auth-three-layer.mjs',
  'node scripts/verify-page-content.mjs && node scripts/verify-research-page.mjs && node scripts/verify-auth-three-layer.mjs',
);

for (const cleanupPath of [
  'scripts/apply-research-page.mjs',
  '.github/workflows/apply-research-page.yml',
]) {
  if (existsSync(file(cleanupPath))) rmSync(file(cleanupPath));
}
