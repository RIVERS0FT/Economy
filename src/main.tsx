import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { configureRuntimePerformance } from './utils/runtimePerformance';
import './styles/globals.css';
import './styles/desktop-sidebar.css';
import './styles/performance.css';
import './styles/viewport.css';
import './styles/auth.css';
import './styles/card-system.css';
import './styles/liquid-glass-chrome.css';
import './styles/mobile-status-navigation.css';
import './styles/mobile-interaction.css';
import './styles/mobile-pages.css';
import './styles/mobile-status-layout.css';
import './styles/icon-system.css';
import './styles/overview.css';
import './styles/industry-system.css';
import './styles/facility-production-formula.css';
import './styles/facility-group-card-grid.css';
import './styles/market-funds.css';
import './styles/warehouse-expansion.css';
import './styles/collectibles-auctions.css';
import './styles/unified-market-admin.css';
import './styles/virtual-list.css';
import './styles/design-system.css';

configureRuntimePerformance();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
