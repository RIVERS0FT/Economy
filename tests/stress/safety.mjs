export const STRESS_PROFILES = Object.freeze({
  smoke: Object.freeze({ writes: false, defaultUsers: 4, defaultDurationSeconds: 5, defaultPollIntervalMs: 500 }),
  poll: Object.freeze({ writes: false, defaultUsers: 24, defaultDurationSeconds: 300, defaultPollIntervalMs: 5_000 }),
  burst: Object.freeze({ writes: false, defaultUsers: 24, defaultDurationSeconds: 60, defaultPollIntervalMs: 100 }),
  mixed: Object.freeze({ writes: true, defaultUsers: 24, defaultDurationSeconds: 300, defaultPollIntervalMs: 1_000 }),
  soak: Object.freeze({ writes: true, defaultUsers: 24, defaultDurationSeconds: 1_800, defaultPollIntervalMs: 5_000 }),
});

const PRODUCTION_ORIGIN = 'https://game.riversoft.top';
const PRODUCTION_CONFIRMATION = 'ECONOMY_PRODUCTION_READ_ONLY';

function parsedOrigin(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} 不是有效 URL`);
  }
  if (url.username || url.password || url.search || url.hash) throw new Error(`${label} 不得包含凭据、查询或片段`);
  return url;
}

function isLoopback(url) {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname);
}

export function validateStressSafety({
  targetMode,
  profile,
  users,
  durationSeconds,
  pollIntervalMs,
  authUrl,
  gameBaseUrl,
  confirmation = '',
}) {
  const definition = STRESS_PROFILES[profile];
  if (!definition) throw new Error(`未知压力测试场景 ${profile}`);
  if (!['local', 'staging', 'production-readonly'].includes(targetMode)) throw new Error(`未知压力测试目标 ${targetMode}`);
  if (!Number.isInteger(users) || users < 1 || users > 24) throw new Error('压力测试用户数必须为 1～24');
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 3_600) {
    throw new Error('压力测试持续时间必须为 1～3600 秒');
  }
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 100 || pollIntervalMs > 60_000) {
    throw new Error('压力测试轮询间隔必须为 100～60000 毫秒');
  }

  const auth = parsedOrigin(authUrl, '认证地址');
  const game = parsedOrigin(gameBaseUrl, '游戏 API 地址');
  if (targetMode === 'local') {
    if (!isLoopback(auth) || !isLoopback(game)) throw new Error('本地隔离压力测试只能访问回环地址');
  }
  if (targetMode === 'staging') {
    if (auth.origin === PRODUCTION_ORIGIN || game.origin === PRODUCTION_ORIGIN) {
      throw new Error('staging 模式不得指向生产域名');
    }
    if (!isLoopback(auth) && auth.protocol !== 'https:') throw new Error('远程 staging 认证必须使用 HTTPS');
    if (!isLoopback(game) && game.protocol !== 'https:') throw new Error('远程 staging 游戏 API 必须使用 HTTPS');
  }
  if (targetMode === 'production-readonly') {
    if (definition.writes) throw new Error('生产只读压力测试禁止写入场景');
    if (!['smoke', 'poll'].includes(profile)) throw new Error('生产环境只允许 smoke 或 poll 场景');
    if (auth.origin !== PRODUCTION_ORIGIN || game.origin !== PRODUCTION_ORIGIN) {
      throw new Error('生产只读模式必须固定指向 game.riversoft.top');
    }
    if (confirmation !== PRODUCTION_CONFIRMATION) throw new Error(`生产只读模式需要确认词 ${PRODUCTION_CONFIRMATION}`);
    if (pollIntervalMs < 3_000) throw new Error('生产只读模式轮询间隔不得低于 3000 毫秒');
    if (durationSeconds > 300) throw new Error('生产只读模式单次不得超过 300 秒');
  }
  return definition;
}
