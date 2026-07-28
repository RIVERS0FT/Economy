import { useEffect, useState, type ReactNode } from 'react';
import { LiquidGlassSurface, type LiquidGlassSurfaceVariant } from '../ui/LiquidGlassSurface';

const MOBILE_AUTH_MEDIA_QUERY = '(max-width: 720px)';

type AuthCardSurfaceVariant = Extract<
  LiquidGlassSurfaceVariant,
  'desktopAuthCard' | 'mobileAuthCard'
>;

function getAuthCardSurfaceVariant(): AuthCardSurfaceVariant {
  if (typeof window === 'undefined') return 'desktopAuthCard';
  return window.matchMedia(MOBILE_AUTH_MEDIA_QUERY).matches ? 'mobileAuthCard' : 'desktopAuthCard';
}

export function AuthCardSurface({ children }: { children: ReactNode }) {
  const [surfaceVariant, setSurfaceVariant] = useState<AuthCardSurfaceVariant>(getAuthCardSurfaceVariant);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_AUTH_MEDIA_QUERY);
    const updateVariant = () => setSurfaceVariant(mediaQuery.matches ? 'mobileAuthCard' : 'desktopAuthCard');
    updateVariant();
    mediaQuery.addEventListener('change', updateVariant);
    return () => mediaQuery.removeEventListener('change', updateVariant);
  }, []);

  return (
    <section className="login-card" aria-label="账号认证">
      <LiquidGlassSurface variant={surfaceVariant} layout="content">
        {children}
      </LiquidGlassSurface>
    </section>
  );
}
