import type { ReactNode } from 'react';
import { FrostedGlassSurface } from '../ui/FrostedGlassSurface';

export function AuthCardSurface({ children }: { children: ReactNode }) {
  return (
    <section className="login-card" aria-label="账号认证">
      <FrostedGlassSurface variant="authCard" layout="content">
        {children}
      </FrostedGlassSurface>
    </section>
  );
}
