import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};

const sourceExtensions = new Set(['.ts', '.tsx', '.css']);
const sourceFiles = [];
function collectSourceFiles(directory) {
  for (const entry of readdirSync(resolve(root, directory))) {
    const relativePath = `${directory}/${entry}`;
    const absolutePath = resolve(root, relativePath);
    if (statSync(absolutePath).isDirectory()) collectSourceFiles(relativePath);
    else if (sourceExtensions.has(extname(entry))) sourceFiles.push(relativePath);
  }
}

const componentPath = 'src/components/ui/CurrencyAmount.tsx';
const iconPath = 'src/components/icons/GameIcons.tsx';
const stylePath = 'src/styles/icon-system.css';
const designPath = 'docs/UI_DESIGN_SYSTEM.md';
const usagePaths = [
  'src/app/GameApp.tsx',
  'src/components/shell/GameShell.tsx',
  'src/pages/OverviewPage.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/pages/LeaderboardPage.tsx',
  'src/pages/AuctionPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/components/warehouse/WarehouseUpgradeCard.tsx',
  'src/app/AdminApp.tsx',
];

[componentPath, iconPath, stylePath, designPath, ...usagePaths].forEach(requireFile);

for (const text of [
  'export function CurrencyAmount',
  'export function CurrencyText',
  '<CreditsIcon className="currency-amount__icon" />',
  "children.split('\\u00a4')",
]) requireText(componentPath, text);

for (const text of [
  'export function CreditsIcon',
  'viewBox="0 0 24 24"',
  'stroke="currentColor"',
]) requireText(iconPath, text);

for (const text of [
  '.currency-amount {',
  '.currency-amount__icon,',
  '.currency-inline-icon {',
  'width: 1em;',
  'height: 1em;',
]) requireText(stylePath, text);

for (const path of usagePaths) {
  const content = read(path);
  if (!content.includes('CurrencyAmount') && !content.includes('CurrencyText')) {
    failures.push(`${path} 未使用统一货币 SVG 组件`);
  }
}
for (const path of [
  'src/app/GameApp.tsx',
  'src/components/shell/GameShell.tsx',
  'src/app/AdminApp.tsx',
]) requireText(path, 'CurrencyText');

for (const text of [
  '`CurrencyAmount` 是玩家端和管理员端可见货币金额的唯一组合组件',
  '所有玩家端和管理员端可见货币金额必须使用 `CurrencyAmount` 与 `CreditsIcon`',
  '玩家界面不得直接显示',
  '服务器消息中的遗留字符必须在通知边界通过 `CurrencyText` 转换为 `CreditsIcon`',
  '在玩家端或管理员端恢复字符货币符号',
]) requireText(designPath, text);

collectSourceFiles('src');
const forbiddenCurrencyCharacters = ['\u00a4', '\u00a5', '\uffe5', '\u20ac', '\u00a3'];
for (const path of sourceFiles) {
  const content = read(path);
  for (const character of forbiddenCurrencyCharacters) {
    if (content.includes(character)) failures.push(`${path} 不得直接包含字符货币符号 U+${character.codePointAt(0).toString(16).toUpperCase()}`);
  }
}

const currencyAmountUsageCount = usagePaths.reduce((total, path) => (
  total + (read(path).match(/<CurrencyAmount\b/g)?.length ?? 0)
), 0);
if (currencyAmountUsageCount < 30) {
  failures.push(`统一 CurrencyAmount 使用数量异常，仅发现 ${currencyAmountUsageCount} 处`);
}

if (failures.length > 0) {
  console.error(`货币 SVG 统一验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`货币 SVG 验证通过：${currencyAmountUsageCount} 处可见金额统一使用 CreditsIcon，通知边界兼容旧字符串，玩家端源码无字符货币符号。`);
