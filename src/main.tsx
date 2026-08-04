import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import './app/interactionBootstrap';
import { FinancialBackdrop } from './components/visual/FinancialBackdrop';
import { configureRuntimePerformance } from './utils/runtimePerformance';
import './styles/app.css';

configureRuntimePerformance();

const initialPath = window.location.pathname.replace(/\/+$/, '');
document.documentElement.dataset.appSurface = 'loading';
document.documentElement.dataset.appBackdrop = initialPath === '/economy/admin' ? 'admin' : 'auth';
document.documentElement.dataset.appTone = 'normal';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <>
    <FinancialBackdrop />
    <div className="application-content-root">
      <React.StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </React.StrictMode>
    </div>
  </>,
);
