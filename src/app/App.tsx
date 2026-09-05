import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ApiRequestError,
  getCurrentUser,
  initializeEconomySession,
  isUnauthorizedApiError,
  type EconomySessionResponse,
} from '../api/auth';
import { ApplicationLoadingState } from '../components/system/ApplicationLoadingState';
import { RefreshPageButton } from '../components/system/RefreshPageButton';
import { Button } from '../components/ui/layout';
import type {
  FinancialBackdropTone,
  FinancialBackdropVariant,
} from '../components/visual/FinancialBackdrop';
import { PhotographicStateShell } from '../components/visual/PhotographicStateShell';
import type { AuthUser } from '../types';
import { LoginPage } from './LoginPage';
import { endGameWriteSession } from '../api/gameWriteSession';
import '../styles/invitations.css';

const initialAdminPath = window.location.pathname.replace(/\/+$/, '') === '/economy/admin';
const initialLocalGamePreview = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('preview') === 'game';
const adminAppModule = initialAdminPath ? import('./AdminApp') : null;
const gameAppModule = initialAdminPath ? null : import('./GameApp');
const localGamePreviewModule = initialLocalGamePreview ? import('./LocalGamePreviewApp') : null;
const AdminApp = lazy(() => (adminAppModule ?? import('./AdminApp')).then((module) => ({ default: module.AdminApp })));
const GameApp = lazy(() => (gameAppModule ?? import('./GameApp')).then((module) => ({ default: module.GameApp })));
const LocalGamePreviewApp = localGamePreviewModule
  ? lazy(() => localGamePreviewModule.then((module) => ({ default: module.LocalGamePreviewApp })))
  : null;

type AppSurface = 'loading' | 'auth' | 'game' | 'admin' | 'banned' | 'error';

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

function sessionConnectionMessage(reason: unknown) {
  if (reason instanceof ApiRequestError && reason.status >= 500 && reason.message === '请求失败') {
    return '游戏服务器暂时无法响应，请重新连接';
  }
  return reason instanceof Error ? reason.message : '无法初始化 Economy 玩家状态';
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

function SessionConnectionError({
  variant,
  message,
  onRetry,
}: {
  variant: 'game' | 'admin';
  message: string;
  onRetry: () => void;
}) {
  return (
    <PhotographicStateShell variant={variant} tone="critical" className="session-connection-error-shell" role="alert">
      <section className="photographic-state-card session-connection-error-card">
        <h1>无法连接游戏服务器</h1>
        <p>{message}</p>
        <Button type="button" onClick={onRetry}>重新连接</Button>
      </section>
    </PhotographicStateShell>
  );
}

function AuthenticatedApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<EconomySessionResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const adminPath = adminSurface();
  const sessionFailed = Boolean(user && sessionError);
  const banned = Boolean(session?.banned && !(adminPath && user?.role === 'admin'));
  const surface: AppSurface = checking
    ? 'loading'
    : !user
      ? 'auth'
      : sessionFailed
        ? 'error'
        : banned
          ? 'banned'
          : adminPath
            ? 'admin'
            : 'game';
  const backdrop: FinancialBackdropVariant = checking
    ? stateVariantForPath(adminPath)
    : !user
      ? 'auth'
      : adminPath
        ? 'admin'
        : 'game';
  const tone: FinancialBackdropTone = sessionFailed
    || banned
    || Boolean(user && adminPath && user.role !== 'admin')
    ? 'critical'
    : 'normal';
  const inviteCode = invitationCodeFromLocation();
  const handleSignedOut = useCallback(() => {
    endGameWriteSession();
    setUser(null);
    setSession(null);
    setSessionError('');
    setAuthError('');
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.appSurface = surface;
    document.documentElement.dataset.appBackdrop = backdrop;
    document.documentElement.dataset.appTone = tone;
  }, [backdrop, surface, tone]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser || cancelled) return;
        setUser(currentUser);
        try {
          const nextSession = await initializeEconomySession(inviteCode);
          if (cancelled) return;
          setSession(nextSession);
          setSessionError('');
          clearInvitationCodeFromLocation();
        } catch (reason) {
          if (cancelled) return;
          if (isUnauthorizedApiError(reason)) {
            setUser(null);
            setSession(null);
            setAuthError('登录状态已失效，请重新登录');
          } else {
            setSessionError(sessionConnectionMessage(reason));
          }
        }
      } catch (reason) {
        if (!cancelled) setAuthError(reason instanceof Error ? reason.message : '账号服务不可用');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function connectAuthenticatedUser(nextUser: AuthUser) {
    setUser(nextUser);
    setSession(null);
    setChecking(true);
    setAuthError('');
    setSessionError('');
    try {
      const nextSession = await initializeEconomySession(inviteCode);
      setSession(nextSession);
      clearInvitationCodeFromLocation();
    } catch (reason) {
      if (isUnauthorizedApiError(reason)) {
        setUser(null);
        setSession(null);
        setAuthError('登录状态已失效，请重新登录');
      } else {
        setSessionError(sessionConnectionMessage(reason));
      }
    } finally {
      setChecking(false);
    }
  }

  async function authenticated(nextUser: AuthUser) {
    await connectAuthenticatedUser(nextUser);
  }

  if (checking) {
    return (
      <ApplicationLoadingState>
        正在连接服务器…
      </ApplicationLoadingState>
    );
  }
  if (!user) {
    return (
      <>
        <LoginPage
          inviteCode={inviteCode}
          onAuthenticated={authenticated}
          onRegistrationCompleted={clearInvitationCodeFromLocation}
        />
        {authError ? (
          <div className="auth-service-warning" role="alert">
            <span>{authError}</span>
            <RefreshPageButton />
          </div>
        ) : null}
      </>
    );
  }
  if (sessionError || !session) {
    return (
      <SessionConnectionError
        variant={adminPath ? 'admin' : 'game'}
        message={sessionError || 'Economy 会话尚未建立'}
        onRetry={() => { void connectAuthenticatedUser(user); }}
      />
    );
  }
  if (banned) return <BannedAccount incidentId={session.incidentId} />;
  return (
    <Suspense
      fallback={(
        <ApplicationLoadingState>
          正在连接服务器…
        </ApplicationLoadingState>
      )}
    >
      {adminPath === 'main'
        ? <AdminApp user={user} />
        : <GameApp user={user} onSignedOut={handleSignedOut} />}
    </Suspense>
  );
}

export default function App() {
  if (LocalGamePreviewApp) {
    return (
      <Suspense fallback={<ApplicationLoadingState>正在加载本地免登录游戏…</ApplicationLoadingState>}>
        <LocalGamePreviewApp />
      </Suspense>
    );
  }
  return <AuthenticatedApp />;
}
