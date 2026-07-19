import {
  type AriaRole,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type UIEventHandler,
  useId,
  useRef,
} from 'react';
import {
  type HorizontalScrollbarVisibility,
  type ScrollAxis,
  useOverlayScrollbar,
} from '../../hooks/useOverlayScrollbar';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

export interface ScrollAreaProps {
  children: ReactNode;
  axis?: ScrollAxis;
  className?: string;
  viewportClassName?: string;
  style?: CSSProperties;
  viewportStyle?: CSSProperties;
  viewportRef?: Ref<HTMLDivElement>;
  viewportId?: string;
  viewportRole?: AriaRole;
  viewportAriaLabel?: string;
  viewportTabIndex?: number;
  onViewportScroll?: UIEventHandler<HTMLDivElement>;
  horizontalVisibility?: HorizontalScrollbarVisibility;
  verticalAutoHide?: boolean;
  idleDelay?: number;
  verticalPriority?: boolean;
}

export function ScrollArea({
  children,
  axis = 'both',
  className = '',
  viewportClassName = '',
  style,
  viewportStyle,
  viewportRef: externalViewportRef,
  viewportId,
  viewportRole,
  viewportAriaLabel,
  viewportTabIndex,
  onViewportScroll,
  horizontalVisibility = 'always',
  verticalAutoHide = true,
  idleDelay = 1_200,
  verticalPriority = true,
}: ScrollAreaProps) {
  const generatedId = useId().replace(/:/g, '');
  const resolvedViewportId = viewportId ?? `scroll-area-${generatedId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const horizontalTrackRef = useRef<HTMLDivElement>(null);
  const horizontalThumbRef = useRef<HTMLDivElement>(null);
  const verticalTrackRef = useRef<HTMLDivElement>(null);
  const verticalThumbRef = useRef<HTMLDivElement>(null);

  const {
    startThumbDrag,
    handleTrackPointerDown,
    handleThumbKeyDown,
  } = useOverlayScrollbar({
    rootRef,
    viewportRef,
    horizontalTrackRef,
    horizontalThumbRef,
    verticalTrackRef,
    verticalThumbRef,
    axis,
    horizontalVisibility,
    verticalAutoHide,
    idleDelay,
    verticalPriority,
  });

  return (
    <div
      ref={rootRef}
      className={classNames('ui-scroll-area', className)}
      data-scroll-axis={axis}
      data-horizontal-visibility={horizontalVisibility}
      style={style}
    >
      <div
        ref={(node) => {
          viewportRef.current = node;
          assignRef(externalViewportRef, node);
        }}
        id={resolvedViewportId}
        className={classNames('ui-scroll-area__viewport', viewportClassName)}
        style={viewportStyle}
        role={viewportRole}
        aria-label={viewportAriaLabel}
        tabIndex={viewportTabIndex}
        onScroll={onViewportScroll}
      >
        {children}
      </div>

      <div
        ref={horizontalTrackRef}
        className="ui-scrollbar ui-scrollbar--horizontal"
        onPointerDown={(event) => handleTrackPointerDown('x', event)}
      >
        <div
          ref={horizontalThumbRef}
          className="ui-scrollbar__thumb"
          role="scrollbar"
          aria-controls={resolvedViewportId}
          aria-orientation="horizontal"
          tabIndex={-1}
          onPointerDown={(event) => startThumbDrag('x', event)}
          onKeyDown={(event) => handleThumbKeyDown('x', event)}
        />
      </div>

      <div
        ref={verticalTrackRef}
        className="ui-scrollbar ui-scrollbar--vertical"
        onPointerDown={(event) => handleTrackPointerDown('y', event)}
      >
        <div
          ref={verticalThumbRef}
          className="ui-scrollbar__thumb"
          role="scrollbar"
          aria-controls={resolvedViewportId}
          aria-orientation="vertical"
          tabIndex={-1}
          onPointerDown={(event) => startThumbDrag('y', event)}
          onKeyDown={(event) => handleThumbKeyDown('y', event)}
        />
      </div>
    </div>
  );
}
