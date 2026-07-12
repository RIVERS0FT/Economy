import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push('缺少文件: ' + path); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(path + ' 缺少: ' + text); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(path + ' 不应包含: ' + text); };
[
  'src/pages/MarketPage.tsx','src/pages/ProductionPage.tsx','src/pages/SettingsPage.tsx','src/app/AdminApp.tsx',
  'src/api/admin.ts','src/styles/unified-market-admin.css','server/src/facility-groups.js','server/src/storage.js',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md','docs/GIFT_CODE_AND_ADMIN_DESIGN.md'
].forEach(requireFile);
for (const text of ['unified-asset-tabs','placeAssetOrder','single-order-book','order-book-divider','localTrades.map']) requireText('src/pages/MarketPage.tsx', text);
for (const text of ['market-stat-strip','工厂数量市场','仅保存在当前浏览器；更换设备或清除网站数据后不会恢复。']) forbidText('src/pages/MarketPage.tsx', text);
for (const text of ['facility-power-button','卖单冻结','前往市场交易该工厂']) requireText('src/pages/ProductionPage.tsx', text);
for (const text of ['产成品去向','挂牌数量','单座价格','启动全部未挂牌工厂','停止全部']) forbidText('src/pages/ProductionPage.tsx', text);
for (const text of ['点击工作次数','生产商品总数','买入商品总数','卖出商品总数','礼品兑换','退出登录','重置经济状态']) requireText('src/pages/SettingsPage.tsx', text);
for (const text of ['登录会话','重置服务器经济状态']) forbidText('src/pages/SettingsPage.tsx', text);
for (const text of ["label: '仓库剩余'", "id: 'warehouse'"]) requireText('src/app/GameApp.tsx', text);
for (const text of ["id: 'inventory'", "id: 'market'"]) forbidText('src/app/GameApp.tsx', text);
for (const text of ['assetKind','matchFacilityOrder','reduceRunningGroupForSellOrder','valuationPricesFor','bestBidFor','world.version = 5']) requireText('server/src/facility-groups.js', text);
for (const text of ['workCooldownMs: 10_000','workClicks','boughtGoods','soldGoods']) requireText('server/src/domain.js', text);
for (const text of ['economy_gift_codes','economy_gift_redemptions','requireAdmin','getAdminSummary']) requireText('server/src/storage.js', text);
if (failures.length) { console.error('统一资产市场与管理功能验证失败:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('统一资产市场、10 秒工作冷却、玩家统计、礼品兑换和管理员页面验证通过。');

const productionPage = read('src/pages/ProductionPage.tsx');
const sharedLayout = read('src/components/ui/layout.tsx');
const designSystem = read('src/styles/design-system.css');
const businessStyles = read('src/styles/unified-market-admin.css');
for (const text of ['export function SwitchControl', "classNames('ui-switch'", '<SwitchControl']) {
  if (!(sharedLayout + productionPage).includes(text)) throw new Error(`Missing shared switch contract: ${text}`);
}
for (const forbidden of ['facility-power-button', 'factory-switch', 'music-switch', 'production-toggle']) {
  if ((productionPage + businessStyles).includes(forbidden)) throw new Error(`Business-specific switch style returned: ${forbidden}`);
}
if ((designSystem.match(/\.ui-switch \{/g) || []).length !== 1) throw new Error('ui-switch must have one visual authority');
console.log('Facility switch architecture verified.');
