import React, { useLayoutEffect } from 'react';
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
const LOGIN_BUTTON_COPY = '登录或注册';
const LOGIN_INTRO_COPY = [
  ['.login-card > .eyebrow', 'Account login'],
  ['.login-card > h2', '登录金融帝国'],
  ['.login-card > .muted', '使用已注册账号进入市场。'],
] as const;

function BrandSynchronizer() {
  useLayoutEffect(() => {
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

function LoginKeyboardDock() {
  useLayoutEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 720px)');
    const visualViewport = window.visualViewport;
    let animationFrame = 0;
    let blurTimer = 0;

    const getActiveLoginInput = () => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLInputElement)) return null;
      return activeElement.closest('.login-form') ? activeElement : null;
    };

    const clearDock = (shell?: HTMLElement | null) => {
      const loginShell = shell ?? document.querySelector<HTMLElement>('.login-shell');
      if (!loginShell) return;

      loginShell.removeAttribute('data-keyboard-docked');
      loginShell.style.removeProperty('--login-keyboard-inset');
      loginShell.scrollTop = 0;
    };

    const syncDock = () => {
      const loginShell = document.querySelector<HTMLElement>('.login-shell');
      const activeInput = getActiveLoginInput();

      if (!loginShell || !activeInput || !mobileQuery.matches) {
        clearDock(loginShell);
        return;
      }

      const layoutHeight = document.documentElement.clientHeight;
      const visibleHeight = visualViewport?.height ?? window.innerHeight;
      const viewportOffsetTop = visualViewport?.offsetTop ?? 0;
      const measuredInset = Math.max(0, layoutHeight - visibleHeight - viewportOffsetTop);
      const keyboardInset = Math.min(measuredInset, layoutHeight * 0.65);

      loginShell.dataset.keyboardDocked = 'true';
      loginShell.style.setProperty('--login-keyboard-inset', `${Math.round(keyboardInset)}px`);
      loginShell.scrollTop = 0;
    };

    const scheduleSync = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(syncDock);
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.closest('.login-form')) return;

      window.clearTimeout(blurTimer);
      scheduleSync();
    };

    const handleFocusOut = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(scheduleSync, 0);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.addEventListener('resize', scheduleSync);
    visualViewport?.addEventListener('resize', scheduleSync);
    visualViewport?.addEventListener('scroll', scheduleSync);
    mobileQuery.addEventListener('change', scheduleSync);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('resize', scheduleSync);
      visualViewport?.removeEventListener('resize', scheduleSync);
      visualViewport?.removeEventListener('scroll', scheduleSync);
      mobileQuery.removeEventListener('change', scheduleSync);
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(blurTimer);
      clearDock();
    };
  }, []);

  return null;
}

configureRuntimePerformance();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrandSynchronizer />
    <LoginKeyboardDock />
    <App />
  </React.StrictMode>,
);
