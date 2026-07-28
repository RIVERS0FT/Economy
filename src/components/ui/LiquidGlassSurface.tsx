import LiquidGlass from 'liquid-glass-react';
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

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
  content,
  contentRef,
}: {
  variant: LiquidGlassSurfaceVariant;
  content: ReactNode;
  contentRef?: RefObject<HTMLDivElement>;
}) {
  const preset = PRESETS[variant];
  return (
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
      <div ref={contentRef} className="liquid-glass-surface__content">{content}</div>
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
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const classes = ['liquid-glass-surface', `liquid-glass-surface--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  useLayoutEffect(() => {
    if (layout !== 'content' || !contentRef.current) return undefined;
    const contentElement = contentRef.current;
    let measurementFrame = 0;
    let glassResizeFrame = 0;
    let previousHeight = -1;

    const notifyGlassResize = () => {
      if (glassResizeFrame) cancelAnimationFrame(glassResizeFrame);
      glassResizeFrame = requestAnimationFrame(() => {
        glassResizeFrame = 0;
        window.dispatchEvent(new Event('resize'));
      });
    };

    const measure = () => {
      measurementFrame = 0;
      const nextHeight = Math.ceil(Math.max(
        contentElement.scrollHeight,
        contentElement.getBoundingClientRect().height,
      ));
      if (nextHeight <= 0 || nextHeight === previousHeight) return;
      previousHeight = nextHeight;
      setContentHeight(nextHeight);
      notifyGlassResize();
    };

    const scheduleMeasure = () => {
      if (measurementFrame) cancelAnimationFrame(measurementFrame);
      measurementFrame = requestAnimationFrame(measure);
    };

    measure();
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(contentElement);
    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(scheduleMeasure);
    mutationObserver?.observe(contentElement, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      if (measurementFrame) cancelAnimationFrame(measurementFrame);
      if (glassResizeFrame) cancelAnimationFrame(glassResizeFrame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [layout, variant]);

  return (
    <div
      className={classes}
      data-liquid-glass-variant={variant}
      data-liquid-glass-mode={preset.mode}
      data-liquid-glass-layout={layout}
      style={layout === 'content' ? { height: `${contentHeight ?? 1}px` } : undefined}
    >
      <GlassEffect
        variant={variant}
        content={children}
        contentRef={layout === 'content' ? contentRef : undefined}
      />
    </div>
  );
}
