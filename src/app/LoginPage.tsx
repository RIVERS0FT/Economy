import { type FormEvent, useEffect, useRef, useState } from 'react';
import { completeRegistration, login, sendRegistrationEmailCode } from '../api/auth';
import { Button } from '../components/ui/layout';
import { BRAND_LOGO_URL, BRAND_NAME, BRAND_SLOGAN } from '../config/brand';
import type { AuthUser } from '../types';

type AuthMode = 'login' | 'register';

export function LoginPage({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<AuthMode>('login');
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

    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const user = mode === 'login'
        ? await login(email, password)
        : await completeRegistration(email, password, code);
      onAuthenticated(user);
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
        <div className="auth-mode-switch" role="tablist" aria-label="账号操作">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>登录</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')}>注册</button>
        </div>
        <form ref={formRef} onSubmit={submit} className="login-form" aria-busy={submitting || sendingCode}>
          <label>
            账号邮箱
            <input
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              name="email"
              type="email"
              placeholder="请输入账号邮箱"
              required
            />
          </label>
          <label>
            密码
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              name="password"
              type="password"
              placeholder="至少 8 位"
              minLength={8}
              required
            />
          </label>
          {mode === 'register' ? (
            <label>
              邮箱验证码
              <span className="email-code-field">
                <input
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
              </span>
            </label>
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
