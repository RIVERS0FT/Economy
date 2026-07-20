import { useEffect, useState, type ReactNode } from 'react';
import { LiquidGlassSurface, type LiquidGlassSurfaceVariant } from '../ui/LiquidGlassSurface';
import { ScrollArea } from '../ui/ScrollArea';

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

export function StatusBar({ items }: { items: StatusBarItem[] }) {
  const surfaceVariant = useStatusBarSurfaceVariant();

  return (
    <header className="asset-bar-scroll-area" aria-label="玩家状态">
      <ScrollArea
        axis="x"
        className="asset-bar-scroll-track"
        viewportClassName="asset-bar"
        horizontalVisibility="always"
      >
        <LiquidGlassSurface variant={surfaceVariant}>
          <div className="asset-bar-content">
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
      </ScrollArea>
    </header>
  );
}
