import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少客户端更新恢复规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 恢复了禁止的客户端更新行为: ${fragment}`);
  }
}

requireText('src/app/App.tsx', [
  "const adminAppModule = import('./AdminApp');",
  "const gameAppModule = import('./GameApp');",
  'lazy(() => adminAppModule.then',
  'lazy(() => gameAppModule.then',
  'onClick={() => window.location.reload()}>刷新页面</button>',
]);
requireText('src/api/auth.ts', [
  'CLIENT_NETWORK_ERROR',
  '无法连接服务器，客户端或服务器可能已经更新，请刷新页面后重试',
  'isBrowserNetworkError',
  'fetchApi',
]);
requireText('src/api/game.ts', [
  '无法连接服务器，客户端或服务器可能已经更新，请刷新页面后重试',
  'isBrowserNetworkError',
  'new GameApiError(0, NETWORK_ERROR_MESSAGE)',
]);
requireText('src/app/GameApp.tsx', [
  'onClick={() => window.location.reload()}>刷新页面</button>',
]);
forbidText('src/app/GameApp.tsx', [
  'onClick={viewModel.retry}>重新连接</button>',
]);

requireText('deploy/nginx/game.riversoft.top.economy-location.conf', [
  'expires 1y;',
  'add_header Cache-Control "public, max-age=31536000, immutable" always;',
  'add_header Cache-Control "no-cache, max-age=0, must-revalidate" always;',
]);
requireText('scripts/configure-economy-static-cache.py', [
  'STATIC_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable"',
  'STATIC_HTML_CACHE_CONTROL = "no-cache, max-age=0, must-revalidate"',
  'ECONOMY_STATIC_CACHE_VERIFIED',
  'systemctl", "reload", "nginx',
]);
requireText('.github/workflows/deploy.yml', [
  'scripts/configure-economy-static-cache.py',
  'dist/assets/ "$SERVER_USER@$SERVER_HOST:/var/www/game/economy/assets/"',
  '--exclude assets/',
  '--exclude index.html',
  'index.html.next',
  'mv -f /var/www/game/economy/index.html.next /var/www/game/economy/index.html',
  'find /var/www/game/economy/assets -type f -mtime +400 -delete',
]);
forbidText('.github/workflows/deploy.yml', [
  'rsync -az --delete-before -e "ssh -i ~/.ssh/deploy_key -p $SERVER_PORT" \\\n            dist/ "$SERVER_USER@$SERVER_HOST:/var/www/game/economy/"',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '客户端状态版本不兼容属于当前页面不可恢复错误',
  '浏览器原生 `Failed to fetch`',
  '哈希静态资源缓存固定为 365 天',
  '入口 HTML 固定使用 `no-cache, max-age=0, must-revalidate`',
  '旧哈希资源至少保留 400 天',
  '最后原子替换 `index.html`',
]);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('客户端版本更新、刷新恢复、缓存与原子发布规则验证通过。');
