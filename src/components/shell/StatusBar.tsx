import type { ReactNode } from 'react';
import { LiquidGlassSurface } from '../ui/LiquidGlassSurface';

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

export function StatusBar({ items }: { items: StatusBarItem[] }) {
  return (
    <header className="asset-bar" aria-label="玩家状态">
      <LiquidGlassSurface variant="statusBar">
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
    </header>
  );
}
