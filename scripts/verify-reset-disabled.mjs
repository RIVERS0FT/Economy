import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const required = [
  'src/pages/SettingsPage.tsx',
  'src/api/game.ts',
  'src/app/gameViewModel.ts',
  'server/src/app.js',
  'server/src/storage.js',
  'server/src/domain-core.js',
  'server/src/facility-groups.js',
  'server/src/collectibles.js',
  'miniprogram/pages/index/index.js',
  'miniprogram/pages/index/index.ttml',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
];

for (const path of required) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

if (failures.length === 0) {
  const settings = read('src/pages/SettingsPage.tsx');
  const clientApi = read('src/api/game.ts');
  const viewModel = read('src/app/gameViewModel.ts');
  const serverApp = read('server/src/app.js');
  const serverSources = [
    read('server/src/storage.js'),
    read('server/src/domain-core.js'),
    read('server/src/facility-groups.js'),
    read('server/src/collectibles.js'),
  ].join('\n');
  const miniProgram = [
    read('miniprogram/pages/index/index.js'),
    read('miniprogram/pages/index/index.ttml'),
  ].join('\n');
  const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
  const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');

  for (const [name, content, forbidden] of [
    ['SettingsPage', settings, ['重置经济状态', 'settings-danger-zone', '危险区域', 'reset()']],
    ['客户端 API', clientApi, ["postAction('/reset')", 'reset: () =>']],
    ['客户端 ViewModel', viewModel, ['resetPlayer', 'reset: () => Promise<ActionResult>']],
    ['服务器领域代码', serverSources, ['resetPlayer', 'canResetCollectibles', 'resetFacilityGroups', '服务器经济状态已重置']],
    ['小程序', miniProgram, ['resetGame', '重置存档', 'bindtap="resetGame"']],
  ]) {
    for (const text of forbidden) {
      if (content.includes(text)) failures.push(`${name} 不得包含: ${text}`);
    }
  }

  if (!serverApp.includes("sendError(response, 410, '经济状态重置功能已永久移除')")) {
    failures.push('旧 /api/game/reset 必须固定返回 410 Gone');
  }
  if (serverApp.includes("return { action: 'resetPlayer'")) {
    failures.push('服务器不得把重置路径映射为领域动作');
  }
  if (!pageDesign.includes('不得提供经济状态重置、清空进度或重新开始入口')) {
    failures.push('页面设计缺少禁用重置规则');
  }
  if (!serverDesign.includes('兼容旧客户端固定返回 `410 Gone`')) {
    failures.push('服务器设计缺少退役接口规则');
  }
}

if (failures.length) {
  console.error(`经济状态重置禁用验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('经济状态重置已从网页、小程序、客户端动作和服务器领域写入中移除；旧接口仅返回 410。');
