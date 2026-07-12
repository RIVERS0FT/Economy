import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

[
  'src/pages/MarketPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/app/GameApp.tsx',
  'src/app/AdminApp.tsx',
].forEach(requireFile);

for (const text of [
  'unified-asset-tabs',
  'placeAssetOrder',
  'single-order-book',
  'order-book-divider',
  'localTrades.map',
]) requireText('src/pages/MarketPage.tsx', text);

for (const text of [
  'market-stat-strip',
  '工厂数量市场',
  '仅保存在当前浏览器；更换设备或清除网站数据后不会恢复。',
]) forbidText('src/pages/MarketPage.tsx', text);

for (const text of [
  'SwitchControl',
  'checked={group.enabled}',
  '>运行 {model.derived.runningFacilities}',
  '>停止 {model.derived.stoppedFacilities}',
  '>异常 {model.derived.blockedFacilities}',
  '条件满足后将自动恢复生产',
  '下一周期生效',
  '前往市场交易该工厂',
]) requireText('src/pages/ProductionPage.tsx', text);

for (const text of [
  'facility-power-button',
  '产成品去向',
  '启动全部未挂牌工厂',
  '停止全部',
]) forbidText('src/pages/ProductionPage.tsx', text);

for (const text of [
  '点击工作次数',
  '生产商品总数',
  '买入商品总数',
  '卖出商品总数',
  '礼品兑换',
  '退出登录',
  '重置经济状态',
]) requireText('src/pages/SettingsPage.tsx', text);

for (const text of ['登录会话', '重置服务器经济状态']) forbidText('src/pages/SettingsPage.tsx', text);
for (const text of ["label: '仓库剩余'", "id: 'warehouse'"]) requireText('src/app/GameApp.tsx', text);
for (const text of ["id: 'inventory'", "id: 'market'"]) forbidText('src/app/GameApp.tsx', text);

if (failures.length) {
  console.error(`页面内容与职责验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('页面内容、工厂三态和统一开关职责验证通过。');
