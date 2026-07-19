import LiquidGlass from 'liquid-glass-react';
import type { ReactNode } from 'react';

export type LiquidGlassSurfaceVariant = 'statusBar' | 'mobileNavigation';

interface LiquidGlassSurfaceProps {
  variant: LiquidGlassSurfaceVariant;
  children: ReactNode;
  className?: string;
}

const STATIC_MOUSE_POSITION = { x: 0, y: 0 };
const STATIC_MOUSE_OFFSET = { x: 0, y: 0 };

const PRESETS = {
  statusBar: {
    displacementScale: 28,
    blurAmount: 0.6875,
    saturation: 145,
    aberrationIntensity: 0.8,
    cornerRadius: 18,
  },
  mobileNavigation: {
    displacementScale: 20,
    blurAmount: 0.5,
    saturation: 145,
    aberrationIntensity: 0.5,
    cornerRadius: 20,
  },
} as const;

export function LiquidGlassSurface({ variant, children, className = '' }: LiquidGlassSurfaceProps) {
  const preset = PRESETS[variant];
  const classes = ['liquid-glass-surface', `liquid-glass-surface--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} data-liquid-glass-variant={variant}>
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
        mode="standard"
        globalMousePos={STATIC_MOUSE_POSITION}
        mouseOffset={STATIC_MOUSE_OFFSET}
      >
        <div className="liquid-glass-surface__content">{children}</div>
      </LiquidGlass>
    </div>
  );
}
