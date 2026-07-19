import { useEffect, useRef, type ReactNode } from 'react';
import { BRAND_LOGO_URL } from '../../config/brand';

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
}: {
  title: string;
  subtitle: string;
  navLabel: string;
  collapsed: boolean;
  className?: string;
  onToggleCollapsed: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const previousCollapsedRef = useRef(collapsed);

  useEffect(() => {
    if (previousCollapsedRef.current === collapsed) return;
    previousCollapsedRef.current = collapsed;
    if (collapsed) expandButtonRef.current?.focus();
    else collapseButtonRef.current?.focus();
  }, [collapsed]);

  return (
    <aside
      className={classNames('sidebar desktop-sidebar panel', className)}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className="sidebar-brand">
        <div className="sidebar-logo-slot">
          <button
            ref={expandButtonRef}
            type="button"
            className="sidebar-logo-expand-button"
            aria-label="展开侧栏"
            aria-expanded="false"
            aria-hidden={!collapsed}
            tabIndex={collapsed ? 0 : -1}
            onClick={collapsed ? onToggleCollapsed : undefined}
          >
            <img src={BRAND_LOGO_URL} alt="" aria-hidden="true" />
            <span className="sidebar-logo-expand-icon" aria-hidden="true" />
          </button>
        </div>
        <div className="sidebar-brand-copy" aria-hidden={collapsed}>
          <strong>{title}</strong>
          <span title={subtitle}>{subtitle}</span>
        </div>
        <button
          ref={collapseButtonRef}
          type="button"
          className="sidebar-collapse-button"
          aria-label="折叠侧栏"
          aria-expanded="true"
          aria-hidden={collapsed}
          tabIndex={collapsed ? -1 : 0}
          onClick={collapsed ? undefined : onToggleCollapsed}
        >
          <span aria-hidden="true" />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label={navLabel}>
        {children}
      </nav>

      <div className="sidebar-footer">{footer}</div>
    </aside>
  );
}
