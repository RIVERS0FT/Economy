import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  completeRegistration,
  login,
  logout,
  resetPassword,
  sendPasswordResetEmailCode,
  sendRegistrationEmailCode,
} from '../api/auth';
import { AuthCardSurface } from '../components/auth/AuthCardSurface';
import { InputGroup, TextInput } from '../components/ui/FormControls';
import { Button } from '../components/ui/layout';
import { BRAND_LOGO_URL, BRAND_NAME, BRAND_SLOGAN } from '../config/brand';
import type { AuthUser } from '../types';

type AuthMode = 'login' | 'register' | 'forgot-password';
type VerificationMode = Exclude<AuthMode, 'login'>;

const INITIAL_RESEND_SECONDS: Record<VerificationMode, number> = {
  register: 0,
  'forgot-password': 0,
};

export function LoginPage({
  inviteCode,
  onAuthenticated,
  onRegistrationCompleted,
}: {
  inviteCode?: string;
  onAuthenticated: (user: AuthUser) => void | Promise<void>;
  onRegistrationCompleted?: () => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<AuthMode>(inviteCode ? 'register' : 'login');
  const [activeInviteCode, setActiveInviteCode] = useState(inviteCode);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(INITIAL_RESEND_SECONDS);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (resendSeconds.register <= 0 && resendSeconds['forgot-password'] <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendSeconds((value) => ({
        register: Math.max(0, value.register - 1),
        'forgot-password': Math.max(0, value['forgot-password'] - 1),
      }));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [resendSeconds.register, resendSeconds['forgot-password']]);

  function switchMode(nextMode: AuthMode) {
    if (submitting || sendingCode) return;
    setMode(nextMode);
    setError('');
    setNotice('');
  }

  async function sendCode() {
    if (mode === 'login' || sendingCode || submitting || resendSeconds[mode] > 0 || !formRef.current) return;
    const formData = new FormData(formRef.current);
    const email = String(formData.get('email') ?? '').trim();
    if (!email) {
      setError('请先输入账号邮箱');
      return;
    }
    setSendingCode(true);
    setError('');
    setNotice('');
    try {
      const result = mode === 'register'
        ? await sendRegistrationEmailCode(email)
        : await sendPasswordResetEmailCode(email);
      setResendSeconds((value) => ({ ...value, [mode]: result.resendAfterSeconds }));
      setNotice(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get(mode === 'forgot-password' ? 'newPassword' : 'password') ?? '');
    const code = String(formData.get('code') ?? '').trim();
    const submittedInviteCode = String(formData.get('inviteCode') ?? '').trim().toUpperCase();
    const linkInviteCode = activeInviteCode?.trim().toUpperCase();
    const invitationSource = submittedInviteCode
      ? linkInviteCode && submittedInviteCode === linkInviteCode ? 'share_link' : 'manual_code'
      : undefined;

    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'login') {
        await onAuthenticated(await login(email, password));
        return;
      }

      if (mode === 'register') {
        await completeRegistration(
          email,
          password,
          code,
          submittedInviteCode || undefined,
          invitationSource,
        );
        setActiveInviteCode(undefined);
        await onRegistrationCompleted?.();
        let logoutFailed = false;
        try {
          await logout();
        } catch {
          logoutFailed = true;
        }
        setMode('login');
        setNotice('注册完成，请使用新账号登录');
        if (logoutFailed) {
          setError('注册已完成，但自动登录状态清理失败。请刷新页面后再登录。');
        }
        return;
      }

      await resetPassword(email, password, code);
      setMode('login');
      setNotice('密码已重置，请使用新密码登录');
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : mode === 'register'
          ? '注册失败'
          : mode === 'forgot-password'
            ? '密码重置失败'
            : '登录失败');
    } finally {
      setSubmitting(false);
    }
  }

  const activeResendSeconds = mode === 'login' ? 0 : resendSeconds[mode];
  const codeButtonLabel = sendingCode
    ? '发送中…'
    : activeResendSeconds > 0
      ? `${activeResendSeconds}s`
      : '发送验证码';

  return (
    <main className="login-shell">
      <div className="login-content-layer">
        <section className="login-brand">
          <div className="brand-lockup" aria-label={BRAND_NAME}>
            <img src={BRAND_LOGO_URL} alt="" aria-hidden="true" />
            <span>{BRAND_NAME}</span>
          </div>
          <h1>{BRAND_SLOGAN}</h1>
        </section>

        <AuthCardSurface>
          {mode !== 'login' ? (
            <div className="auth-panel-header">
              <button
                type="button"
                className="auth-panel-back"
                disabled={submitting || sendingCode}
                onClick={() => switchMode('login')}
              >
                返回
              </button>
            </div>
          ) : null}
          {mode === 'register' && activeInviteCode ? (
            <p className="form-notice invite-recognized" role="status">
              已识别好友分享链接，邀请码已自动填写。完成注册后，分享者将立即获得宝石奖励。
            </p>
          ) : null}
          <form ref={formRef} onSubmit={submit} className="login-form" aria-busy={submitting || sendingCode}>
            <TextInput
              label="账号邮箱"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              name="email"
              type="email"
              placeholder="请输入账号邮箱"
              required
            />
            {mode !== 'forgot-password' ? (
              <TextInput
                label="密码"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                name="password"
                type="password"
                placeholder="至少 8 位"
                minLength={8}
                required
              />
            ) : null}
            {mode === 'login' ? (
              <div className="auth-entry-links" aria-label="其他账号操作">
                <button type="button" onClick={() => switchMode('forgot-password')}>忘记密码</button>
                <button type="button" onClick={() => switchMode('register')}>注册账号</button>
              </div>
            ) : null}
            {mode === 'register' ? (
              <>
                <TextInput
                  label="邀请码（可选）"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  name="inviteCode"
                  maxLength={8}
                  defaultValue={activeInviteCode ?? ''}
                  placeholder="8 位邀请码"
                  onInput={(event) => {
                    event.currentTarget.value = event.currentTarget.value.toUpperCase();
                  }}
                />
                <InputGroup className="email-code-field">
                  <TextInput
                    label="邮箱验证码"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    name="code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="6 位验证码"
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={sendingCode || submitting || activeResendSeconds > 0}
                    onClick={() => void sendCode()}
                  >
                    {codeButtonLabel}
                  </Button>
                </InputGroup>
              </>
            ) : null}
            {mode === 'forgot-password' ? (
              <>
                <InputGroup className="email-code-field">
                  <TextInput
                    label="邮箱验证码"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    name="code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="6 位验证码"
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={sendingCode || submitting || activeResendSeconds > 0}
                    onClick={() => void sendCode()}
                  >
                    {codeButtonLabel}
                  </Button>
                </InputGroup>
                <TextInput
                  label="新密码"
                  autoComplete="new-password"
                  name="newPassword"
                  type="password"
                  placeholder="至少 8 位"
                  minLength={8}
                  required
                />
              </>
            ) : null}
            {notice ? <p className="form-notice" role="status">{notice}</p> : null}
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <Button block type="submit" disabled={submitting || sendingCode}>
              {submitting
                ? mode === 'forgot-password' ? '正在重置密码…' : '正在连接账号服务…'
                : mode === 'login' ? '登录' : mode === 'register' ? '完成注册' : '重置密码'}
            </Button>
          </form>
        </AuthCardSurface>
      </div>
    </main>
  );
}
