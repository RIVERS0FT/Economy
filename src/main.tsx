import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { configureRuntimePerformance } from './utils/runtimePerformance';
import './styles/globals.css';
import './styles/performance.css';
import './styles/viewport.css';
import './styles/auth.css';
import './styles/card-system.css';
import './styles/mobile-status-navigation.css';
import './styles/mobile-pages.css';
import './styles/mobile-status-layout.css';

configureRuntimePerformance();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
