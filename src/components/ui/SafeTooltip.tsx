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
const POINTER_BRIDGE_DELAY = 120;

type FloatingPosition = { left: number; top: number; maxWidth: number; maxHeight: number };
type TooltipMode = 'closed' | 'preview' | 'pinned';
type TooltipTrigger = { expanded: boolean; tooltipId: string; toggle: () => void };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function SafeTooltip({
  content,
  children,
  className = '',
  disabled = false,
  interactive = false,
  anchorRole,
  anchorTabIndex,
}: {
  content: ReactNode;
  children: ReactNode | ((trigger: TooltipTrigger) => ReactNode);
  className?: string;
  disabled?: boolean;
  interactive?: boolean;
  anchorRole?: AriaRole;
  anchorTabIndex?: number;
}) {
  const floatingLayer = useWorkspaceFloatingLayer();
  const tooltipLayer = useWorkspaceTooltipLayer();
  const topLayerActive = supportsTopLayerPopover() && Boolean(tooltipLayer);
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerWithinRef = useRef(false);
  const focusWithinRef = useRef(false);
  const modeRef = useRef<TooltipMode>('closed');
  const [mode, setMode] = useState<TooltipMode>('closed');
  const open = mode !== 'closed' && !disabled;
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
  const changeMode = useCallback((next: TooltipMode) => {
    modeRef.current = next;
    setMode(next);
  }, []);
  const close = useCallback(() => {
    cancelClose();
    pointerWithinRef.current = false;
    focusWithinRef.current = false;
    changeMode('closed');
  }, [cancelClose, changeMode]);
  const preview = () => {
    cancelClose();
    if (!disabled && modeRef.current === 'closed') changeMode('preview');
  };
  const scheduleClose = () => {
    cancelClose();
    if (!interactive) { close(); return; }
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      if (modeRef.current !== 'pinned' && !pointerWithinRef.current && !focusWithinRef.current) close();
    }, POINTER_BRIDGE_DELAY);
  };
  const toggle = () => {
    if (disabled || !interactive) return;
    cancelClose();
    // Focus precedes click on both mouse and touch. Toggle the pinned state,
    // not preview visibility, so the first tap never immediately closes it.
    if (modeRef.current === 'pinned') close();
    else changeMode('pinned');
  };

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;
    const layerRect = tooltipLayer?.getBoundingClientRect()
      ?? floatingLayer?.getBoundingClientRect()
      ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const maxWidth = Math.max(1, layerRect.width - SAFE_FLOATING_GAP * 2);
    const belowSpace = Math.max(0, layerRect.bottom - anchorRect.bottom - SAFE_FLOATING_GAP * 2);
    const aboveSpace = Math.max(0, anchorRect.top - layerRect.top - SAFE_FLOATING_GAP * 2);
    const maxHeight = Math.max(1, Math.min(layerRect.height - SAFE_FLOATING_GAP * 2,
      interactive ? Math.max(belowSpace, aboveSpace) : Infinity));
    const tooltipWidth = Math.min(tooltipRect.width, maxWidth);
    const tooltipHeight = Math.min(tooltipRect.height, maxHeight);
    const originLeft = topLayerActive ? 0 : layerRect.left;
    const originTop = topLayerActive ? 0 : layerRect.top;
    const centeredLeft = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
    const belowTop = anchorRect.bottom + SAFE_FLOATING_GAP;
    const aboveTop = anchorRect.top - tooltipHeight - SAFE_FLOATING_GAP;
    const preferredTop = belowTop + tooltipHeight <= layerRect.bottom - SAFE_FLOATING_GAP ? belowTop : aboveTop;
    const next = {
      left: clamp(centeredLeft, layerRect.left + SAFE_FLOATING_GAP, layerRect.right - tooltipWidth - SAFE_FLOATING_GAP) - originLeft,
      top: clamp(preferredTop, layerRect.top + SAFE_FLOATING_GAP, layerRect.bottom - tooltipHeight - SAFE_FLOATING_GAP) - originTop,
      maxWidth,
      maxHeight,
    };
    setPosition((current) => Object.keys(next).every((key) => (
      Math.abs(current[key as keyof FloatingPosition] - next[key as keyof FloatingPosition]) < 0.25
    )) ? current : next);
  }, [floatingLayer, tooltipLayer, topLayerActive, interactive]);

  useEffect(() => { if (disabled) close(); }, [disabled, close]);
  useEffect(() => cancelClose, [cancelClose]);

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
    if (!open) return undefined;
    const contains = (target: EventTarget | null) => target instanceof Node && (
      anchorRef.current?.contains(target) || tooltipRef.current?.contains(target)
    );
    const handlePointerDown = (event: PointerEvent) => { if (!contains(event.target)) close(); };
    const handleFocus = (event: FocusEvent) => { if (interactive && !contains(event.target)) close(); };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      if (interactive) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePosition);
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (tooltipRef.current) observer?.observe(tooltipRef.current);
    if (tooltipLayer) observer?.observe(tooltipLayer);
    window.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('focusin', handleFocus, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('focusin', handleFocus, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, interactive, tooltipLayer, updatePosition, close]);

  const tooltipNode = (
    <div
      ref={tooltipRef}
      id={tooltipId}
      className="safe-tooltip ui-tooltip-surface"
      role="tooltip"
      tabIndex={interactive ? -1 : undefined}
      data-interactive={interactive ? 'true' : undefined}
      data-pinned={mode === 'pinned' ? 'true' : undefined}
      data-top-layer={topLayerActive ? 'true' : undefined}
      popover={topLayerActive ? 'manual' : undefined}
      onPointerEnter={(event) => {
        if (interactive && event.pointerType === 'mouse') { pointerWithinRef.current = true; cancelClose(); }
      }}
      onPointerLeave={(event) => {
        if (interactive && event.pointerType === 'mouse') { pointerWithinRef.current = false; scheduleClose(); }
      }}
      onFocus={() => { if (interactive) { focusWithinRef.current = true; cancelClose(); } }}
      onBlur={() => { if (interactive) { focusWithinRef.current = false; scheduleClose(); } }}
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
  const portalTarget = tooltipLayer ?? floatingLayer ?? (typeof document !== 'undefined' ? document.body : null);

  return (
    <>
      <span
        ref={anchorRef}
        className={className ? `safe-tooltip-anchor ${className}` : 'safe-tooltip-anchor'}
        role={anchorRole}
        tabIndex={anchorTabIndex}
        aria-describedby={open ? tooltipId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') { pointerWithinRef.current = true; preview(); }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') { pointerWithinRef.current = false; scheduleClose(); }
        }}
        onFocus={() => { focusWithinRef.current = true; preview(); }}
        onBlur={() => { focusWithinRef.current = false; scheduleClose(); }}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' && anchorTabIndex !== undefined) event.currentTarget.focus({ preventScroll: true });
        }}
      >
        {typeof children === 'function' ? children({ expanded: open, tooltipId, toggle }) : children}
      </span>
      {open && portalTarget ? createPortal(tooltipNode, portalTarget) : null}
    </>
  );
}
