import LiquidGlass from 'liquid-glass-react';
import type { ReactNode } from 'react';

export type LiquidGlassSurfaceVariant = 'desktopStatusBar' | 'mobileStatusBar' | 'mobileNavigation';

interface LiquidGlassSurfaceProps {
  variant: LiquidGlassSurfaceVariant;
  children: ReactNode;
  className?: string;
}

const STATIC_MOUSE_POSITION = { x: 0, y: 0 };
const STATIC_MOUSE_OFFSET = { x: 0, y: 0 };

const DESKTOP_STATUS_GLASS = {
  displacementScale: 20,
  blurAmount: 0.0625,
  saturation: 120,
  aberrationIntensity: 0.15,
  cornerRadius: 24,
  mode: 'standard',
} as const;

const MOBILE_CHROME_GLASS = {
  displacementScale: 32,
  blurAmount: 0.1,
  saturation: 125,
  aberrationIntensity: 0.3,
  cornerRadius: 40,
  mode: 'standard',
} as const;

const PRESETS = {
  desktopStatusBar: DESKTOP_STATUS_GLASS,
  mobileStatusBar: MOBILE_CHROME_GLASS,
  mobileNavigation: MOBILE_CHROME_GLASS,
} as const;

export function LiquidGlassSurface({ variant, children, className = '' }: LiquidGlassSurfaceProps) {
  const preset = PRESETS[variant];
  const classes = ['liquid-glass-surface', `liquid-glass-surface--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} data-liquid-glass-variant={variant} data-liquid-glass-mode={preset.mode}>
      <LiquidGlass
        className="liquid-glass-surface__effect"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '100%',
          height: '100%',
        }}
        displacementScale={preset.displacementScale}
        blurAmount={preset.blurAmount}
        saturation={preset.saturation}
        aberrationIntensity={preset.aberrationIntensity}
        elasticity={0}
        cornerRadius={preset.cornerRadius}
        padding="0"
        mode={preset.mode}
        globalMousePos={STATIC_MOUSE_POSITION}
        mouseOffset={STATIC_MOUSE_OFFSET}
      >
        <div className="liquid-glass-surface__content">{children}</div>
      </LiquidGlass>
    </div>
  );
}
