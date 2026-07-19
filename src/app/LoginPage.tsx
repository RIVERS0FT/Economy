import { type FormEvent, useEffect, useRef, useState } from 'react';
import { completeRegistration, login, sendRegistrationEmailCode } from '../api/auth';
import { InputGroup, TextInput } from '../components/ui/FormControls';
import { Button } from '../components/ui/layout';
import { BRAND_LOGO_URL, BRAND_NAME, BRAND_SLOGAN } from '../config/brand';
import type { AuthUser } from '../types';

type AuthMode = 'login' | 'register';

export function LoginPage({
  inviteCode,
  onAuthenticated,
}: {
  inviteCode?: string;
  onAuthenticated: (user: AuthUser) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<AuthMode>(inviteCode ? 'register' : 'login');
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendSeconds((value) => Math.max(0, value - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  function switchMode(nextMode: AuthMode) {
    if (submitting || sendingCode) return;
    setMode(nextMode);
    setError('');
    setNotice('');
  }

  async function sendCode() {
    if (sendingCode || submitting || resendSeconds > 0 || !formRef.current) return;
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
      const result = await sendRegistrationEmailCode(email);
      setResendSeconds(result.resendAfterSeconds);
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
    const password = String(formData.get('password') ?? '');
    const code = String(formData.get('code') ?? '').trim();
    const submittedInviteCode = String(formData.get('inviteCode') ?? '').trim().toUpperCase();
    const linkInviteCode = inviteCode?.trim().toUpperCase();
    const invitationSource = submittedInviteCode
      ? linkInviteCode && submittedInviteCode === linkInviteCode ? 'share_link' : 'manual_code'
      : undefined;

    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const user = mode === 'login'
        ? await login(email, password)
        : await completeRegistration(
          email,
          password,
          code,
          submittedInviteCode || undefined,
          invitationSource,
        );
      await onAuthenticated(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : mode === 'login' ? '登录失败' : '注册失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="brand-lockup" aria-label={BRAND_NAME}>
          <img src={BRAND_LOGO_URL} alt="" aria-hidden="true" />
          <span>{BRAND_NAME}</span>
        </div>
        <h1>{BRAND_SLOGAN}</h1>
      </section>

      <section className="login-card panel">
        {inviteCode ? (
          <p className="form-notice invite-recognized" role="status">
            已识别好友分享链接，邀请码已自动填写。完成注册后，分享者将立即获得宝石奖励。
          </p>
        ) : null}
        <div className="auth-mode-switch" role="tablist" aria-label="账号操作">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>登录</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')}>注册</button>
        </div>
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
          <TextInput
            label="密码"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            name="password"
            type="password"
            placeholder="至少 8 位"
            minLength={8}
            required
          />
          {mode === 'register' ? (
            <>
              <TextInput
                label="邀请码（可选）"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                name="inviteCode"
                maxLength={8}
                defaultValue={inviteCode ?? ''}
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
                  disabled={sendingCode || submitting || resendSeconds > 0}
                  onClick={() => void sendCode()}
                >
                  {sendingCode ? '发送中…' : resendSeconds > 0 ? `${resendSeconds}s` : '发送验证码'}
                </Button>
              </InputGroup>
            </>
          ) : null}
          {notice ? <p className="form-notice" role="status">{notice}</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <Button block type="submit" disabled={submitting || sendingCode}>
            {submitting ? '正在连接账号服务…' : mode === 'login' ? '登录' : '完成注册'}
          </Button>
        </form>
      </section>
    </main>
  );
}
