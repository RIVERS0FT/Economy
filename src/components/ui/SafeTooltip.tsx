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
const HOVER_BRIDGE_MS = 120;

type FloatingPosition = { left: number; top: number; maxWidth: number; maxHeight: number };
type TooltipVisibility = 'closed' | 'preview' | 'pinned';
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
  const visibilityRef = useRef<TooltipVisibility>('closed');
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorHoveredRef = useRef(false);
  const tooltipHoveredRef = useRef(false);
  const suppressFocusRef = useRef(false);
  const [visibility, setVisibility] = useState<TooltipVisibility>('closed');
  const open = visibility !== 'closed';
  const [position, setPosition] = useState<FloatingPosition>({
    left: SAFE_FLOATING_GAP,
    top: SAFE_FLOATING_GAP,
    maxWidth: 320,
    maxHeight: 240,
  });

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const changeVisibility = useCallback((next: TooltipVisibility) => {
    cancelClose();
    // Focus fires before click on touch and keyboard activation. The click toggle
    // depends on the pinned state, not on whether focus already opened a preview.
    visibilityRef.current = next;
    setVisibility(next);
  }, [cancelClose]);

  const showPreview = useCallback(() => {
    cancelClose();
    if (!disabled && !suppressFocusRef.current && visibilityRef.current !== 'pinned') {
      changeVisibility('preview');
    }
  }, [cancelClose, changeVisibility, disabled]);

  const schedulePreviewClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      const active = document.activeElement;
      if (visibilityRef.current !== 'pinned'
        && !anchorHoveredRef.current && !tooltipHoveredRef.current
        && !anchorRef.current?.contains(active) && !tooltipRef.current?.contains(active)) {
        changeVisibility('closed');
      }
    }, HOVER_BRIDGE_MS);
  }, [cancelClose, changeVisibility]);

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
    const next = {
      left: topLayerActive
        ? clamp(centeredLeft, layerRect.left + SAFE_FLOATING_GAP, layerRect.right - tooltipWidth - SAFE_FLOATING_GAP)
        : clamp(centeredLeft, SAFE_FLOATING_GAP, layerRect.width - tooltipWidth - SAFE_FLOATING_GAP),
      top: topLayerActive
        ? clamp(preferredTop, layerRect.top + SAFE_FLOATING_GAP, layerRect.bottom - tooltipHeight - SAFE_FLOATING_GAP)
        : clamp(preferredTop, SAFE_FLOATING_GAP, layerRect.height - tooltipHeight - SAFE_FLOATING_GAP),
      maxWidth,
      maxHeight,
    };
    setPosition((current) => (
      current.left === next.left && current.top === next.top
      && current.maxWidth === next.maxWidth && current.maxHeight === next.maxHeight
        ? current : next
    ));
  }, [floatingLayer, tooltipLayer, topLayerActive]);

  useEffect(() => {
    if (disabled) changeVisibility('closed');
  }, [disabled, changeVisibility]);
  useEffect(() => cancelClose, [cancelClose]);

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
    let frame: number | null = null;
    const schedulePosition = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { frame = null; updatePosition(); });
    };
    schedulePosition();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedulePosition);
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (tooltipRef.current) observer?.observe(tooltipRef.current);
    if (tooltipLayer ?? floatingLayer) observer?.observe((tooltipLayer ?? floatingLayer)!);
    return () => {
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [open, disabled, floatingLayer, tooltipLayer, updatePosition]);

  useEffect(() => {
    if (!open || disabled) return undefined;
    const handleViewportChange = () => updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !anchorRef.current?.contains(target)
        && !(pinOnClick && tooltipRef.current?.contains(target))) changeVisibility('closed');
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || visibilityRef.current === 'closed') return;
      if (pinOnClick) {
        event.preventDefault();
        event.stopPropagation();
        if (tooltipRef.current?.contains(document.activeElement)) {
          suppressFocusRef.current = true;
          (anchorRef.current?.querySelector<HTMLElement>('button, [tabindex]') ?? anchorRef.current)?.focus({ preventScroll: true });
          suppressFocusRef.current = false;
        }
      }
      changeVisibility('closed');
    };
    window.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);
    document.addEventListener('scroll', handleViewportChange, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      document.removeEventListener('scroll', handleViewportChange, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, disabled, pinOnClick, changeVisibility, updatePosition]);

  const tooltipNode = (
    <div
      ref={tooltipRef}
      id={tooltipId}
      className="safe-tooltip ui-tooltip-surface"
      role="tooltip"
      tabIndex={pinOnClick ? 0 : undefined}
      data-interactive={pinOnClick ? 'true' : undefined}
      data-pinned={visibility === 'pinned' ? 'true' : undefined}
      data-top-layer={topLayerActive ? 'true' : undefined}
      popover={topLayerActive ? 'manual' : undefined}
      onPointerEnter={(event) => {
        if (pinOnClick && event.pointerType !== 'touch') { tooltipHoveredRef.current = true; cancelClose(); }
      }}
      onPointerLeave={(event) => {
        if (pinOnClick && event.pointerType !== 'touch') { tooltipHoveredRef.current = false; schedulePreviewClose(); }
      }}
      onFocus={pinOnClick ? cancelClose : undefined}
      onBlur={pinOnClick ? schedulePreviewClose : undefined}
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
        onMouseEnter={() => { if (!pinOnClick) showPreview(); }}
        onMouseLeave={() => { if (!pinOnClick) changeVisibility('closed'); }}
        onPointerEnter={(event) => {
          if (pinOnClick && event.pointerType !== 'touch') { anchorHoveredRef.current = true; showPreview(); }
        }}
        onPointerLeave={(event) => {
          if (pinOnClick && event.pointerType !== 'touch') { anchorHoveredRef.current = false; schedulePreviewClose(); }
        }}
        onFocus={showPreview}
        onBlur={() => { if (pinOnClick) schedulePreviewClose(); else changeVisibility('closed'); }}
        onClick={() => {
          if (pinOnClick && !disabled) changeVisibility(visibilityRef.current === 'pinned' ? 'closed' : 'pinned');
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' && anchorTabIndex !== undefined) {
            event.currentTarget.focus({ preventScroll: true });
          }
        }}
      >
        {typeof children === 'function' ? children({ expanded: open && !disabled, tooltipId }) : children}
      </span>
      {tooltip}
    </>
  );
}
