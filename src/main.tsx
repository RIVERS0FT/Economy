import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { configureRuntimePerformance } from './utils/runtimePerformance';
import './styles/globals.css';
import './styles/performance.css';

configureRuntimePerformance();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
