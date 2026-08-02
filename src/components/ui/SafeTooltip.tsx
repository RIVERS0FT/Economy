import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  hideTopLayerPopover,
  showTopLayerPopover,
  supportsTopLayerPopover,
} from './topLayer';
import { useWorkspaceFloatingLayer } from './WorkspaceFloatingLayer';

const SAFE_FLOATING_GAP = 8;

type FloatingPosition = { left: number; top: number; maxWidth: number; maxHeight: number };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function SafeTooltip({
  content,
  children,
  className = '',
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const floatingLayer = useWorkspaceFloatingLayer();
  const topLayerSupported = supportsTopLayerPopover();
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<FloatingPosition>({
    left: SAFE_FLOATING_GAP,
    top: SAFE_FLOATING_GAP,
    maxWidth: 320,
    maxHeight: 240,
  });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;

    const layerRect = floatingLayer?.getBoundingClientRect()
      ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const maxWidth = Math.max(1, layerRect.width - SAFE_FLOATING_GAP * 2);
    const maxHeight = Math.max(1, layerRect.height - SAFE_FLOATING_GAP * 2);
    const tooltipWidth = Math.min(tooltipRect.width, maxWidth);
    const tooltipHeight = Math.min(tooltipRect.height, maxHeight);
    const centeredLeft = topLayerSupported
      ? anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2
      : anchorRect.left + anchorRect.width / 2 - layerRect.left - tooltipWidth / 2;
    const belowTop = topLayerSupported
      ? anchorRect.bottom + SAFE_FLOATING_GAP
      : anchorRect.bottom - layerRect.top + SAFE_FLOATING_GAP;
    const aboveTop = topLayerSupported
      ? anchorRect.top - tooltipHeight - SAFE_FLOATING_GAP
      : anchorRect.top - layerRect.top - tooltipHeight - SAFE_FLOATING_GAP;
    const bottomBoundary = topLayerSupported ? layerRect.bottom : layerRect.height;
    const preferredTop = belowTop + tooltipHeight <= bottomBoundary - SAFE_FLOATING_GAP
      ? belowTop
      : aboveTop;

    setPosition({
      left: topLayerSupported
        ? clamp(
          centeredLeft,
          layerRect.left + SAFE_FLOATING_GAP,
          layerRect.right - tooltipWidth - SAFE_FLOATING_GAP,
        )
        : clamp(
          centeredLeft,
          SAFE_FLOATING_GAP,
          layerRect.width - tooltipWidth - SAFE_FLOATING_GAP,
        ),
      top: topLayerSupported
        ? clamp(
          preferredTop,
          layerRect.top + SAFE_FLOATING_GAP,
          layerRect.bottom - tooltipHeight - SAFE_FLOATING_GAP,
        )
        : clamp(
          preferredTop,
          SAFE_FLOATING_GAP,
          layerRect.height - tooltipHeight - SAFE_FLOATING_GAP,
        ),
      maxWidth,
      maxHeight,
    });
  }, [floatingLayer, topLayerSupported]);

  useLayoutEffect(() => {
    if (!topLayerSupported || !open) return undefined;
    const tooltip = tooltipRef.current;
    if (!tooltip) return undefined;
    showTopLayerPopover(tooltip);
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => {
      cancelAnimationFrame(frame);
      hideTopLayerPopover(tooltip);
    };
  }, [open, topLayerSupported, updatePosition]);

  useLayoutEffect(() => {
    if (topLayerSupported || !open) return undefined;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
  }, [open, topLayerSupported, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const handleViewportChange = () => updatePosition();
    window.addEventListener('resize', handleViewportChange);
    document.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      document.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updatePosition]);

  const tooltipNode = (
    <div
      ref={tooltipRef}
      id={tooltipId}
      className="safe-tooltip"
      role="tooltip"
      data-top-layer={topLayerSupported ? 'true' : undefined}
      popover={topLayerSupported ? 'manual' : undefined}
      style={{
        position: topLayerSupported ? 'fixed' : undefined,
        inset: topLayerSupported ? 'auto' : undefined,
        margin: topLayerSupported ? 0 : undefined,
        zIndex: topLayerSupported ? 'auto' : undefined,
        left: `${position.left}px`,
        top: `${position.top}px`,
        maxWidth: `${position.maxWidth}px`,
        maxHeight: `${position.maxHeight}px`,
      }}
    >
      {content}
    </div>
  );

  const tooltip = !open
    ? null
    : topLayerSupported
      ? tooltipNode
      : floatingLayer
        ? createPortal(tooltipNode, floatingLayer)
        : null;

  return (
    <>
      <span
        ref={anchorRef}
        className={className ? `safe-tooltip-anchor ${className}` : 'safe-tooltip-anchor'}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}
