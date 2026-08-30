import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyLocalGamePreviewFixture } from './generate-local-game-preview.mjs';

const read = (path) => readFileSync(path, 'utf8');

try {
  verifyLocalGamePreviewFixture();
  assert.equal(read('scripts/generate-local-game-preview.mjs').includes('previewPlayer.work'), false, '免登录预览不得恢复已退役工作状态');

  const gameShell = read('src/components/shell/GameShell.tsx');
  assert.ok(
    gameShell.includes('!offline && game.startingProvinceChosen === false'),
    '免登录完整游戏预览不得被一次性起始州选择写流程拦截，旧兼容快照也只能在明确 false 时显示选择门禁',
  );

  const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
  for (const text of [
    'all-pages-preview.html',
    '必须复用正式 `GameShell`、`PageRouter`、十一项可见导航和上述十二个正式 React 页面',
    '所有 `/economy-api` 写请求必须在浏览器本地拦截且不得到达服务器',
  ]) {
    assert.ok(pageDesign.includes(text), `免登录完整游戏预览权威设计缺少: ${text}`);
  }

  console.log('Local no-login game preview verification passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
