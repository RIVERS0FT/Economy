import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { configureRuntimePerformance } from './utils/runtimePerformance';
import './styles/globals.css';
import './styles/performance.css';
import './styles/viewport.css';
import './styles/login-mobile.css';

const ORIGINAL_LOGO_URL = 'https://riversoft.top/1000002880.png';
const LOGIN_SLOGAN = '从一枚货币开始，建立你的金融帝国。';
const LOGIN_DISCLAIMER = '账号认证由统一账号服务处理，金融帝国不保存你的密码。';

function BrandSynchronizer() {
  useEffect(() => {
    const applyBranding = () => {
      const brandLockup = document.querySelector<HTMLElement>('.brand-lockup');
      if (brandLockup && !brandLockup.querySelector('img')) {
        const logo = document.createElement('img');
        logo.src = ORIGINAL_LOGO_URL;
        logo.alt = '';
        logo.setAttribute('aria-hidden', 'true');
        brandLockup.prepend(logo);
      }

      const headline = document.querySelector<HTMLHeadingElement>('.login-brand h1');
      if (headline && headline.textContent !== LOGIN_SLOGAN) {
        headline.textContent = LOGIN_SLOGAN;
      }

      const disclaimer = document.querySelector<HTMLElement>('.login-card > small');
      if (disclaimer?.textContent?.trim() === LOGIN_DISCLAIMER) {
        disclaimer.remove();
      }

      const sidebarBrand = document.querySelector<HTMLElement>('.sidebar-brand');
      if (sidebarBrand && !sidebarBrand.querySelector('img')) {
        const placeholder = sidebarBrand.querySelector<HTMLElement>(':scope > .player-avatar');
        const logo = document.createElement('img');
        logo.src = ORIGINAL_LOGO_URL;
        logo.alt = '';
        logo.setAttribute('aria-hidden', 'true');
        if (placeholder) placeholder.replaceWith(logo);
        else sidebarBrand.prepend(logo);
      }
    };

    applyBranding();
    const root = document.getElementById('root');
    if (!root) return undefined;

    const observer = new MutationObserver(applyBranding);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}

configureRuntimePerformance();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrandSynchronizer />
    <App />
  </React.StrictMode>,
);
