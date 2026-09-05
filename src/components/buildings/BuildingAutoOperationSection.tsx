import { ProvinceAutoSaleControl } from './ProvinceAutoSaleControl';
import type { ReactNode } from 'react';
import { SwitchControl } from '../ui/layout';
import '../../styles/factory-auto-operation.css';

export function BuildingAutoOperationSection({ label, enabled, disabled, onChange, message, children, provinceId }: {
  provinceId?: string;
  label: ReactNode;
  enabled: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <section className="facility-auto-operation mobile-detail-section" aria-label="自动经营">
      <div className="facility-auto-operation__header">
        <strong>{label}</strong>
        <SwitchControl checked={enabled} aria-label={enabled ? '关闭自动经营' : '开启自动经营'}
          disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      </div>
      {children}
      {provinceId ? <ProvinceAutoSaleControl provinceId={provinceId} /> : null}
      {message ? <small className="facility-auto-operation__message" role="status">{message}</small> : null}
    </section>
  );
}
