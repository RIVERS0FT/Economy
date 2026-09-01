type OperationMethodIconProps = {
  iconId: string;
  className?: string;
};

function iconPaths(iconId: string) {
  if (/field|orchard|pasture|forest/.test(iconId)) return (
    <>
      <path d="M4 20c4-7 8-10 16-12-1 8-5 12-12 12H4Z" />
      <path d="M8 17c3-3 6-5 10-7M12 14v6" />
    </>
  );
  if (/fish|water/.test(iconId)) return (
    <>
      <path d="M4 12c3-4 7-6 12-4l4-3v14l-4-3c-5 2-9 0-12-4Z" />
      <circle cx="13" cy="11" r="1" />
      <path d="M5 17c2 1 4 1 6 0s4-1 6 0" />
    </>
  );
  if (/mine|drill|blast|rig|pump|distillation|refinery/.test(iconId)) return (
    <>
      <path d="M4 20h16M6 20V9h5v11M13 20V5h5v15" />
      <path d="M8 6h8M15 8l3 3M7 13h3M14 14h3" />
    </>
  );
  if (/loom|textile|sewing|cutting/.test(iconId)) return (
    <>
      <path d="M5 5v14M19 5v14M5 8h14M5 16h14" />
      <path d="m8 8 3 8 3-8 2 8" />
    </>
  );
  if (/food|beverage|bottle|medicine/.test(iconId)) return (
    <>
      <path d="M9 4h6v4l2 3v9H7v-9l2-3V4Z" />
      <path d="M9 13h8M11 4h2" />
      <circle cx="12" cy="16" r="1.5" />
    </>
  );
  if (/paper|pulp/.test(iconId)) return (
    <>
      <path d="M6 3h9l3 3v15H6V3Z" />
      <path d="M15 3v4h4M9 11h6M9 15h6M9 19h4" />
    </>
  );
  if (/reactor|fertilizer|chemical|granulation|cold|heat/.test(iconId)) return (
    <>
      <path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-9V3" />
      <path d="M7 16h10M9 13h6" />
    </>
  );
  if (/saw|woodwork|pruning|tool|forge|millstone|roller/.test(iconId)) return (
    <>
      <path d="m4 17 9-9 3 3-9 9H4v-3Z" />
      <path d="m13 8 2-3 4 4-3 2M9 16l2 2M12 13l2 2" />
    </>
  );
  if (/circuit|chip|solder|cleanroom|appliance|module/.test(iconId)) return (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M18 9h3M3 15h3M18 15h3" />
      <path d="M10 10h4v4h-4z" />
    </>
  );
  if (/tractor|machine|gear|conveyor|assembly|robot|factory|mixer/.test(iconId)) return (
    <>
      <circle cx="8" cy="17" r="3" />
      <circle cx="18" cy="17" r="2" />
      <path d="M5 17H3v-5h9l2-5h4v7h3v3h-1M11 17h5M14 10h4" />
    </>
  );
  return (
    <>
      <path d="M4 20V9l5 3V8l5 3V5l6 4v11H4Z" />
      <path d="M8 16h2M14 16h2" />
    </>
  );
}

export function OperationMethodIcon({ iconId, className }: OperationMethodIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ? `game-icon ${className}` : 'game-icon'}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths(iconId)}
    </svg>
  );
}
