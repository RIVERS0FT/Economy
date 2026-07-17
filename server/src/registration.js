import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertUnifiedAccountEmailAvailable, createOrLoginUnifiedAccount } from './account-client.js';
import { sendRegistrationEmail } from './email.js';

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

export function normalizeRegistrationEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function validateRegistrationInput(email, password) {
  const normalizedEmail = normalizeRegistrationEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw httpError('请输入有效邮箱地址', 400);
  }
  if (password !== undefined) {
    const passwordText = String(password || '');
    if (passwordText.length < 8 || passwordText.length > 256) {
      throw httpError('密码长度必须为 8 至 256 位', 400);
    }
  }
  return normalizedEmail;
}

export function loadRegistrationSecret() {
  const direct = String(process.env.ECONOMY_REGISTRATION_SECRET || '');
  if (direct.length >= 32) return direct;
  const secretFile = process.env.ECONOMY_REGISTRATION_SECRET_FILE;
  if (secretFile) {
    const value = readFileSync(secretFile, 'utf8').trim();
    if (value.length >= 32) return value;
  }
  if (process.env.NODE_ENV !== 'production') return 'economy-development-registration-secret-change-me';
  throw new Error('Economy registration secret is not configured');
}

export function requestIpAddress(request) {
  const realIp = String(request.headers['x-real-ip'] || '').trim();
  const forwarded = String(request.headers['x-forwarded-for'] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1) || '';
  const socketIp = String(request.socket?.remoteAddress || '').trim();
  return (realIp || forwarded || socketIp || 'unknown').replace(/^::ffff:/, '');
}

export function fingerprintIpAddress(ipAddress, secret) {
  return createHmac('sha256', secret)
    .update(`economy-registration-ip\n${String(ipAddress || 'unknown')}`)
    .digest('hex');
}

export function createRegistrationService({
  registrationStore,
  emailSender = sendRegistrationEmail,
  accountClient = createOrLoginUnifiedAccount,
  accountAvailabilityChecker = assertUnifiedAccountEmailAvailable,
}) {
  return {
    async requestEmailCode({ email, ipFingerprint, requestKey, now = Date.now() }) {
      const normalizedEmail = validateRegistrationInput(email);
      await accountAvailabilityChecker({ email: normalizedEmail });
      const verification = registrationStore.beginEmailVerification({
        email: normalizedEmail,
        ipFingerprint,
        requestKey,
        now,
      });
      try {
        const delivery = await emailSender({
          to: normalizedEmail,
          code: verification.code,
          idempotencyKey: `economy-registration-${verification.id}`,
          expiresInMinutes: 10,
        });
        registrationStore.markEmailSent(verification.id, delivery.id, now);
      } catch (error) {
        registrationStore.markEmailFailed(verification.id);
        throw error;
      }
      return {
        message: '验证码已发送，请检查邮箱',
        expiresAt: Number(verification.expires_at),
        resendAfterSeconds: 60,
      };
    },

    async complete({ email, password, code, inviteCode, invitationSource, ipFingerprint, requestKey, now = Date.now() }) {
      const normalizedEmail = validateRegistrationInput(email, password);
      if (!/^\d{6}$/.test(String(code || ''))) throw httpError('请输入 6 位邮箱验证码', 400);
      const prepared = registrationStore.prepareEmailCompletion({
        email: normalizedEmail,
        code: String(code),
        ipFingerprint,
        requestKey,
        now,
      });
      const account = await accountClient({ email: normalizedEmail, password: String(password) });
      const economyRegistration = registrationStore.completeEmailRegistration({
        verificationId: prepared.verificationId,
        requestKey,
        user: account.user,
        ipFingerprint,
        inviteCode,
        invitationSource,
        now,
      });
      return { ...account, economyRegistration };
    },
  };
}
