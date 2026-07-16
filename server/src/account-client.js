import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const DEFAULT_ACCOUNT_SERVICE_URL = 'http://127.0.0.1:3001';

function accountError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

function requestAccount(path, body) {
  const base = process.env.ACCOUNT_SERVICE_URL || DEFAULT_ACCOUNT_SERVICE_URL;
  const target = new URL(path, base.endsWith('/') ? base : `${base}/`);
  const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const upstream = transport(target, {
      method: 'POST',
      timeout: 8_000,
      headers: {
        Host: process.env.ACCOUNT_SERVICE_HOST || 'riversoft.top',
        'X-Forwarded-Host': process.env.ACCOUNT_SERVICE_HOST || 'riversoft.top',
        'X-Forwarded-Proto': 'https',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > 65_536) upstream.destroy(new Error('Account response too large'));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve({
        status: response.statusCode || 500,
        body: Buffer.concat(chunks).toString('utf8'),
        setCookie: response.headers['set-cookie'] || [],
      }));
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Account service timeout')));
    upstream.on('error', reject);
    upstream.end(payload);
  });
}

function parseUser(upstream) {
  let payload;
  try {
    payload = JSON.parse(upstream.body);
  } catch {
    throw accountError('统一账号服务返回了无效数据', 502);
  }
  const user = payload?.user;
  if (!user || !Number.isInteger(Number(user.id)) || typeof user.email !== 'string') {
    throw accountError('统一账号服务返回了无效用户信息', 502);
  }
  return { ...user, id: Number(user.id) };
}

export async function assertUnifiedAccountEmailAvailable({ email }) {
  let upstream;
  try {
    upstream = await requestAccount('/api/internal/account-email-exists', { email });
  } catch {
    throw accountError('统一账号服务暂时不可用', 503);
  }

  if (upstream.status < 200 || upstream.status >= 300) {
    throw accountError('统一账号服务暂时不可用', 503);
  }

  let payload;
  try {
    payload = JSON.parse(upstream.body);
  } catch {
    throw accountError('统一账号服务返回了无效数据', 502);
  }
  if (typeof payload?.exists !== 'boolean') {
    throw accountError('统一账号服务返回了无效数据', 502);
  }
  if (payload.exists) throw accountError('该邮箱已注册，请直接登录', 409);
}

export async function createOrLoginUnifiedAccount({ email, password }) {
  let registration;
  try {
    registration = await requestAccount('/api/register', { email, password });
  } catch {
    throw accountError('统一账号服务暂时不可用', 503);
  }

  let upstream = registration;
  if (registration.status === 409) {
    try {
      upstream = await requestAccount('/api/login', { email, password });
    } catch {
      throw accountError('统一账号服务暂时不可用', 503);
    }
  }
  if (upstream.status === 400) throw accountError('邮箱或密码不符合统一账号要求', 400);
  if (upstream.status === 401) throw accountError('该邮箱已存在，但密码不正确', 401);
  if (upstream.status === 403) throw accountError('统一账号已停用', 403);
  if (upstream.status < 200 || upstream.status >= 300) {
    throw accountError('统一账号服务暂时不可用', 503);
  }
  return { user: parseUser(upstream), setCookie: upstream.setCookie };
}
