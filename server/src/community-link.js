export const DEFAULT_QQ_GROUP_URL = 'https://qm.qq.com/q/eN8hya0Yn0';

export function normalizeQqGroupUrl(value) {
  const candidate = String(value ?? '').trim();
  if (!candidate || candidate.length > 2_048) {
    throw Object.assign(new Error('QQ群链接长度无效'), { statusCode: 400 });
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw Object.assign(new Error('QQ群链接格式无效'), { statusCode: 400 });
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw Object.assign(new Error('QQ群链接必须是无账号信息的 HTTPS 地址'), { statusCode: 400 });
  }
  return url.href;
}
