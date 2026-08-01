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
    if (!floatingLayer || !anchor || !tooltip) return;

    const layerRect = floatingLayer.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const maxWidth = Math.max(1, layerRect.width - SAFE_FLOATING_GAP * 2);
    const maxHeight = Math.max(1, layerRect.height - SAFE_FLOATING_GAP * 2);
    const tooltipWidth = Math.min(tooltipRect.width, maxWidth);
    const tooltipHeight = Math.min(tooltipRect.height, maxHeight);
    const centeredLeft = anchorRect.left + anchorRect.width / 2 - layerRect.left - tooltipWidth / 2;
    const belowTop = anchorRect.bottom - layerRect.top + SAFE_FLOATING_GAP;
    const aboveTop = anchorRect.top - layerRect.top - tooltipHeight - SAFE_FLOATING_GAP;
    const preferredTop = belowTop + tooltipHeight <= layerRect.height - SAFE_FLOATING_GAP
      ? belowTop
      : aboveTop;

    setPosition({
      left: clamp(centeredLeft, SAFE_FLOATING_GAP, layerRect.width - tooltipWidth - SAFE_FLOATING_GAP),
      top: clamp(preferredTop, SAFE_FLOATING_GAP, layerRect.height - tooltipHeight - SAFE_FLOATING_GAP),
      maxWidth,
      maxHeight,
    });
  }, [floatingLayer]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
  }, [open, updatePosition]);

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

  const tooltip = open && floatingLayer
    ? createPortal(
      <div
        ref={tooltipRef}
        id={tooltipId}
        className="safe-tooltip"
        role="tooltip"
        style={{
          left: `${position.left}px`,
          top: `${position.top}px`,
          maxWidth: `${position.maxWidth}px`,
          maxHeight: `${position.maxHeight}px`,
        }}
      >
        {content}
      </div>,
      floatingLayer,
    )
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
