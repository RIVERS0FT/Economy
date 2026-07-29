import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { FinancialBackdropVariant } from '../components/visual/FinancialBackdrop';
import { PhotographicStateShell } from '../components/visual/PhotographicStateShell';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

function currentFallbackVariant(): FinancialBackdropVariant {
  const backdrop = document.documentElement.dataset.appBackdrop;
  if (backdrop === 'auth' || backdrop === 'game' || backdrop === 'admin') return backdrop;
  const surface = document.documentElement.dataset.appSurface;
  if (surface === 'admin' || window.location.pathname.replace(/\/+$/, '') === '/economy/admin') return 'admin';
  if (surface === 'game' || surface === 'banned') return 'game';
  return 'auth';
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    document.documentElement.dataset.appSurface = 'error';
    document.documentElement.dataset.appTone = 'critical';
    console.error('Economy client render failed', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <PhotographicStateShell
          variant={currentFallbackVariant()}
          tone="critical"
          className="client-error-shell"
          role="alert"
        >
          <section className="photographic-state-card">
            <strong>页面运行出现异常</strong>
            <p>服务器经济状态不会受影响。请刷新页面重新连接。</p>
            <button type="button" onClick={() => window.location.reload()}>刷新页面</button>
          </section>
        </PhotographicStateShell>
      );
    }
    return this.props.children;
  }
}
