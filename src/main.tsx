import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import './app/interactionBootstrap';
import { installIdempotentGameWriteFetch } from './api/idempotentGameWriteFetch';
import { ApplicationLayerRoot } from './components/visual/ApplicationLayerRoot';
import { configureRuntimePerformance } from './utils/runtimePerformance';
import './styles/globals.css';
import './styles/desktop-sidebar.css';
import './styles/performance.css';
import './styles/viewport.css';
import './styles/scrollbars.css';
import './styles/game-shell-layout.css';
import './styles/safe-floating.css';
import './styles/financial-backdrop.css';
import './styles/card-system.css';
import './styles/frosted-glass-surfaces.css';
import './styles/mobile-status-navigation.css';
import './styles/mobile-interaction.css';
import './styles/mobile-pages.css';
import './styles/icon-system.css';
import './styles/player-avatar.css';
import './styles/overview.css';
import './styles/economic-event-log.css';
import './styles/industry-system.css';
import './styles/facility-group-card-grid.css';
import './styles/research-page.css';
import './styles/facility-production-formula.css';
import './styles/market-funds.css';
import './styles/market-account-table.css';
import './styles/asset-overview.css';
import './styles/charts.css';
import './styles/warehouse-expansion.css';
import './styles/transport-page.css';
import './styles/asset-auctions.css';
import './styles/contracts.css';
import './styles/bank.css';
import './styles/gem-shop.css';
import './styles/unified-market-admin.css';
import './styles/admin-navigation.css';
import './styles/admin-overview-density.css';
import './styles/admin-player-statistics.css';
import './styles/admin-server-status.css';
import './styles/virtual-list.css';
import './styles/production-surface.css';
import './styles/regional-entity-page-title.css';
import './styles/settings.css';
import './styles/overview-polish.css';
import './styles/market-page-polish.css';
import './styles/province-page.css';
import './styles/leaderboards.css';
import './styles/product-artwork.css';
import './styles/facility-artwork.css';
import './styles/design-system.css';
import './styles/interaction-states.css';
import './styles/primary-surfaces.css';
import './styles/auth.css';
import './styles/registration-auth.css';
import './styles/form-controls.css';
import './styles/market-desktop-cleanup.css';
import './styles/notification-center.css';
import './styles/province-map.css';
import './styles/strategic-game-shell.css';
import './styles/strategic-outliner.css';
import './styles/mobile-detail-sheet.css';
import './styles/scrolling-page-sections.css';
import './styles/mobile-status-layout.css';
import './styles/market-detail-direct-flow.css';
import './styles/global-facility-narrow.css';
import './styles/strategic-map-rendering.css';

installIdempotentGameWriteFetch();
configureRuntimePerformance();

const initialPath = window.location.pathname.replace(/\/+$/, '');
const initialLocalGamePreview = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('preview') === 'game';
document.documentElement.dataset.appSurface = 'loading';
document.documentElement.dataset.appBackdrop = initialLocalGamePreview
  ? 'game'
  : initialPath === '/economy/admin'
    ? 'admin'
    : 'auth';
document.documentElement.dataset.appTone = 'normal';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ApplicationLayerRoot>
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>
  </ApplicationLayerRoot>,
);
