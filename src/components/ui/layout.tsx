import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import { ScrollArea } from './ScrollArea';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text' | 'compact';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function PageLayout({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="page-content">
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className="page-heading-actions">{actions}</div> : null}
      </div>
      <div className="ui-page-stack">
        {children}
      </div>
    </section>
  );
}

export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  const usesLegacyPrimarySurfaceSemantic = className.split(/\s+/).includes('widget');

  return (
    <article
      className={classNames(
        'panel',
        usesLegacyPrimarySurfaceSemantic && 'ui-primary-surface',
        className,
      )}
    >
      {children}
    </article>
  );
}

export function PagePanel({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <Panel className={classNames('widget', className)}>
      {children}
    </Panel>
  );
}

export function WidgetHeading({
  title,
  action,
}: {
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="widget-heading">
      <h2>{title}</h2>
      {action ?? null}
    </div>
  );
}

export function Button({
  variant = 'primary',
  block = false,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  block?: boolean;
}) {
  return (
    <button
      type={type}
      className={classNames(
        'ui-button',
        `ui-button--${variant}`,
        block && 'ui-button--block',
        className,
      )}
      {...props}
    />
  );
}

export function StatusTag({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: StatusTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={classNames('ui-status-tag', `status-${tone}`, className)}>
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <div className={classNames('ui-metric-card', `ui-metric-card--${tone}`, className)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function DataList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <dl className={classNames('ui-data-list', className)}>{children}</dl>;
}

export function DataRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <div className={classNames('ui-data-row', `ui-data-row--${tone}`)}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function SwitchControl({
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input className={classNames('ui-switch', className)} type="checkbox" {...props} />;
}

export function ToggleField({
  label,
  description,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  description: string;
}) {
  return (
    <label className={classNames('ui-toggle-field', className)}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <SwitchControl aria-label={label} {...props} />
    </label>
  );
}

export function ScrollableTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <ScrollArea
      axis="x"
      className="table-scroll-area"
      viewportClassName={classNames('table-wrap', className)}
      scrollbarVisibility="adaptive"
    >
      {children}
    </ScrollArea>
  );
}

export function EmptyState({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={classNames('empty-state', className)}>{children}</div>;
}
