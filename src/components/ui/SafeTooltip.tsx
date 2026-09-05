import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type AriaRole,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  hideTopLayerPopover,
  showTopLayerPopover,
  supportsTopLayerPopover,
} from './topLayer';
import {
  useWorkspaceFloatingLayer,
  useWorkspaceTooltipLayer,
} from './WorkspaceFloatingLayer';

const SAFE_FLOATING_GAP = 8;

type FloatingPosition = { left: number; top: number; maxWidth: number; maxHeight: number };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function SafeTooltip({
  content,
  children,
  className = '',
  disabled = false,
  anchorRole,
  anchorTabIndex,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  anchorRole?: AriaRole;
  anchorTabIndex?: number;
}) {
  const floatingLayer = useWorkspaceFloatingLayer();
  const tooltipLayer = useWorkspaceTooltipLayer();
  const topLayerActive = supportsTopLayerPopover() && Boolean(tooltipLayer);
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

    const layerRect = topLayerActive && tooltipLayer
      ? tooltipLayer.getBoundingClientRect()
      : floatingLayer
        ? floatingLayer.getBoundingClientRect()
        : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const maxWidth = Math.max(1, layerRect.width - SAFE_FLOATING_GAP * 2);
    const maxHeight = Math.max(1, layerRect.height - SAFE_FLOATING_GAP * 2);
    const tooltipWidth = Math.min(tooltipRect.width, maxWidth);
    const tooltipHeight = Math.min(tooltipRect.height, maxHeight);
    const centeredLeft = topLayerActive
      ? anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2
      : anchorRect.left + anchorRect.width / 2 - layerRect.left - tooltipWidth / 2;
    const belowTop = topLayerActive
      ? anchorRect.bottom + SAFE_FLOATING_GAP
      : anchorRect.bottom - layerRect.top + SAFE_FLOATING_GAP;
    const aboveTop = topLayerActive
      ? anchorRect.top - tooltipHeight - SAFE_FLOATING_GAP
      : anchorRect.top - layerRect.top - tooltipHeight - SAFE_FLOATING_GAP;
    const bottomBoundary = topLayerActive ? layerRect.bottom : layerRect.height;
    const preferredTop = belowTop + tooltipHeight <= bottomBoundary - SAFE_FLOATING_GAP
      ? belowTop
      : aboveTop;

    setPosition({
      left: topLayerActive
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
      top: topLayerActive
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
  }, [floatingLayer, tooltipLayer, topLayerActive]);

  useLayoutEffect(() => {
    if (!open || disabled || !topLayerActive) return undefined;
    const tooltip = tooltipRef.current;
    if (!tooltip) return undefined;
    showTopLayerPopover(tooltip);
    return () => hideTopLayerPopover(tooltip);
  }, [open, disabled, topLayerActive, tooltipLayer]);

  useLayoutEffect(() => {
    if (!open || disabled) return undefined;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
  }, [open, disabled, tooltipLayer, updatePosition]);

  useEffect(() => {
    if (!open || disabled) return undefined;
    const handleViewportChange = () => updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !anchorRef.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', handleViewportChange);
    document.addEventListener('scroll', handleViewportChange, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      document.removeEventListener('scroll', handleViewportChange, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, disabled, updatePosition]);

  const tooltipNode = (
    <div
      ref={tooltipRef}
      id={tooltipId}
      className="safe-tooltip ui-tooltip-surface"
      role="tooltip"
      data-top-layer={topLayerActive ? 'true' : undefined}
      popover={topLayerActive ? 'manual' : undefined}
      style={{
        position: topLayerActive ? 'fixed' : undefined,
        inset: topLayerActive ? 'auto' : undefined,
        margin: topLayerActive ? 0 : undefined,
        zIndex: topLayerActive ? 'auto' : undefined,
        left: `${position.left}px`,
        top: `${position.top}px`,
        maxWidth: `${position.maxWidth}px`,
        maxHeight: `${position.maxHeight}px`,
      }}
    >
      {content}
    </div>
  );

  const portalTarget = tooltipLayer
    ?? floatingLayer
    ?? (typeof document !== 'undefined' ? document.body : null);
  const tooltip = open && !disabled && portalTarget ? createPortal(tooltipNode, portalTarget) : null;

  return (
    <>
      <span
        ref={anchorRef}
        className={className ? `safe-tooltip-anchor ${className}` : 'safe-tooltip-anchor'}
        role={anchorRole}
        tabIndex={anchorTabIndex}
        aria-describedby={open && !disabled ? tooltipId : undefined}
        onMouseEnter={() => setOpen(!disabled)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(!disabled)}
        onBlur={() => setOpen(false)}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' && anchorTabIndex !== undefined) {
            event.currentTarget.focus({ preventScroll: true });
          }
        }}
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}
