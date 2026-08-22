import { useLayoutEffect, useRef, type FocusEvent, type ReactNode } from 'react';
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
  const foregroundIntentRef = useRef(false);
  const onToggleCollapsedRef = useRef(onToggleCollapsed);

  useLayoutEffect(() => {
    desiredCollapsedRef.current = collapsed;
  }, [collapsed]);

  useLayoutEffect(() => {
    onToggleCollapsedRef.current = onToggleCollapsed;
  }, [onToggleCollapsed]);

  useLayoutEffect(() => {
    hoverIntentRef.current = false;
    foregroundIntentRef.current = false;

    const markPointerIntent = () => {
      hoverIntentRef.current = true;
      foregroundIntentRef.current = true;
    };
    const markKeyboardIntent = (event: KeyboardEvent) => {
      if (event.key === 'Tab') foregroundIntentRef.current = true;
    };
    const markPointerDownIntent = () => {
      foregroundIntentRef.current = true;
    };
    const suspendInteraction = () => {
      hoverIntentRef.current = false;
      foregroundIntentRef.current = false;
      if (desiredCollapsedRef.current) return;
      desiredCollapsedRef.current = true;
      onToggleCollapsedRef.current();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') suspendInteraction();
    };

    window.addEventListener('pointermove', markPointerIntent, { capture: true, passive: true });
    window.addEventListener('keydown', markKeyboardIntent, { capture: true });
    window.addEventListener('pointerdown', markPointerDownIntent, { capture: true, passive: true });
    window.addEventListener('blur', suspendInteraction);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pointermove', markPointerIntent, true);
      window.removeEventListener('keydown', markKeyboardIntent, true);
      window.removeEventListener('pointerdown', markPointerDownIntent, true);
      window.removeEventListener('blur', suspendInteraction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const setCollapsed = (nextCollapsed: boolean) => {
    if (desiredCollapsedRef.current === nextCollapsed) return;
    desiredCollapsedRef.current = nextCollapsed;
    onToggleCollapsedRef.current();
  };
  const expand = (event: { type: string }) => {
    if (event.type === 'mouseenter' && !hoverIntentRef.current) return;
    if (event.type === 'focus' && !foregroundIntentRef.current) return;
    setCollapsed(false);
  };
  const expandFromMove = () => {
    hoverIntentRef.current = true;
    foregroundIntentRef.current = true;
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
