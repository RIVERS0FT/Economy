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
  elasticity: 0,
  cornerRadius: 24,
  mode: 'standard',
} as const;

const MOBILE_CHROME_GLASS = {
  displacementScale: 32,
  blurAmount: 0.1,
  saturation: 125,
  aberrationIntensity: 0.3,
  elasticity: 0,
  cornerRadius: 40,
  mode: 'standard',
} as const;

const DESKTOP_AUTH_CARD_GLASS = {
  displacementScale: 70,
  blurAmount: 0.0625,
  saturation: 140,
  aberrationIntensity: 2,
  elasticity: 0,
  cornerRadius: 24,
  mode: 'standard',
} as const;

const MOBILE_AUTH_CARD_GLASS = {
  displacementScale: 70,
  blurAmount: 0.0625,
  saturation: 140,
  aberrationIntensity: 2,
  elasticity: 0,
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

function readContentHeight(element: HTMLElement) {
  return Math.ceil(Math.max(element.scrollHeight, element.offsetHeight));
}

function GlassEffect({
  variant,
  content,
  contentRef,
}: {
  variant: LiquidGlassSurfaceVariant;
  content: ReactNode;
  contentRef?: RefObject<HTMLDivElement | null>;
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
      elasticity={preset.elasticity}
      cornerRadius={preset.cornerRadius}
      padding="0"
      mode={preset.mode}
      mouseContainer={null}
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
  const surfaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const measuredContentHeightRef = useRef<number | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const classes = ['liquid-glass-surface', `liquid-glass-surface--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  useLayoutEffect(() => {
    if (layout !== 'content' || !contentRef.current) return;
    const nextHeight = readContentHeight(contentRef.current);
    if (nextHeight <= 0 || nextHeight === measuredContentHeightRef.current) return;
    measuredContentHeightRef.current = nextHeight;
    setContentHeight(nextHeight);
  });

  useLayoutEffect(() => {
    if (layout !== 'content' || !contentRef.current || !surfaceRef.current) return undefined;
    const contentElement = contentRef.current;
    const surfaceElement = surfaceRef.current;
    const effectElement = surfaceElement.querySelector<HTMLElement>(
      ':scope > .liquid-glass-surface__effect',
    );
    let measurementFrame = 0;
    let glassResizeFrame = 0;
    let previousSurfaceWidth = -1;
    let previousSurfaceHeight = -1;

    const notifyGlassResize = () => {
      glassResizeFrame = 0;
      const nextWidth = surfaceElement.clientWidth;
      const nextHeight = surfaceElement.clientHeight;
      if (nextWidth <= 0 || nextHeight <= 0) return;
      if (nextWidth === previousSurfaceWidth && nextHeight === previousSurfaceHeight) return;
      previousSurfaceWidth = nextWidth;
      previousSurfaceHeight = nextHeight;

      if (!effectElement) {
        window.dispatchEvent(new Event('resize'));
        return;
      }

      effectElement.setAttribute('data-liquid-glass-measuring', 'true');
      void effectElement.offsetHeight;
      try {
        window.dispatchEvent(new Event('resize'));
      } finally {
        effectElement.removeAttribute('data-liquid-glass-measuring');
      }
    };

    const scheduleGlassResize = () => {
      if (glassResizeFrame) cancelAnimationFrame(glassResizeFrame);
      glassResizeFrame = requestAnimationFrame(notifyGlassResize);
    };

    const measure = () => {
      measurementFrame = 0;
      const nextHeight = readContentHeight(contentElement);
      if (nextHeight <= 0 || nextHeight === measuredContentHeightRef.current) return;
      measuredContentHeightRef.current = nextHeight;
      setContentHeight(nextHeight);
    };

    const scheduleMeasure = () => {
      if (measurementFrame) cancelAnimationFrame(measurementFrame);
      measurementFrame = requestAnimationFrame(measure);
    };

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
      let contentChanged = false;
      let surfaceChanged = false;
      for (const entry of entries) {
        if (entry.target === contentElement) contentChanged = true;
        if (entry.target === surfaceElement) surfaceChanged = true;
      }
      if (contentChanged) scheduleMeasure();
      if (surfaceChanged) scheduleGlassResize();
    });
    resizeObserver?.observe(contentElement);
    resizeObserver?.observe(surfaceElement);

    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(scheduleMeasure);
    mutationObserver?.observe(contentElement, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    window.addEventListener('resize', scheduleMeasure);
    measure();

    return () => {
      if (measurementFrame) cancelAnimationFrame(measurementFrame);
      if (glassResizeFrame) cancelAnimationFrame(glassResizeFrame);
      effectElement?.removeAttribute('data-liquid-glass-measuring');
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [layout, variant]);

  return (
    <div
      ref={surfaceRef}
      className={classes}
      data-liquid-glass-variant={variant}
      data-liquid-glass-mode={preset.mode}
      data-liquid-glass-layout={layout}
      data-liquid-glass-elasticity={preset.elasticity}
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
