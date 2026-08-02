import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { getCurrentUser, initializeEconomySession, type EconomySessionResponse } from '../api/auth';
import { ApplicationLoadingState } from '../components/system/ApplicationLoadingState';
import type {
  FinancialBackdropTone,
  FinancialBackdropVariant,
} from '../components/visual/FinancialBackdrop';
import { PhotographicStateShell } from '../components/visual/PhotographicStateShell';
import type { AuthUser } from '../types';
import { LoginPage } from './LoginPage';
const AdminApp = lazy(() => import('./AdminApp').then((module) => ({ default: module.AdminApp })));
const GameApp = lazy(() => import('./GameApp').then((module) => ({ default: module.GameApp })));
import '../styles/invitations.css';

type AppSurface = 'loading' | 'auth' | 'game' | 'admin' | 'banned';

function adminSurface() {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/economy/admin') return 'main';
  return null;
}

function stateVariantForPath(adminPath: ReturnType<typeof adminSurface>): FinancialBackdropVariant {
  return adminPath ? 'admin' : 'auth';
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
    <PhotographicStateShell variant="game" tone="critical" className="banned-account-shell" role="alert">
      <section className="photographic-state-card banned-account-card">
        <h1>账号已封禁</h1>
        <p>该账号已被管理员封禁，普通游戏访问已暂停。</p>
        {incidentId ? <p>事件编号：#{incidentId}</p> : null}
        <p>如需申诉，请联系管理员并提供事件编号。</p>
      </section>
    </PhotographicStateShell>
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
      ? banned
        ? 'banned'
        : adminPath
          ? 'admin'
          : 'game'
      : 'auth';
  const backdrop: FinancialBackdropVariant = checking
    ? stateVariantForPath(adminPath)
    : !user
      ? 'auth'
      : banned
        ? 'game'
        : adminPath
          ? 'admin'
          : 'game';
  const tone: FinancialBackdropTone = banned || Boolean(user && adminPath && user.role !== 'admin')
    ? 'critical'
    : 'normal';
  const inviteCode = invitationCodeFromLocation();

  useLayoutEffect(() => {
    document.documentElement.dataset.appSurface = surface;
    document.documentElement.dataset.appBackdrop = backdrop;
    document.documentElement.dataset.appTone = tone;
  }, [backdrop, surface, tone]);

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

  if (checking) {
    return (
      <ApplicationLoadingState>
        正在连接统一账号服务…
      </ApplicationLoadingState>
    );
  }
  if (!user) {
    return (
      <>
        <LoginPage inviteCode={inviteCode} onAuthenticated={authenticated} />
        {authError ? <div className="auth-service-warning">{authError}。请确认服务器已启用金融帝国账号代理。</div> : null}
      </>
    );
  }
  if (banned) return <BannedAccount incidentId={session?.incidentId} />;
  return (
    <Suspense
      fallback={(
        <ApplicationLoadingState>
          正在加载金融帝国…
        </ApplicationLoadingState>
      )}
    >
      {adminPath === 'main'
        ? <AdminApp user={user} />
        : <GameApp user={user} onSignedOut={() => { setUser(null); setSession(null); }} />}
    </Suspense>
  );
}
