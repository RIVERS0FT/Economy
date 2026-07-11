import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const DEFAULT_ACCOUNT_SERVICE_URL = 'http://127.0.0.1:3001';

function fetchCurrentUser(cookie) {
  const base = process.env.ACCOUNT_SERVICE_URL || DEFAULT_ACCOUNT_SERVICE_URL;
  const target = new URL('/api/me', base.endsWith('/') ? base : `${base}/`);
  const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const upstream = transport(target, {
      method: 'GET',
      timeout: 5_000,
      headers: {
        Cookie: cookie,
        Host: process.env.ACCOUNT_SERVICE_HOST || 'riversoft.top',
        'X-Forwarded-Host': process.env.ACCOUNT_SERVICE_HOST || 'riversoft.top',
        'X-Forwarded-Proto': 'https',
      },
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > 65_536) {
          upstream.destroy(new Error('Account response too large'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        resolve({
          status: response.statusCode || 500,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Account service timeout')));
    upstream.on('error', reject);
    upstream.end();
  });
}

export async function authenticateRequest(request) {
  const cookie = String(request.headers.cookie || '');
  if (!cookie || cookie.length > 8_192) return null;

  let upstream;
  try {
    upstream = await fetchCurrentUser(cookie);
  } catch {
    const error = new Error('统一账号服务暂时不可用');
    error.statusCode = 503;
    throw error;
  }

  if (upstream.status === 401) return null;
  if (upstream.status < 200 || upstream.status >= 300) {
    const error = new Error('统一账号服务暂时不可用');
    error.statusCode = 503;
    throw error;
  }

  let payload;
  try {
    payload = JSON.parse(upstream.body);
  } catch {
    const error = new Error('统一账号服务返回了无效数据');
    error.statusCode = 502;
    throw error;
  }

  const user = payload?.user;
  if (!user || !Number.isInteger(Number(user.id)) || typeof user.email !== 'string') {
    const error = new Error('统一账号服务返回了无效用户信息');
    error.statusCode = 502;
    throw error;
  }
  return { ...user, id: Number(user.id) };
}
