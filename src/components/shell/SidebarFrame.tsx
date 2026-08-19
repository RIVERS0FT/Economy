import { useEffect, useRef, type FocusEvent, type ReactNode } from 'react';
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
  const desiredCollapsedRef = useRef(collapsed);
  const hoverIntentRef = useRef(false);

  useEffect(() => {
    desiredCollapsedRef.current = collapsed;
  }, [collapsed]);

  useEffect(() => {
    const markHoverIntent = () => { hoverIntentRef.current = true; };
    window.addEventListener('pointermove', markHoverIntent, { once: true });
    return () => window.removeEventListener('pointermove', markHoverIntent);
  }, []);

  const setCollapsed = (nextCollapsed: boolean) => {
    if (desiredCollapsedRef.current === nextCollapsed) return;
    desiredCollapsedRef.current = nextCollapsed;
    onToggleCollapsed();
  };
  const expand = (event: { type: string }) => {
    if (event.type === 'mouseenter' && !hoverIntentRef.current) return;
    setCollapsed(false);
  };
  const expandFromMove = () => {
    hoverIntentRef.current = true;
    setCollapsed(false);
  };
  const collapse = () => setCollapsed(true);
  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) collapse();
  };

  return (
    <aside
      className={classNames('sidebar desktop-sidebar panel', className)}
      data-collapsed={collapsed ? 'true' : 'false'}
      onMouseEnter={expand}
      onMouseMove={expandFromMove}
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
