import { useEffect, useLayoutEffect, useState } from 'react';
import { getCurrentUser } from '../api/auth';
import type { AuthUser } from '../types';
import { GameApp } from './GameApp';
import { LoginPage } from './LoginPage';

type AppSurface = 'loading' | 'auth' | 'game';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const surface: AppSurface = checking ? 'loading' : user ? 'game' : 'auth';

  useLayoutEffect(() => {
    document.documentElement.dataset.appSurface = surface;
    return () => {
      delete document.documentElement.dataset.appSurface;
    };
  }, [surface]);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch((reason) => setAuthError(reason instanceof Error ? reason.message : '账号服务不可用'))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <main className="loading-screen">正在连接统一账号服务…</main>;
  if (!user) {
    return (
      <>
        <LoginPage onAuthenticated={setUser} />
        {authError ? <div className="auth-service-warning">{authError}。请确认服务器已启用金融帝国账号代理。</div> : null}
      </>
    );
  }
  return <GameApp user={user} onSignedOut={() => setUser(null)} />;
}
