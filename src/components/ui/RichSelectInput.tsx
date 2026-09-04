import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FormField } from './FormControls';
import {
  hideTopLayerPopover,
  showTopLayerPopover,
  supportsTopLayerPopover,
} from './topLayer';
import { useWorkspaceFloatingLayer } from './WorkspaceFloatingLayer';

const FLOATING_GAP = 6;
const FLOATING_INSET = 8;
const OPTION_HEIGHT = 48;
const DETAIL_OPTION_HEIGHT = 64;
const PRODUCTION_CONFIG_OPTION_HEIGHT = 88;
const PRODUCTION_CONFIG_MENU_WIDTH = 420;
const MAX_VISIBLE_OPTIONS = 6;
const TYPEAHEAD_RESET_MS = 700;

type RichSelectPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: 'above' | 'below';
  scrollable: boolean;
};

export type RichSelectVariant = 'default' | 'production-config';

export type RichSelectOption = {
  value: string;
  label: string;
  visual?: ReactNode;
  detail?: ReactNode;
  triggerDetail?: ReactNode;
  disabled?: boolean;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function naturalScrollHeight(element: HTMLElement) {
  return Math.ceil(element.scrollHeight + Math.max(0, element.offsetHeight - element.clientHeight));
}

function describedBy(...values: Array<string | undefined>) {
  const merged = values.filter(Boolean).join(' ');
  return merged || undefined;
}

function nextEnabledIndex(
  options: readonly RichSelectOption[],
  startIndex: number,
  direction: 1 | -1,
) {
  if (options.length === 0) return -1;
  for (let offset = 1; offset <= options.length; offset += 1) {
    const candidate = (startIndex + direction * offset + options.length) % options.length;
    if (!options[candidate]?.disabled) return candidate;
  }
  return -1;
}

function matchingOptionIndex(
  options: readonly RichSelectOption[],
  startIndex: number,
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery || options.length === 0) return -1;
  for (let offset = 1; offset <= options.length; offset += 1) {
    const candidate = (startIndex + offset + options.length) % options.length;
    const option = options[candidate];
    if (!option || option.disabled) continue;
    if (option.label.trim().toLocaleLowerCase().startsWith(normalizedQuery)) return candidate;
  }
  return -1;
}

export function RichSelectInput({
  label,
  value,
  options,
  onValueChange,
  description,
  error,
  fieldClassName,
  id,
  disabled = false,
  required = false,
  name,
  variant = 'default',
  notifyOnReselect = false,
  'aria-label': ariaLabel,
}: {
  label: ReactNode;
  value: string;
  options: readonly RichSelectOption[];
  onValueChange: (value: string) => void;
  description?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  variant?: RichSelectVariant;
  notifyOnReselect?: boolean;
  'aria-label'?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-listbox`;
  const floatingLayer = useWorkspaceFloatingLayer();
  const topLayerSupported = supportsTopLayerPopover();
  const viewportLayer = topLayerSupported || !floatingLayer;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef({ query: '', lastTypedAt: 0 });
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [position, setPosition] = useState<RichSelectPosition>({
    left: FLOATING_INSET,
    top: FLOATING_INSET,
    width: 240,
    maxHeight: OPTION_HEIGHT * MAX_VISIBLE_OPTIONS,
    placement: 'below',
    scrollable: false,
  });

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const activeIndex = useMemo(
    () => activeValue === null
      ? -1
      : options.findIndex((option) => option.value === activeValue),
    [activeValue, options],
  );
  const selectedOption = options[selectedIndex]
    ?? options.find((option) => !option.disabled)
    ?? options[0];
  const selectedTriggerDetail = selectedOption?.triggerDetail ?? selectedOption?.detail;
  const optionHeight = variant === 'production-config'
    ? PRODUCTION_CONFIG_OPTION_HEIGHT
    : options.some((option) => Boolean(option.detail))
      ? DETAIL_OPTION_HEIGHT
      : OPTION_HEIGHT;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const layerRect = floatingLayer?.getBoundingClientRect()
      ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const triggerRect = trigger.getBoundingClientRect();
    const availableWidth = Math.max(1, layerRect.width - FLOATING_INSET * 2);
    const preferredWidth = variant === 'production-config'
      ? Math.max(triggerRect.width, PRODUCTION_CONFIG_MENU_WIDTH)
      : triggerRect.width;
    const width = Math.min(preferredWidth, availableWidth);
    const defaultEstimatedHeight = Math.min(
      optionHeight * MAX_VISIBLE_OPTIONS + FLOATING_INSET,
      Math.max(optionHeight, options.length * optionHeight + FLOATING_INSET),
    );
    const estimatedHeight = variant === 'production-config'
      ? listboxRef.current
        ? naturalScrollHeight(listboxRef.current)
        : Math.max(optionHeight, options.length * optionHeight + FLOATING_INSET * 2)
      : defaultEstimatedHeight;
    const availableBelow = Math.max(
      0,
      layerRect.bottom - triggerRect.bottom - FLOATING_GAP - FLOATING_INSET,
    );
    const availableAbove = Math.max(
      0,
      triggerRect.top - layerRect.top - FLOATING_GAP - FLOATING_INSET,
    );
    const availableLayerHeight = Math.max(optionHeight, layerRect.height - FLOATING_INSET * 2);
    const productionCanFitLayer = variant === 'production-config'
      && estimatedHeight <= availableLayerHeight;
    const placement = variant === 'production-config'
      ? availableBelow >= estimatedHeight
        ? 'below'
        : availableAbove >= estimatedHeight
          ? 'above'
          : availableAbove > availableBelow
            ? 'above'
            : 'below'
      : availableBelow < Math.min(estimatedHeight, optionHeight * 3)
        && availableAbove > availableBelow
        ? 'above'
        : 'below';
    const availableHeight = placement === 'above' ? availableAbove : availableBelow;
    const maxHeight = productionCanFitLayer
      ? estimatedHeight
      : Math.max(optionHeight, Math.min(estimatedHeight, availableHeight || estimatedHeight));
    const left = viewportLayer
      ? clamp(
        triggerRect.left,
        layerRect.left + FLOATING_INSET,
        layerRect.right - width - FLOATING_INSET,
      )
      : clamp(
        triggerRect.left - layerRect.left,
        FLOATING_INSET,
        layerRect.width - width - FLOATING_INSET,
      );
    const preferredTop = viewportLayer
      ? placement === 'above'
        ? triggerRect.top - FLOATING_GAP - maxHeight
        : triggerRect.bottom + FLOATING_GAP
      : placement === 'above'
        ? triggerRect.top - layerRect.top - FLOATING_GAP - maxHeight
        : triggerRect.bottom - layerRect.top + FLOATING_GAP;
    const safeTop = viewportLayer ? layerRect.top + FLOATING_INSET : FLOATING_INSET;
    const safeBottom = viewportLayer ? layerRect.bottom - FLOATING_INSET : layerRect.height - FLOATING_INSET;
    const top = productionCanFitLayer
      ? clamp(preferredTop, safeTop, safeBottom - maxHeight)
      : preferredTop;

    setPosition({
      left,
      top,
      width,
      maxHeight,
      placement,
      scrollable: variant === 'production-config' && !productionCanFitLayer,
    });
  }, [floatingLayer, optionHeight, options.length, variant, viewportLayer]);

  const openList = useCallback((direction: 1 | -1 = 1) => {
    if (disabled || options.length === 0) return;
    const initialIndex = selectedIndex >= 0 && !options[selectedIndex]?.disabled
      ? selectedIndex
      : nextEnabledIndex(options, direction > 0 ? -1 : 0, direction);
    setActiveValue(options[initialIndex]?.value ?? null);
    setOpen(true);
  }, [disabled, options, selectedIndex]);

  const closeList = useCallback(() => {
    setOpen(false);
    setActiveValue(null);
    typeaheadRef.current = { query: '', lastTypedAt: 0 };
  }, []);

  const selectIndex = useCallback((index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== value || notifyOnReselect) onValueChange(option.value);
    closeList();
    triggerRef.current?.focus();
  }, [closeList, notifyOnReselect, onValueChange, options, value]);

  useLayoutEffect(() => {
    if (!topLayerSupported || !open) return undefined;
    const listbox = listboxRef.current;
    if (!listbox) return undefined;
    showTopLayerPopover(listbox);
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => {
      cancelAnimationFrame(frame);
      hideTopLayerPopover(listbox);
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
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || listboxRef.current?.contains(target)) return;
      closeList();
    };
    const handleWindowBlur = () => closeList();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('scroll', handleViewportChange, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('scroll', handleViewportChange, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [closeList, open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const activeOption = activeValue === null
      ? undefined
      : options.find((option) => option.value === activeValue);
    if (activeOption && !activeOption.disabled) return;
    const fallbackIndex = selectedIndex >= 0 && !options[selectedIndex]?.disabled
      ? selectedIndex
      : nextEnabledIndex(options, -1, 1);
    const fallbackValue = options[fallbackIndex]?.value ?? null;
    if (fallbackValue !== activeValue) setActiveValue(fallbackValue);
  }, [activeValue, open, options, selectedIndex]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listboxId, open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        if (!open) {
          openList(direction);
          return;
        }
        const nextIndex = nextEnabledIndex(options, activeIndex, direction);
        setActiveValue(options[nextIndex]?.value ?? null);
        return;
      }
      case 'Home':
      case 'End': {
        if (!open) return;
        event.preventDefault();
        const direction = event.key === 'Home' ? 1 : -1;
        const start = event.key === 'Home' ? -1 : 0;
        const nextIndex = nextEnabledIndex(options, start, direction);
        setActiveValue(options[nextIndex]?.value ?? null);
        return;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (!open) openList();
        else if (activeIndex >= 0) selectIndex(activeIndex);
        return;
      }
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          closeList();
        }
        return;
      case 'Tab':
        closeList();
        return;
      default: {
        if (
          event.nativeEvent.isComposing
          || event.ctrlKey
          || event.metaKey
          || event.altKey
          || event.key.length !== 1
        ) return;
        const typedAt = Date.now();
        const previous = typeaheadRef.current;
        let query = typedAt - previous.lastTypedAt > TYPEAHEAD_RESET_MS
          ? event.key
          : `${previous.query}${event.key}`;
        let matchIndex = matchingOptionIndex(
          options,
          open ? activeIndex : selectedIndex,
          query,
        );
        if (matchIndex < 0 && query.length > 1) {
          query = event.key;
          matchIndex = matchingOptionIndex(
            options,
            open ? activeIndex : selectedIndex,
            query,
          );
        }
        typeaheadRef.current = { query, lastTypedAt: typedAt };
        if (matchIndex < 0) return;
        event.preventDefault();
        if (open) setActiveValue(options[matchIndex]?.value ?? null);
        else selectIndex(matchIndex);
        return;
      }
    }
  };

  const listboxStyle: CSSProperties = {
    position: viewportLayer ? 'fixed' : undefined,
    inset: viewportLayer ? 'auto' : undefined,
    margin: viewportLayer ? 0 : undefined,
    zIndex: topLayerSupported ? 'auto' : viewportLayer ? 120 : undefined,
    left: `${position.left}px`,
    top: `${position.top}px`,
    width: `${position.width}px`,
    maxHeight: `${position.maxHeight}px`,
  };

  const listboxNode = (
    <div
      ref={listboxRef}
      id={listboxId}
      className="ui-rich-select__listbox"
      role="listbox"
      aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      data-variant={variant}
      data-placement={position.placement}
      data-scrollable={position.scrollable ? 'true' : undefined}
      data-top-layer={topLayerSupported ? 'true' : undefined}
      popover={topLayerSupported ? 'manual' : undefined}
      style={listboxStyle}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          id={`${listboxId}-option-${index}`}
          type="button"
          className="ui-rich-select__option"
          role="option"
          aria-selected={option.value === value}
          aria-disabled={option.disabled || undefined}
          data-active={option.value === activeValue ? 'true' : undefined}
          data-has-detail={option.detail ? 'true' : undefined}
          data-value={option.value}
          disabled={option.disabled}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onPointerMove={() => {
            if (!option.disabled) setActiveValue(option.value);
          }}
          onClick={() => selectIndex(index)}
        >
          {option.visual ? <span className="ui-rich-select__visual">{option.visual}</span> : null}
          {option.detail ? (
            <span className="ui-rich-select__content">
              <span className="ui-rich-select__option-label">{option.label}</span>
              <span className="ui-rich-select__detail">{option.detail}</span>
            </span>
          ) : (
            <span className="ui-rich-select__option-label">{option.label}</span>
          )}
          {variant === 'production-config' ? (
            <span
              className="ui-rich-select__selected-mark"
              data-visible={option.value === value ? 'true' : undefined}
              aria-hidden="true"
            />
          ) : null}
        </button>
      ))}
    </div>
  );

  const listbox = !open
    ? null
    : floatingLayer
      ? createPortal(listboxNode, floatingLayer)
      : topLayerSupported
        ? listboxNode
        : typeof document !== 'undefined'
          ? createPortal(listboxNode, document.body)
          : null;

  return (
    <FormField
      label={label}
      htmlFor={inputId}
      description={description}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <span className="ui-rich-select" data-rich-select="true" data-variant={variant}>
        <button
          ref={triggerRef}
          id={inputId}
          type="button"
          className="ui-rich-select__trigger"
          role="combobox"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-describedby={describedBy(
            description ? `${inputId}-description` : undefined,
            error ? `${inputId}-error` : undefined,
          )}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          disabled={disabled}
          data-variant={variant}
          data-has-detail={selectedTriggerDetail ? 'true' : undefined}
          data-facility-sheet-no-drag="true"
          onClick={() => {
            if (open) closeList();
            else openList();
          }}
          onKeyDown={handleKeyDown}
        >
          {selectedOption?.visual ? (
            <span className="ui-rich-select__visual">{selectedOption.visual}</span>
          ) : null}
          {selectedTriggerDetail ? (
            <span className="ui-rich-select__content">
              <span className="ui-rich-select__value">{selectedOption?.label ?? '暂无选项'}</span>
              <span className="ui-rich-select__detail">{selectedTriggerDetail}</span>
            </span>
          ) : (
            <span className="ui-rich-select__value">{selectedOption?.label ?? '暂无选项'}</span>
          )}
          <span className="ui-rich-select__chevron" aria-hidden="true" />
        </button>
        {name ? <input type="hidden" name={name} value={value} /> : null}
      </span>
      {listbox}
    </FormField>
  );
}
