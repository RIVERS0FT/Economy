import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const page = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const product = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const server = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const researchPage = read('src/pages/ResearchPage.tsx');

for (const forbidden of [
  '研发功能尚未开放',
  '研发玩法未开放前',
  '当前产业基础只读摘要、技术路线入口和研发未开放边界',
  '当前版本只读取已加载的 `EconomyState`',
]) {
  assert.equal(page.includes(forbidden), false, `页面权威文档不得保留废弃研发规则：${forbidden}`);
}
for (const required of [
  'C1-C7 顺序研发、复杂度准入、研发倒计时和就业资金释放',
  '读取服务器权威的 C1-C7 研发目录和玩家研发状态',
  '十个一级导航始终可访问',
]) assert.ok(page.includes(required), `页面权威文档缺少当前规则：${required}`);
for (const required of ['C1-C7 产业研发', '同时只能研发一级', '开始后不可取消']) {
  assert.ok(product.includes(required), `产品权威文档缺少研发规则：${required}`);
}
for (const required of ['research.js', 'C1-C7 顺序研发', '复杂度准入']) {
  assert.ok(server.includes(required), `服务器权威文档缺少研发规则：${required}`);
}
assert.ok(researchPage.includes('开始研发'));
assert.equal(researchPage.includes('研发功能尚未开放'), false);


assert.ok(existsSync('src/components/onboarding/AdvancedFeatureGuide.tsx'), '缺少高级页面共享渐进说明组件');
const advancedGuide = read('src/components/onboarding/AdvancedFeatureGuide.tsx');
for (const required of ['completedFoundationLoop', '当前页面仍可正常操作', 'PagePanel']) {
  assert.ok(advancedGuide.includes(required), `高级功能说明组件缺少：${required}`);
}
for (const pagePath of ['src/pages/ResearchPage.tsx', 'src/pages/BankPage.tsx', 'src/pages/ContractPage.tsx', 'src/pages/AuctionPage.tsx']) {
  assert.ok(read(pagePath).includes('<AdvancedFeatureGuide'), `${pagePath} 必须使用共享高级功能说明`);
}
assert.ok(read('docs/UI_DESIGN_SYSTEM.md').includes('高级页面渐进说明固定使用共享 `AdvancedFeatureGuide`'));

const navigation = '概览｜市场｜生产｜研发｜拍卖｜合同｜银行｜排行｜商店｜设置';
assert.ok(page.includes(navigation), '正式十页导航顺序必须唯一且完整');
console.log('文档一致性验证通过：研发开放状态、十页导航与实现保持一致。');
