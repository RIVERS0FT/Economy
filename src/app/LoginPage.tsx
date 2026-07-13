import { type FormEvent, useState } from 'react';
import { login } from '../api/auth';
import { Button } from '../components/ui/layout';
import { BRAND_LOGO_URL, BRAND_NAME, BRAND_SLOGAN } from '../config/brand';
import type { AuthUser } from '../types';

export function LoginPage({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    setSubmitting(true);
    setError('');
    try {
      const user = await login(email, password);
      onAuthenticated(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败');
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
        <form onSubmit={submit} className="login-form" aria-busy={submitting}>
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
              autoComplete="current-password"
              name="password"
              type="password"
              placeholder="至少 8 位"
              required
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <Button block type="submit" disabled={submitting}>
            {submitting ? '正在连接账号服务…' : '登录或注册'}
          </Button>
        </form>
      </section>
    </main>
  );
}
