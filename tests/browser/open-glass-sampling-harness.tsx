import { createRoot } from 'react-dom/client';
import type { CSSProperties } from 'react';
import '../../src/app/interactionBootstrap';
import { FinancialBackdrop } from '../../src/components/visual/FinancialBackdrop';
import { LiquidGlassSurface } from '../../src/components/ui/LiquidGlassSurface';
import { ScrollArea } from '../../src/components/ui/ScrollArea';
import '../../src/styles/globals.css';
import '../../src/styles/desktop-sidebar.css';
import '../../src/styles/viewport.css';
import '../../src/styles/card-system.css';
import '../../src/styles/liquid-glass-chrome.css';
import '../../src/styles/mobile-status-navigation.css';
import '../../src/styles/mobile-status-layout.css';
import '../../src/styles/admin-navigation.css';
import '../../src/styles/design-system.css';
import '../../src/styles/interaction-states.css';
import '../../src/styles/primary-surfaces.css';

const params = new URLSearchParams(window.location.search);
const surface = params.get('surface') === 'admin' ? 'admin' : 'game';
const mode = params.get('mode') === 'mobile' ? 'mobile' : 'desktop';
const isAdmin = surface === 'admin';
const isMobile = mode === 'mobile';

document.documentElement.dataset.appSurface = surface;
document.documentElement.dataset.appBackdrop = surface;
document.documentElement.dataset.appTone = 'normal';

function StatusContent({ admin }: { admin: boolean }) {
  const values = admin
    ? ['运营中心', '管理员', '世界 20', 'API 正常', '刷新']
    : ['12,450', '3,210', '78%', '#12', '9'];
  return (
    <div className="asset-bar-content">
      {values.map((value, index) => (
        <div className="asset-bar-item" key={value}>
          <span className="asset-bar-item-icon" aria-hidden="true">{index + 1}</span>
          <span>
            <small className="asset-bar-item-label">{admin ? '管理状态' : '玩家状态'}</small>
            <strong className="asset-bar-item-value">{value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusChrome() {
  if (isAdmin && isMobile) return null;
  return (
    <header className={`asset-bar${isAdmin ? ' admin-command-bar' : ''}`}>
      <LiquidGlassSurface
        variant={isMobile ? 'mobileStatusBar' : 'desktopStatusBar'}
        layout="fixed"
      >
        <StatusContent admin={isAdmin} />
      </LiquidGlassSurface>
    </header>
  );
}

function MobileNavigation() {
  if (!isMobile) return null;
  return (
    <aside
      className={`mobile-bottom-navigation${isAdmin ? ' admin-mobile-bottom-navigation' : ''}`}
      aria-label={isAdmin ? '管理员移动导航' : '玩家移动导航'}
    >
      <LiquidGlassSurface variant="mobileNavigation" layout="fixed">
        <nav className="mobile-bottom-navigation__viewport" aria-label={isAdmin ? '管理员移动导航' : '玩家移动导航'}>
          {['概览', '市场', '生产', '合同', '设置'].map((label, index) => (
            <button className={`sidebar-nav-button${index === 0 ? ' active' : ''}`} type="button" key={label}>
              <span aria-hidden="true">{index + 1}</span>
              <strong>{label}</strong>
            </button>
          ))}
        </nav>
      </LiquidGlassSurface>
    </aside>
  );
}

function SamplingPage() {
  return (
    <div
      className="page-content"
      style={{
        minHeight: '140vh',
        padding: '24px',
        backgroundImage: [
          'linear-gradient(135deg, rgba(36, 156, 92, .28) 25%, transparent 25%)',
          'linear-gradient(225deg, rgba(214, 240, 222, .16) 25%, transparent 25%)',
          'linear-gradient(45deg, rgba(214, 240, 222, .12) 25%, transparent 25%)',
          'linear-gradient(315deg, rgba(36, 156, 92, .2) 25%, rgba(2, 9, 6, .24) 25%)',
        ].join(', '),
        backgroundPosition: '32px 0, 32px 0, 0 0, 0 0',
        backgroundSize: '64px 64px',
      }}
    >
      <section className="panel" style={{ minHeight: '280px', padding: '24px' }}>
        <h1>{isAdmin ? '管理员采样界面' : '玩家采样界面'}</h1>
        <p>高对比页面图案用于确认液态玻璃能够采样根级摄影、氛围与滚动内容。</p>
      </section>
    </div>
  );
}

function SamplingApp() {
  const shellStyle = { '--sidebar-column-width': '224px' } as CSSProperties;
  return (
    <>
      <FinancialBackdrop />
      <div className="application-content-root">
        <main
          className={`${isAdmin ? 'admin-shell' : 'game-shell'} signed-in-shell sidebar-layout`}
          style={shellStyle}
          data-sampling-surface={surface}
          data-sampling-mode={mode}
        >
          <aside className={`desktop-sidebar${isAdmin ? ' admin-sidebar' : ''}`} aria-hidden="true" />
          <section className={`workspace${isAdmin ? ' admin-workspace' : ''}`}>
            <div className="mobile-page-overlay">
              <ScrollArea
                axis="y"
                className="page-scroll-area"
                viewportClassName={`page-scroll${isAdmin ? ' admin-page-scroll' : ''}`}
                scrollbarVisibility="adaptive"
              >
                <SamplingPage />
              </ScrollArea>
            </div>
            <div className={`mobile-chrome-overlay${isAdmin ? ' admin-mobile-chrome-layer' : ''}`}>
              <StatusChrome />
              <MobileNavigation />
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('open glass sampling root is missing');
createRoot(rootElement).render(<SamplingApp />);
