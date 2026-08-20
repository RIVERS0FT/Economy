import { RefreshIcon } from '../icons/GameIcons';

export function RefreshPageButton({ className = '' }: { className?: string }) {
  const classes = ['browser-refresh-button', className].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={classes}
      data-ui-interactive="surface"
      aria-label="刷新页面"
      title="刷新页面"
      onClick={() => window.location.reload()}
    >
      <RefreshIcon />
    </button>
  );
}
