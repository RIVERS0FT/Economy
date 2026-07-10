import type { ReactNode } from 'react';

export interface StatusBarItem {
  id: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  emphasis?: 'primary' | 'market';
}

export function StatusBar({ items }: { items: StatusBarItem[] }) {
  return (
    <header className="asset-bar panel" aria-label="玩家状态">
      {items.map((item) => {
        const classNames = ['asset-bar-item'];
        if (item.emphasis === 'primary') classNames.push('primary');
        if (item.emphasis === 'market') classNames.push('market-ticker');
        return (
          <div className={classNames.join(' ')} key={item.id}>
            <span className="asset-bar-item-icon" aria-hidden="true">{item.icon}</span>
            <span className="asset-bar-item-label">{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail ? <small>{item.detail}</small> : null}
          </div>
        );
      })}
    </header>
  );
}
