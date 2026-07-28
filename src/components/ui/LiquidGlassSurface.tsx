import LiquidGlass from 'liquid-glass-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export type LiquidGlassSurfaceVariant =
  | 'desktopStatusBar'
  | 'mobileStatusBar'
  | 'mobileNavigation'
  | 'desktopAuthCard'
  | 'mobileAuthCard';

export type LiquidGlassSurfaceLayout = 'fixed' | 'content';

interface LiquidGlassSurfaceProps {
  variant: LiquidGlassSurfaceVariant;
  children: ReactNode;
  className?: string;
  layout?: LiquidGlassSurfaceLayout;
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

const DESKTOP_AUTH_CARD_GLASS = {
  displacementScale: 16,
  blurAmount: 0.12,
  saturation: 118,
  aberrationIntensity: 0.1,
  cornerRadius: 24,
  mode: 'standard',
} as const;

const MOBILE_AUTH_CARD_GLASS = {
  displacementScale: 12,
  blurAmount: 0.1,
  saturation: 115,
  aberrationIntensity: 0.08,
  cornerRadius: 40,
  mode: 'standard',
} as const;

const PRESETS = {
  desktopStatusBar: DESKTOP_STATUS_GLASS,
  mobileStatusBar: MOBILE_CHROME_GLASS,
  mobileNavigation: MOBILE_CHROME_GLASS,
  desktopAuthCard: DESKTOP_AUTH_CARD_GLASS,
  mobileAuthCard: MOBILE_AUTH_CARD_GLASS,
} as const;

function GlassEffect({
  variant,
  revision,
  content,
}: {
  variant: LiquidGlassSurfaceVariant;
  revision: number;
  content: ReactNode;
}) {
  const preset = PRESETS[variant];
  return (
    <LiquidGlass
      key={`${variant}-${revision}`}
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
      {content}
    </LiquidGlass>
  );
}

export function LiquidGlassSurface({
  variant,
  children,
  className = '',
  layout = 'fixed',
}: LiquidGlassSurfaceProps) {
  const preset = PRESETS[variant];
  const contentRef = useRef<HTMLDivElement>(null);
  const [surfaceRevision, setSurfaceRevision] = useState(0);
  const classes = ['liquid-glass-surface', `liquid-glass-surface--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (layout !== 'content' || !contentRef.current || typeof ResizeObserver === 'undefined') return undefined;
    let previousWidth = -1;
    let previousHeight = -1;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width * 10) / 10;
      const height = Math.round(entry.contentRect.height * 10) / 10;
      if (width === previousWidth && height === previousHeight) return;
      previousWidth = width;
      previousHeight = height;
      setSurfaceRevision((current) => current + 1);
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [layout]);

  if (layout === 'content') {
    return (
      <div
        className={classes}
        data-liquid-glass-variant={variant}
        data-liquid-glass-mode={preset.mode}
        data-liquid-glass-layout="content"
      >
        <GlassEffect
          variant={variant}
          revision={surfaceRevision}
          content={<div className="liquid-glass-surface__material-fill" aria-hidden="true" />}
        />
        <div ref={contentRef} className="liquid-glass-surface__content">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={classes}
      data-liquid-glass-variant={variant}
      data-liquid-glass-mode={preset.mode}
      data-liquid-glass-layout="fixed"
    >
      <GlassEffect
        variant={variant}
        revision={0}
        content={<div className="liquid-glass-surface__content">{children}</div>}
      />
    </div>
  );
}
