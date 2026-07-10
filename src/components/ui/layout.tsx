import type { ReactNode } from 'react';

export function PageLayout({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="page-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className="page-heading-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <article className={`panel ${className}`.trim()}>{children}</article>;
}

export function WidgetHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="widget-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action ?? null}
    </div>
  );
}

export function ScrollableTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`table-wrap ${className}`.trim()}>{children}</div>;
}

export function EmptyState({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`empty-state ${className}`.trim()}>{children}</div>;
}
