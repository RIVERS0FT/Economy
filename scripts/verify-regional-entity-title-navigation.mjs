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
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

for (const path of [
  'src/components/ui/RegionalEntityPageTitle.tsx',
  'src/components/ui/PageNavigationContext.tsx',
  'src/navigation/playerPageStack.ts',
  'src/styles/regional-entity-page-title.css',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'tests/browser/regional-entity-title-navigation.spec.ts',
  'tests/browser/regional-entity-title-runtime-harness.tsx',
  'regional-entity-title-runtime-test.html',
]) requireFile(path);

for (const text of [
  "import { usePlayerPageNavigation } from './PageNavigationContext';",
  "currentLocation?.type === 'regional-product'",
  "currentLocation?.type === 'regional-commercial'",
  "currentLocation?.type === 'regional-facility'",
  'pageNavigation.pushPage({',
  "type: 'province',",
  'provinceId: regionalLocation.provinceId,',
  "section: 'overview',",
  'data-regional-entity-region-link="true"',
  'aria-label={`前往${regionName}地区页面`}',
]) requireText('src/components/ui/RegionalEntityPageTitle.tsx', text);
forbidText('src/components/ui/RegionalEntityPageTitle.tsx', 'aria-hidden="true"');

for (const text of [
  '.regional-entity-title__region-button {',
  'min-height: 13px;',
  'background: transparent;',
  'text-decoration: underline;',
  "html[data-input-modality='mouse'] .regional-entity-title__region-button:hover:not(:disabled)",
  '.regional-entity-title__region-button:focus-visible {',
]) requireText('src/styles/regional-entity-page-title.css', text);

for (const text of [
  '`RegionalEntityPageTitle` 固定负责地区商品／商业建筑／工厂详情共享两行标题',
  '第一行显示实体名称并使用大于地区行的主标题字号',
  '第二行显示州级地区全称',
  '`regional-product`、`regional-commercial` 或 `regional-facility`',
  '`RegionalEntityPageTitle` 的地区导航按钮',
  '固定 `40px` 标题轨道内的紧凑交互例外',
  '`province` + 当前 `provinceId` + `overview`',
  '把原商品／商业建筑／工厂详情保留在历史中以便返回',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

for (const text of [
  '地区商品／商业建筑／工厂详情标题第二行的州级地区名是直接地区导航入口',
  '`regional-product`／`regional-commercial`／`regional-facility`',
  "push `{ type: 'province', provinceId, section: 'overview' }`",
  '返回时必须恢复原商品／商业建筑／工厂详情',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  "for (const kind of ['product', 'commercial', 'facility'] as const)",
  "name: '前往加利福尼亚地区页面'",
  "'{\"type\":\"province\",\"provinceId\":\"US-CA\",\"section\":\"overview\"}'",
  'global commodity detail region title opens province overview and back restores detail',
]) requireText('tests/browser/regional-entity-title-navigation.spec.ts', text);
for (const text of [
  "requestedKind === 'facility' || requestedKind === 'commercial'",
  "type: 'regional-commercial'",
  "commercialTypeId: 'convenience-store'",
  "? '便利店'",
]) requireText('tests/browser/regional-entity-title-runtime-harness.tsx', text);

if (failures.length) {
  console.error(`地区实体标题导航验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('地区实体标题导航验证通过：商品、商业建筑与工厂详情共享两行地区标题与可点击地区名，统一通过受限页面栈 push 到对应地区概览并保留原详情返回路径，40px 标题轨道紧凑例外与浏览器回归均已锁定。');
