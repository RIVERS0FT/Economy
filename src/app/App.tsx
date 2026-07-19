import { useEffect, useLayoutEffect, useState } from 'react';
import { getCurrentUser, initializeEconomySession, type EconomySessionResponse } from '../api/auth';
import type { AuthUser } from '../types';
import { AdminApp } from './AdminApp';
import { GameApp } from './GameApp';
import { LoginPage } from './LoginPage';
import '../styles/invitations.css';

type AppSurface = 'loading' | 'auth' | 'game' | 'admin' | 'banned';

function adminSurface() {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/economy/admin') return 'main';
  return null;
}

function invitationCodeFromLocation() {
  return new URLSearchParams(window.location.search).get('invite')?.trim().toUpperCase() || undefined;
}

function clearInvitationCodeFromLocation() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('invite')) return;
  url.searchParams.delete('invite');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function BannedAccount({ incidentId }: { incidentId?: number }) {
  return (
    <main className="login-shell banned-account-shell">
      <section className="login-card panel banned-account-card">
        <h1>账号已封禁</h1>
        <p>系统检测到同一个注册网络创建了多个 Economy 账号，相关账号已全部暂停使用。</p>
        {incidentId ? <p>事件编号：#{incidentId}</p> : null}
        <p>如属于家庭、学校、公司或公共网络，请联系管理员复核。</p>
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<EconomySessionResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const adminPath = adminSurface();
  const banned = Boolean(session?.banned && !(adminPath && user?.role === 'admin'));
  const surface: AppSurface = checking
    ? 'loading'
    : user
      ? adminPath && user.role === 'admin'
        ? 'admin'
        : banned
          ? 'banned'
          : 'game'
      : 'auth';
  const inviteCode = invitationCodeFromLocation();

  useLayoutEffect(() => {
    document.documentElement.dataset.appSurface = surface;
    return () => { delete document.documentElement.dataset.appSurface; };
  }, [surface]);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then(async (currentUser) => {
        if (!currentUser || cancelled) return;
        const nextSession = await initializeEconomySession(inviteCode);
        if (cancelled) return;
        setUser(currentUser);
        setSession(nextSession);
        clearInvitationCodeFromLocation();
      })
      .catch((reason) => {
        if (!cancelled) setAuthError(reason instanceof Error ? reason.message : '账号服务不可用');
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function authenticated(nextUser: AuthUser) {
    setChecking(true);
    setAuthError('');
    try {
      const nextSession = await initializeEconomySession(inviteCode);
      setUser(nextUser);
      setSession(nextSession);
      clearInvitationCodeFromLocation();
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : '无法初始化 Economy 玩家状态');
    } finally {
      setChecking(false);
    }
  }

  if (checking) return <main className="loading-screen">正在连接统一账号服务…</main>;
  if (!user) {
    return (
      <>
        <LoginPage inviteCode={inviteCode} onAuthenticated={authenticated} />
        {authError ? <div className="auth-service-warning">{authError}。请确认服务器已启用金融帝国账号代理。</div> : null}
      </>
    );
  }
  if (banned) return <BannedAccount incidentId={session?.incidentId} />;
  if (adminPath === 'main') return <AdminApp user={user} />;
  return <GameApp user={user} onSignedOut={() => { setUser(null); setSession(null); }} />;
}
