import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { throw new Error(message); };
const requireText = (file, text) => {
  if (!read(file).includes(text)) fail(`${file} 缺少导航角标规则：${text}`);
};
const forbidText = (file, text) => {
  if (read(file).includes(text)) fail(`${file} 仍包含已删除的市场专用角标实现：${text}`);
};

requireText('src/navigation/navigationBadges.ts', 'export const MAX_NAVIGATION_BADGE_COUNT = 99;');
requireText('src/navigation/navigationBadges.ts', 'new Set([...unreadAuctionIds, ...outbidAuctionIds])');
requireText('src/navigation/navigationBadges.ts', 'new Set([...unreadContractIds, ...attentionContractIds])');
requireText('src/navigation/navigationBadges.ts', "count: 1,\n      accessibleLabel: '1 次新的排行榜结算结果'");
requireText('src/navigation/navigationBadgeReadState.ts', 'economy:navigation-badges:v1:');
requireText('src/components/ui/NavigationBadge.tsx', 'className="navigation-badge"');
requireText('src/components/shell/GameShell.tsx', 'const navigationBadges = useNavigationBadges(model);');
requireText('src/components/shell/NavigationItems.tsx', 'badges: NavigationBadgeMap;');
requireText('src/styles/globals.css', '.navigation-badge {');
requireText('src/styles/desktop-sidebar.css', '.desktop-sidebar .navigation-badge');
requireText('src/styles/mobile-status-navigation.css', '.mobile-bottom-navigation .navigation-badge');
requireText('docs/UI_DESIGN_SYSTEM.md', '统一导航数字角标');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '一个页面最多显示一个绿色数字角标');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '拍卖角标按拍卖 ID 对“新拍卖”和“被超价拍卖”求并集');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '合同角标按合同 ID 对“新合同”和“需要处理合同”求并集');

for (const file of [
  'src/components/shell/NavigationItems.tsx',
  'src/components/shell/DesktopSidebar.tsx',
  'src/components/shell/MobileBottomNavigation.tsx',
  'src/components/shell/GameShell.tsx',
]) {
  forbidText(file, 'openOrderCount');
}
forbidText('src/components/shell/NavigationItems.tsx', "id === 'market'");

const sourceFiles = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (/\.(?:ts|tsx|css)$/.test(entry.name)) sourceFiles.push(target);
  }
};
visit(path.join(root, 'src'));
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('sidebar-nav-count')) fail(`${path.relative(root, file)} 仍包含旧角标类名 sidebar-nav-count`);
}

const packageJson = JSON.parse(read('package.json'));
if (packageJson.scripts?.['verify:navigation-badges'] !== 'node scripts/verify-navigation-badges.mjs') {
  fail('package.json 缺少 verify:navigation-badges');
}
if (!packageJson.scripts?.['verify:architecture']?.includes('verify-navigation-badges.mjs')) {
  fail('verify:architecture 未纳入导航角标防回退');
}

console.log('navigation badge verification passed');
