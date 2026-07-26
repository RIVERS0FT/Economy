import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { LiquidGlassSurface, type LiquidGlassSurfaceVariant } from '../ui/LiquidGlassSurface';

export interface StatusBarItem {
  id: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  compactValue?: ReactNode;
  detail?: ReactNode;
  emphasis?: 'primary' | 'market';
  onClick?: () => void;
}

const MOBILE_STATUS_MEDIA_QUERY = '(max-width: 720px)';
const MOBILE_STATUS_MIN_FONT_SIZE_REM = 0.56;
const STATUS_VALUE_WIDTH_SAFETY = 0.98;
const STATUS_VALUE_SELECTOR = '.asset-bar-item-value';
const STATUS_VALUE_VARIANT_SELECTOR = '.asset-bar-item-value-full, .asset-bar-item-value-compact';
type StatusBarSurfaceVariant = Extract<LiquidGlassSurfaceVariant, 'desktopStatusBar' | 'mobileStatusBar'>;

function resolveStatusBarSurfaceVariant(): StatusBarSurfaceVariant {
  if (typeof window === 'undefined') return 'desktopStatusBar';
  return window.matchMedia(MOBILE_STATUS_MEDIA_QUERY).matches ? 'mobileStatusBar' : 'desktopStatusBar';
}

function useStatusBarSurfaceVariant() {
  const [variant, setVariant] = useState<StatusBarSurfaceVariant>(resolveStatusBarSurfaceVariant);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_STATUS_MEDIA_QUERY);
    const updateVariant = () => setVariant(mediaQuery.matches ? 'mobileStatusBar' : 'desktopStatusBar');
    updateVariant();
    mediaQuery.addEventListener('change', updateVariant);
    return () => mediaQuery.removeEventListener('change', updateVariant);
  }, []);

  return variant;
}

function visibleStatusValue(valueElement: HTMLElement) {
  return Array.from(valueElement.querySelectorAll<HTMLElement>(STATUS_VALUE_VARIANT_SELECTOR))
    .find((candidate) => getComputedStyle(candidate).display !== 'none');
}

function fitStatusBarValues(contentElement: HTMLDivElement, mobile: boolean) {
  const valueElements = Array.from(contentElement.querySelectorAll<HTMLElement>(STATUS_VALUE_SELECTOR));
  contentElement.dataset.statusValuesFitted = 'false';

  valueElements.forEach((valueElement) => {
    valueElement.style.removeProperty('--mobile-status-value-font-size');
    valueElement.dataset.statusValueFitted = 'false';
  });

  if (!mobile) {
    contentElement.dataset.statusValuesFitted = 'true';
    return;
  }

  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const minimumFontSize = rootFontSize * MOBILE_STATUS_MIN_FONT_SIZE_REM;

  valueElements.forEach((valueElement) => {
    const visibleValue = visibleStatusValue(valueElement);
    if (!visibleValue) return;

    const availableWidth = valueElement.clientWidth;
    const naturalWidth = visibleValue.getBoundingClientRect().width;
    const baseFontSize = Number.parseFloat(getComputedStyle(valueElement).fontSize);
    if (!Number.isFinite(baseFontSize) || availableWidth <= 0 || naturalWidth <= availableWidth + 0.5) return;

    const fittedFontSize = Math.max(
      minimumFontSize,
      Math.min(baseFontSize, baseFontSize * (availableWidth / naturalWidth) * STATUS_VALUE_WIDTH_SAFETY),
    );
    if (fittedFontSize >= baseFontSize - 0.01) return;

    valueElement.style.setProperty('--mobile-status-value-font-size', `${fittedFontSize.toFixed(3)}px`);
    valueElement.dataset.statusValueFitted = 'true';
  });

  contentElement.dataset.statusValuesFitted = 'true';
}

function useMobileStatusValueFit(items: StatusBarItem[]) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scheduleFitRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return undefined;

    const mediaQuery = window.matchMedia(MOBILE_STATUS_MEDIA_QUERY);
    let animationFrame = 0;
    let active = true;

    const fitValues = () => {
      if (!active) return;
      animationFrame = 0;
      fitStatusBarValues(contentElement, mediaQuery.matches);
    };
    const scheduleFit = () => {
      if (!active) return;
      contentElement.dataset.statusValuesFitted = 'false';
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(fitValues);
    };
    scheduleFitRef.current = scheduleFit;

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleFit);
    resizeObserver?.observe(contentElement);
    contentElement.querySelectorAll<HTMLElement>(STATUS_VALUE_SELECTOR)
      .forEach((valueElement) => resizeObserver?.observe(valueElement));
    mediaQuery.addEventListener('change', scheduleFit);
    window.addEventListener('orientationchange', scheduleFit);
    fitValues();

    if ('fonts' in document) void document.fonts.ready.then(scheduleFit);

    return () => {
      active = false;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      mediaQuery.removeEventListener('change', scheduleFit);
      window.removeEventListener('orientationchange', scheduleFit);
      scheduleFitRef.current = () => {};
    };
  }, []);

  useLayoutEffect(() => {
    scheduleFitRef.current();
  }, [items]);

  return contentRef;
}

export function StatusBar({ items }: { items: StatusBarItem[] }) {
  const surfaceVariant = useStatusBarSurfaceVariant();
  const contentRef = useMobileStatusValueFit(items);

  return (
    <header className="asset-bar" aria-label="玩家状态">
      <LiquidGlassSurface variant={surfaceVariant}>
        <div className="asset-bar-content" ref={contentRef}>
          {items.map((item) => {
            const classNames = ['asset-bar-item'];
            if (item.emphasis === 'primary') classNames.push('primary');
            if (item.emphasis === 'market') classNames.push('market-ticker');
            if (item.onClick) classNames.push('asset-bar-item--interactive');
            const content = (
              <>
                <span className="asset-bar-item-icon" aria-hidden="true">{item.icon}</span>
                <span className="asset-bar-item-label">{item.label}</span>
                <strong className="asset-bar-item-value">
                  <span className="asset-bar-item-value-full">{item.value}</span>
                  <span className="asset-bar-item-value-compact">{item.compactValue ?? item.value}</span>
                </strong>
                {item.detail ? <small>{item.detail}</small> : null}
              </>
            );

            return item.onClick ? (
              <button
                type="button"
                className={classNames.join(' ')}
                key={item.id}
                aria-label={`${item.label}，打开详情`}
                onClick={item.onClick}
              >
                {content}
              </button>
            ) : (
              <div
                className={classNames.join(' ')}
                key={item.id}
                role="group"
                aria-label={item.label}
              >
                {content}
              </div>
            );
          })}
        </div>
      </LiquidGlassSurface>
    </header>
  );
}
