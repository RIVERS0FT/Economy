import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function requireText(path, fragments) {
  if (!existsSync(resolve(root, path))) {
    failures.push(`缺少文件: ${path}`);
    return;
  }
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少头像规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  if (!existsSync(resolve(root, path))) {
    failures.push(`缺少文件: ${path}`);
    return;
  }
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 不应包含头像规则: ${fragment}`);
  }
}

requireText('src/utils/playerAvatar.ts', [
  'PLAYER_AVATAR_SIZE = 64',
  'PLAYER_AVATAR_MAX_UPLOAD_BYTES = 8 * 1024',
  'canvas.toBlob',
  "'image/webp'",
  'sourceSize = Math.min',
]);
requireText('src/components/ui/PlayerAvatar.tsx', [
  'playerAvatarUrl(userId)',
  'PLAYER_AVATAR_UPDATED_EVENT',
  'onError={() => setFailed(true)}',
]);
requireText('src/styles/player-avatar.css', [
  'width: var(--player-avatar-size);',
  'height: var(--player-avatar-size);',
  'flex: 0 0 auto;',
  'aspect-ratio: 1 / 1;',
  'border-radius: 50%;',
]);
forbidText('src/styles/player-avatar.css', [
  'min-width: var(--player-avatar-size);',
]);
requireText('src/pages/SettingsPage.tsx', [
  '<PlayerAvatar',
  '<FileInput',
  'preparePlayerAvatar(file)',
  'updatePlayerAvatar(avatarData)',
  '64×64 WebP',
]);
requireText('src/components/shell/StatusBar.tsx', [
  '<PlayerAvatar',
  'identity.onClick',
  '打开设置',
]);
requireText('src/components/shell/GameShell.tsx', [
  'playerId: model.user.id',
  "onClick: () => selectPlayerTab('settings')",
]);
requireText('src/pages/LeaderboardPage.tsx', [
  "import { PlayerAvatar } from '../components/ui/PlayerAvatar';",
  '<PlayerAvatar userId={userId} playerName={entry.playerName} size={28} className="leaderboard-avatar" />',
  'leaderboardUserId(entry.userId)',
]);
requireText('src/leaderboardTypes.ts', [
  'userId?: number;',
]);
requireText('server/src/leaderboards.js', [
  'userId: Number(entry.userId),',
]);
requireText('server/src/player-profile.js', [
  'PLAYER_AVATAR_SIZE = 64',
  'PLAYER_AVATAR_MAX_BYTES = 8 * 1024',
  'process.env.ECONOMY_AVATAR_DIR',
  'validatePlayerAvatarData',
  'writePlayerAvatar',
]);
requireText('server/src/runtime-action-executor.js', [
  "import { applyPlayerProfileAction } from './player-profile.js';",
  "action === 'renamePlayer'",
  'applyPlayerProfileAction(world, user, payload)',
]);
requireText('scripts/install-economy-api.py', [
  'AVATAR_DIRECTORY = Path("/var/lib/riversoft-economy-avatars")',
  'Environment=ECONOMY_AVATAR_DIR={AVATAR_DIRECTORY}',
  'ReadWritePaths={STATE_DIRECTORY} {AVATAR_DIRECTORY}',
]);
requireText('deploy/nginx/game.riversoft.top.economy-location.conf', [
  'location ~ "^/economy-avatars/(?<avatar_id>[1-9][0-9]{0,15})\\.webp$" {',
  'alias /var/lib/riversoft-economy-avatars/$avatar_id.webp;',
  'image/webp',
]);
requireText('docs/UI_DESIGN_SYSTEM.md', [
  '状态栏左侧玩家头像',
  '排行榜玩家列固定复用 `PlayerAvatar`',
  '必须始终保持 `1:1` 正方形',
  '64×64 WebP',
  '状态栏、设置页和排行榜不得各自实现第二套头像加载逻辑',
]);
requireText('docs/UI_DESIGN_SYSTEM.md', [
  '`PlayerAvatar`',
  '`CompactNumber`',
  '完整数字 Tooltip',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '/var/lib/riversoft-economy-avatars',
  '64×64 WebP',
  '8 KiB',
]);

if (failures.length) {
  console.error(`玩家头像验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('玩家头像验证通过：状态栏、设置页与排行榜复用 PlayerAvatar，头像盒保持 1:1，浏览器仅上传 64×64 WebP 缩略图并由服务器独立存储。');
