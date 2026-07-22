import { LiquidGlassSurface } from '../ui/LiquidGlassSurface';
import { Button } from '../ui/layout';

export function AdminDesktopBar({
  title,
  description,
  email,
  worldVersion,
  apiStatus,
  onRefresh,
}: {
  title: string;
  description: string;
  email: string;
  worldVersion?: number;
  apiStatus?: string;
  onRefresh: () => void;
}) {
  return (
    <header className="asset-bar admin-command-bar" aria-label="管理员工作栏">
      <LiquidGlassSurface variant="desktopStatusBar">
        <div className="admin-command-bar-content">
          <div className="admin-command-bar-copy">
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="admin-command-bar-actions">
            <span title={email}>{email}</span>
            <small>
              世界版本 {worldVersion ?? '—'} · API {apiStatus ?? '—'}
            </small>
            <Button variant="secondary" onClick={onRefresh}>刷新当前分区</Button>
          </div>
        </div>
      </LiquidGlassSurface>
    </header>
  );
}
