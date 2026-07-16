const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_TIMEOUT_MS = 8_000;

function providerError() {
  return Object.assign(new Error('邮件服务暂时不可用，请稍后重试'), { statusCode: 503 });
}

function configurationError() {
  return Object.assign(new Error('邮箱验证码服务未配置，请联系管理员'), {
    statusCode: 424,
    code: 'EMAIL_SERVICE_NOT_CONFIGURED',
  });
}

export function getRegistrationEmailConfiguration() {
  const apiKeyConfigured = Boolean(String(process.env.RESEND_API_KEY || '').trim());
  const fromConfigured = Boolean(String(process.env.RESEND_FROM_EMAIL || '').trim());
  return {
    configured: apiKeyConfigured && fromConfigured,
    apiKeyConfigured,
    fromConfigured,
  };
}

export async function sendRegistrationEmail({ to, code, idempotencyKey, expiresInMinutes }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (!apiKey || !from) throw configurationError();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Economy 邮箱验证码',
        text: `你的 Economy 邮箱验证码是 ${code}，${expiresInMinutes} 分钟内有效。请勿向他人透露。`,
        html: `<p>你的 Economy 邮箱验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>${expiresInMinutes} 分钟内有效，请勿向他人透露。</p>`,
      }),
    });
    if (!response.ok) throw providerError();
    const payload = await response.json();
    if (!payload?.id) throw providerError();
    return { id: String(payload.id) };
  } catch (error) {
    if (error?.statusCode === 503) throw error;
    throw providerError();
  } finally {
    clearTimeout(timeout);
  }
}
