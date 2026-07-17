import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Economy client render failed', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="loading-screen" role="alert">
          <div>
            <strong>页面运行出现异常</strong>
            <p>服务器经济状态不会受影响。请刷新页面重新连接。</p>
            <button type="button" onClick={() => window.location.reload()}>刷新页面</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
