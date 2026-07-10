import React, { useLayoutEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { configureRuntimePerformance } from './utils/runtimePerformance';
import './styles/globals.css';
import './styles/performance.css';
import './styles/viewport.css';
import './styles/auth.css';
import './styles/card-system.css';
import './styles/mobile-status-navigation.css';

const ORIGINAL_LOGO_URL = 'https://riversoft.top/1000002880.png';
const LOGIN_SLOGAN = '从一枚货币开始，建立你的金融帝国。';
const LOGIN_DISCLAIMER = '账号认证由统一账号服务处理，金融帝国不保存你的密码。';
const LOGIN_BUTTON_COPY = '登录或注册';
const LOGIN_INTRO_COPY = [
  ['.login-card > .eyebrow', 'Account login'],
  ['.login-card > h2', '登录金融帝国'],
  ['.login-card > .muted', '使用已注册账号进入市场。'],
] as const;
const NAVIGATION_LABEL_COPY: Readonly<Record<string, string>> = {
  主页面: '概览',
  排行榜: '排行',
  订单与记录: '订单',
};

type AppSurface = 'loading' | 'auth' | 'game';

function AppSurfaceController() {
  useLayoutEffect(() => {
    const root = document.getElementById('root');
    if (!root) return undefined;

    const synchronizeSurface = () => {
      const surface: AppSurface = document.querySelector('.game-shell')
        ? 'game'
        : document.querySelector('.login-shell')
          ? 'auth'
          : 'loading';

      document.documentElement.dataset.appSurface = surface;

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

      LOGIN_INTRO_COPY.forEach(([selector, copy]) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (element?.textContent?.trim() === copy) {
          element.remove();
        }
      });

      const loginButton = document.querySelector<HTMLButtonElement>('.login-form button[type="submit"]');
      if (loginButton && !loginButton.disabled && loginButton.textContent?.trim() !== LOGIN_BUTTON_COPY) {
        loginButton.textContent = LOGIN_BUTTON_COPY;
      }

      document.querySelector<HTMLElement>('.login-links')?.remove();

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

      document.querySelectorAll<HTMLButtonElement>('.sidebar-nav-button').forEach((button) => {
        const label = button.querySelector<HTMLElement>('strong');
        const currentCopy = label?.textContent?.trim();
        const nextCopy = currentCopy ? NAVIGATION_LABEL_COPY[currentCopy] : undefined;
        if (!label || !nextCopy) return;
        label.textContent = nextCopy;
        button.setAttribute('aria-label', nextCopy);
      });
    };

    synchronizeSurface();

    const observer = new MutationObserver(synchronizeSurface);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      delete document.documentElement.dataset.appSurface;
    };
  }, []);

  return null;
}

configureRuntimePerformance();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppSurfaceController />
    <App />
  </React.StrictMode>,
);
