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
import { hideTopLayerPopover, showTopLayerPopover, supportsTopLayerPopover } from './topLayer';
import { useWorkspaceFloatingLayer, useWorkspaceTooltipLayer } from './WorkspaceFloatingLayer';

const SAFE_FLOATING_GAP = 8;
const PREVIEW_LEAVE_DELAY_MS = 140;
type FloatingPosition = { left: number; top: number; maxWidth: number; maxHeight: number };
type TooltipState = 'closed' | 'preview' | 'pinned';
type TooltipTriggerState = { expanded: boolean; tooltipId: string };

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
  pinOnClick = false,
}: {
  content: ReactNode;
  children: ReactNode | ((state: TooltipTriggerState) => ReactNode);
  className?: string;
  disabled?: boolean;
  anchorRole?: AriaRole;
  anchorTabIndex?: number;
  pinOnClick?: boolean;
}) {
  const floatingLayer = useWorkspaceFloatingLayer();
  const tooltipLayer = useWorkspaceTooltipLayer();
  const topLayerActive = supportsTopLayerPopover() && Boolean(tooltipLayer);
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<TooltipState>('closed');
  const open = !disabled && state !== 'closed';
  const [position, setPosition] = useState<FloatingPosition>({
    left: SAFE_FLOATING_GAP, top: SAFE_FLOATING_GAP, maxWidth: 320, maxHeight: 240,
  });

  const cancelLeave = useCallback(() => {
    if (leaveTimerRef.current !== null) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = null;
  }, []);
  const close = useCallback(() => {
    cancelLeave();
    setState('closed');
  }, [cancelLeave]);
  const preview = () => {
    cancelLeave();
    if (!disabled) setState((current) => current === 'pinned' ? current : 'preview');
  };
  const leavePreview = () => {
    cancelLeave();
    if (!pinOnClick) { close(); return; }
    // The small delay only bridges the anchor-to-popup gap, never polling resets.
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null;
      setState((current) => current === 'pinned' ? current : 'closed');
    }, PREVIEW_LEAVE_DELAY_MS);
  };
  const isInside = (target: EventTarget | null) => target instanceof Node
    && (anchorRef.current?.contains(target) || tooltipRef.current?.contains(target));

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;
    const layerRect = topLayerActive && tooltipLayer
      ? tooltipLayer.getBoundingClientRect()
      : floatingLayer?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const maxWidth = Math.max(1, layerRect.width - SAFE_FLOATING_GAP * 2);
    const availableBelow = Math.max(1, layerRect.bottom - anchorRect.bottom - SAFE_FLOATING_GAP * 2);
    const availableAbove = Math.max(1, anchorRect.top - layerRect.top - SAFE_FLOATING_GAP * 2);
    const naturalHeight = Math.max(tooltipRect.height, tooltip.scrollHeight);
    const below = naturalHeight <= availableBelow || availableBelow >= availableAbove;
    const maxHeight = pinOnClick
      ? Math.min(Math.max(1, layerRect.height - SAFE_FLOATING_GAP * 2), below ? availableBelow : availableAbove)
      : Math.max(1, layerRect.height - SAFE_FLOATING_GAP * 2);
    const tooltipWidth = Math.min(tooltipRect.width, maxWidth);
    const tooltipHeight = Math.min(naturalHeight, maxHeight);
    const offsetLeft = topLayerActive ? 0 : layerRect.left;
    const offsetTop = topLayerActive ? 0 : layerRect.top;
    const preferBelow = pinOnClick ? below : anchorRect.bottom + SAFE_FLOATING_GAP + tooltipHeight <= layerRect.bottom - SAFE_FLOATING_GAP;
    const next = {
      left: clamp(anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2,
        layerRect.left + SAFE_FLOATING_GAP, layerRect.right - tooltipWidth - SAFE_FLOATING_GAP) - offsetLeft,
      top: clamp(preferBelow ? anchorRect.bottom + SAFE_FLOATING_GAP : anchorRect.top - tooltipHeight - SAFE_FLOATING_GAP,
        layerRect.top + SAFE_FLOATING_GAP, layerRect.bottom - tooltipHeight - SAFE_FLOATING_GAP) - offsetTop,
      maxWidth, maxHeight,
    };
    setPosition((current) => Object.keys(next).every((key) => Math.abs(current[key as keyof FloatingPosition] - next[key as keyof FloatingPosition]) < 0.1) ? current : next);
  }, [floatingLayer, tooltipLayer, topLayerActive, pinOnClick]);

  useLayoutEffect(() => {
    if (!open || !topLayerActive) return undefined;
    const tooltip = tooltipRef.current;
    if (!tooltip) return undefined;
    showTopLayerPopover(tooltip);
    return () => hideTopLayerPopover(tooltip);
  }, [open, topLayerActive, tooltipLayer]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
  }, [open, content, tooltipLayer, updatePosition]);

  useEffect(() => {
    if (disabled) close();
  }, [disabled, close]);
  useEffect(() => cancelLeave, [cancelLeave]);

  useEffect(() => {
    if (!open) return undefined;
    const handleViewportChange = () => updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !anchorRef.current?.contains(target)
        && !(pinOnClick && tooltipRef.current?.contains(target))) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (pinOnClick) {
        event.preventDefault();
        event.stopPropagation();
      }
      close();
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleViewportChange);
    if (tooltipRef.current) observer?.observe(tooltipRef.current);
    if (tooltipLayer) observer?.observe(tooltipLayer);
    window.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);
    document.addEventListener('scroll', handleViewportChange, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      document.removeEventListener('scroll', handleViewportChange, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, pinOnClick, tooltipLayer, close, updatePosition]);

  const tooltipNode = (
    <div
      ref={tooltipRef}
      id={tooltipId}
      className="safe-tooltip ui-tooltip-surface"
      role="tooltip"
      tabIndex={pinOnClick ? 0 : undefined}
      data-interactive={pinOnClick ? 'true' : undefined}
      data-pinned={state === 'pinned' ? 'true' : undefined}
      data-top-layer={topLayerActive ? 'true' : undefined}
      popover={topLayerActive ? 'manual' : undefined}
      onMouseEnter={pinOnClick ? cancelLeave : undefined}
      onMouseLeave={pinOnClick ? leavePreview : undefined}
      onFocus={pinOnClick ? cancelLeave : undefined}
      onBlur={pinOnClick ? (event) => { if (!isInside(event.relatedTarget)) close(); } : undefined}
      style={{
        position: topLayerActive ? 'fixed' : undefined,
        inset: topLayerActive ? 'auto' : undefined,
        margin: topLayerActive ? 0 : undefined,
        zIndex: topLayerActive ? 'auto' : undefined,
        left: `${position.left}px`, top: `${position.top}px`,
        maxWidth: `${position.maxWidth}px`, maxHeight: `${position.maxHeight}px`,
      }}
    >
      {content}
    </div>
  );
  const portalTarget = tooltipLayer ?? floatingLayer ?? (typeof document !== 'undefined' ? document.body : null);
  const tooltip = open && portalTarget ? createPortal(tooltipNode, portalTarget) : null;

  return (
    <>
      <span
        ref={anchorRef}
        className={className ? `safe-tooltip-anchor ${className}` : 'safe-tooltip-anchor'}
        role={anchorRole}
        tabIndex={anchorTabIndex}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={preview}
        onMouseLeave={leavePreview}
        onFocus={preview}
        onBlur={(event) => { if (!pinOnClick || !isInside(event.relatedTarget)) close(); }}
        onClick={pinOnClick ? () => {
          cancelLeave();
          // Focus precedes click on a button. Preview must become pinned, not closed.
          if (!disabled) setState((current) => current === 'pinned' ? 'closed' : 'pinned');
        } : undefined}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' && anchorTabIndex !== undefined) {
            event.currentTarget.focus({ preventScroll: true });
          }
        }}
      >
        {typeof children === 'function' ? children({ expanded: open, tooltipId }) : children}
      </span>
      {tooltip}
    </>
  );
}
