import type { FocusEvent, ReactNode } from 'react';
import { BRAND_LOGO_URL } from '../../config/brand';
import { ScrollArea } from '../ui/ScrollArea';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function SidebarFrame({
  title,
  subtitle,
  navLabel,
  collapsed,
  className = '',
  onToggleCollapsed,
  children,
  footer,
  showIdentity = true,
}: {
  title: string;
  subtitle: string;
  navLabel: string;
  collapsed: boolean;
  className?: string;
  onToggleCollapsed: () => void;
  children: ReactNode;
  footer: ReactNode;
  showIdentity?: boolean;
}) {
  const expand = () => {
    if (collapsed) onToggleCollapsed();
  };
  const collapse = () => {
    if (!collapsed) onToggleCollapsed();
  };
  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) collapse();
  };

  return (
    <aside
      className={classNames('sidebar desktop-sidebar panel', className)}
      data-collapsed={collapsed ? 'true' : 'false'}
      onMouseEnter={expand}
      onMouseLeave={collapse}
      onFocusCapture={expand}
      onBlurCapture={handleBlur}
    >
      {showIdentity ? (
        <div className="sidebar-brand">
          <div className="sidebar-logo-slot">
            <img className="sidebar-brand-logo" src={BRAND_LOGO_URL} alt="" aria-hidden="true" />
          </div>
          <div className="sidebar-brand-copy" aria-hidden={collapsed}>
            <strong>{title}</strong>
            <span title={subtitle}>{subtitle}</span>
          </div>
        </div>
      ) : null}

      <nav className="sidebar-nav-frame" aria-label={navLabel}>
        <ScrollArea axis="y" className="sidebar-nav-scroll-area" viewportClassName="sidebar-nav">
          {children}
        </ScrollArea>
      </nav>

      <div className="sidebar-footer">{footer}</div>
    </aside>
  );
}
