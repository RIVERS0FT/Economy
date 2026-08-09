import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ChangeEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { normalizeIntegerDraft, parseIntegerDraft } from '../../utils/integerDraft';
import { formatMoneyDraft, normalizeMoneyDraft, parseMoneyDraft } from '../../utils/moneyDraft';

function classNames(...values: Array<string | number | bigint | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function mergeDescribedBy(...values: Array<string | undefined>) {
  const merged = values.filter(Boolean).join(' ');
  return merged || undefined;
}

function clampInteger(value: number, min?: number, max?: number) {
  return Math.min(
    max ?? Number.MAX_SAFE_INTEGER,
    Math.max(min ?? Number.MIN_SAFE_INTEGER, value),
  );
}

interface SelectOptionAvailabilityContextValue {
  restrictedOptionValues: ReadonlySet<string>;
  allowedRestrictedOptionValues: ReadonlySet<string>;
}

const SelectOptionAvailabilityContext = createContext<SelectOptionAvailabilityContextValue | null>(null);

export function SelectOptionAvailabilityProvider({
  restrictedOptionValues,
  allowedRestrictedOptionValues,
  children,
}: SelectOptionAvailabilityContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({
    restrictedOptionValues,
    allowedRestrictedOptionValues,
  }), [allowedRestrictedOptionValues, restrictedOptionValues]);
  return (
    <SelectOptionAvailabilityContext.Provider value={value}>
      {children}
    </SelectOptionAvailabilityContext.Provider>
  );
}

function explicitOptionValue(node: ReactNode) {
  if (!isValidElement<{ value?: string | number | readonly string[] }>(node) || node.type !== 'option') return null;
  const value = node.props.value;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function restrictedSelectCatalog(
  children: ReactNode,
  availability: SelectOptionAvailabilityContextValue | null,
) {
  const childArray = Children.toArray(children);
  const optionValues = childArray
    .map(explicitOptionValue)
    .filter((value): value is string => value !== null);
  if (!availability) return { childArray, optionValues, isRestrictedCatalog: false };
  const restrictedOptionValues = availability.restrictedOptionValues;
  const isRestrictedCatalog = optionValues.length > 0
    && optionValues.some((value) => restrictedOptionValues.has(value))
    && optionValues.every((value) => value === '' || restrictedOptionValues.has(value));
  return { childArray, optionValues, isRestrictedCatalog };
}

function availableSelectChildren(
  childArray: ReactNode[],
  availability: SelectOptionAvailabilityContextValue | null,
  isRestrictedCatalog: boolean,
) {
  if (!availability || !isRestrictedCatalog) return childArray;
  return childArray.filter((child) => {
    const value = explicitOptionValue(child);
    return value === null
      || value === ''
      || !availability.restrictedOptionValues.has(value)
      || availability.allowedRestrictedOptionValues.has(value);
  });
}

export function FormField({
  label,
  htmlFor,
  description,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={classNames('ui-form-field', error && 'ui-form-field--error', className)} htmlFor={htmlFor}>
      <span className="ui-form-field__label">
        {label}
        {required ? <span className="ui-form-field__required" aria-hidden="true">*</span> : null}
      </span>
      {children}
      {description ? <small id={`${htmlFor}-description`} className="ui-form-field__description">{description}</small> : null}
      {error ? <small id={`${htmlFor}-error`} className="ui-form-field__error" role="alert">{error}</small> : null}
    </label>
  );
}

type SharedFieldProps = {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
};

type SelectInputProps = SharedFieldProps & SelectHTMLAttributes<HTMLSelectElement> & {
  leadingIcon?: ReactNode;
};

export function TextInput({
  label,
  description,
  error,
  fieldClassName,
  className,
  id,
  required,
  'aria-describedby': ariaDescribedBy,
  ...props
}: SharedFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FormField
      label={label}
      htmlFor={inputId}
      description={description}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <input
        {...props}
        id={inputId}
        required={required}
        className={classNames('ui-control', className)}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={mergeDescribedBy(
          ariaDescribedBy,
          description ? `${inputId}-description` : undefined,
          error ? `${inputId}-error` : undefined,
        )}
      />
    </FormField>
  );
}

export function SelectInput({
  label,
  description,
  error,
  fieldClassName,
  className,
  id,
  required,
  leadingIcon,
  'aria-describedby': ariaDescribedBy,
  children,
  ...props
}: SelectInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const selectRef = useRef<HTMLSelectElement>(null);
  const optionAvailability = useContext(SelectOptionAvailabilityContext);
  const catalog = restrictedSelectCatalog(children, optionAvailability);
  const visibleChildren = availableSelectChildren(
    catalog.childArray,
    optionAvailability,
    catalog.isRestrictedCatalog,
  );
  const fallbackRestrictedValue = catalog.optionValues.find((value) => (
    value === '' || optionAvailability?.allowedRestrictedOptionValues.has(value)
  )) ?? '';

  useEffect(() => {
    if (!catalog.isRestrictedCatalog || props.value === undefined || !props.onChange || !optionAvailability) return;
    const currentValue = String(props.value ?? '');
    if (currentValue === '' || optionAvailability.allowedRestrictedOptionValues.has(currentValue)) return;
    const select = selectRef.current;
    if (!select) return;
    select.value = fallbackRestrictedValue;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, [
    catalog.isRestrictedCatalog,
    fallbackRestrictedValue,
    optionAvailability,
    props.onChange,
    props.value,
  ]);

  return (
    <FormField
      label={label}
      htmlFor={inputId}
      description={description}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <span className={classNames('ui-control-shell', leadingIcon && 'ui-control-shell--with-leading-icon')}>
        {leadingIcon ? <span className="ui-control-leading-icon" aria-hidden="true">{leadingIcon}</span> : null}
        <select
          {...props}
          ref={selectRef}
          id={inputId}
          required={required}
          className={classNames('ui-control', className)}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={mergeDescribedBy(
            ariaDescribedBy,
            description ? `${inputId}-description` : undefined,
            error ? `${inputId}-error` : undefined,
          )}
        >
          {visibleChildren}
        </select>
      </span>
    </FormField>
  );
}

export function TextArea({
  label,
  description,
  error,
  fieldClassName,
  className,
  id,
  required,
  'aria-describedby': ariaDescribedBy,
  ...props
}: SharedFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FormField
      label={label}
      htmlFor={inputId}
      description={description}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <textarea
        {...props}
        id={inputId}
        required={required}
        className={classNames('ui-control', className)}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={mergeDescribedBy(
          ariaDescribedBy,
          description ? `${inputId}-description` : undefined,
          error ? `${inputId}-error` : undefined,
        )}
      />
    </FormField>
  );
}

type IntegerInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'
> & SharedFieldProps & {
  value: string;
  fallbackValue: number;
  min?: number;
  max?: number;
  onValueChange: (value: string) => void;
};

export function IntegerInput({
  label,
  description,
  error,
  fieldClassName,
  className,
  id,
  value,
  fallbackValue,
  min,
  max,
  required,
  onValueChange,
  onBlur,
  onKeyDown,
  'aria-describedby': ariaDescribedBy,
  ...props
}: IntegerInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (input.disabled || input.readOnly || event.deltaY === 0) return;

      const parsed = parseIntegerDraft(input.value, { min, max });
      const current = parsed ?? clampInteger(fallbackValue, min, max);
      const direction = event.deltaY < 0 ? 1 : -1;
      onValueChange(String(clampInteger(current + direction, min, max)));
    };

    input.addEventListener('wheel', handleWheel, { passive: false });
    return () => input.removeEventListener('wheel', handleWheel);
  }, [fallbackValue, max, min, onValueChange]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onValueChange(event.target.value);
  }

  return (
    <FormField
      label={label}
      htmlFor={inputId}
      description={description}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <input
        {...props}
        ref={inputRef}
        id={inputId}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        required={required}
        value={value}
        className={classNames('ui-control', 'ui-control--integer', className)}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={mergeDescribedBy(
          ariaDescribedBy,
          description ? `${inputId}-description` : undefined,
          error ? `${inputId}-error` : undefined,
        )}
        onChange={handleChange}
        onBlur={(event) => {
          onValueChange(normalizeIntegerDraft(event.currentTarget.value, fallbackValue, { min, max }));
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onValueChange(String(fallbackValue));
            event.currentTarget.blur();
          }
          onKeyDown?.(event);
        }}
      />
    </FormField>
  );
}

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'
> & SharedFieldProps & {
  value: string;
  fallbackValue: number;
  min?: number;
  max?: number;
  wheelStep?: number;
  onValueChange: (value: string) => void;
};

export function MoneyInput({
  label,
  description,
  error,
  fieldClassName,
  className,
  id,
  value,
  fallbackValue,
  min,
  max,
  wheelStep,
  required,
  onValueChange,
  onBlur,
  onKeyDown,
  'aria-describedby': ariaDescribedBy,
  ...props
}: MoneyInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || wheelStep === undefined) return undefined;
    const stepCents = Math.round(wheelStep * 100);
    if (!Number.isFinite(wheelStep) || !Number.isSafeInteger(stepCents) || stepCents <= 0) return undefined;

    const handleWheel = (event: WheelEvent) => {
      if (document.activeElement !== input || event.deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (input.disabled || input.readOnly) return;

      const parsed = parseMoneyDraft(input.value, { min, max });
      const minimum = min ?? Number.MIN_SAFE_INTEGER;
      const maximum = max ?? Number.MAX_SAFE_INTEGER;
      const current = parsed ?? Math.min(maximum, Math.max(minimum, fallbackValue));
      const direction = event.deltaY < 0 ? 1 : -1;
      const nextCents = Math.round(current * 100) + direction * stepCents;
      const minimumCents = Math.ceil(minimum * 100);
      const maximumCents = Math.floor(maximum * 100);
      const clampedCents = Math.min(maximumCents, Math.max(minimumCents, nextCents));
      onValueChange(formatMoneyDraft(clampedCents / 100));
    };

    input.addEventListener('wheel', handleWheel, { passive: false });
    return () => input.removeEventListener('wheel', handleWheel);
  }, [fallbackValue, max, min, onValueChange, wheelStep]);

  return (
    <FormField label={label} htmlFor={inputId} description={description} error={error} required={required} className={fieldClassName}>
      <input
        {...props}
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="decimal"
        required={required}
        value={value}
        className={classNames('ui-control', 'ui-control--money', className)}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={mergeDescribedBy(
          ariaDescribedBy,
          description ? `${inputId}-description` : undefined,
          error ? `${inputId}-error` : undefined,
        )}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={(event) => {
          onValueChange(normalizeMoneyDraft(event.currentTarget.value, fallbackValue, { min, max }));
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onValueChange(formatMoneyDraft(fallbackValue));
            event.currentTarget.blur();
          }
          onKeyDown?.(event);
        }}
      />
    </FormField>
  );
}

export function FileInput({
  label,
  description,
  error,
  fieldClassName,
  className,
  id,
  required,
  'aria-describedby': ariaDescribedBy,
  ...props
}: SharedFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FormField
      label={label}
      htmlFor={inputId}
      description={description}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <input
        {...props}
        id={inputId}
        type="file"
        required={required}
        className={classNames('ui-control', 'ui-control--file', className)}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={mergeDescribedBy(
          ariaDescribedBy,
          description ? `${inputId}-description` : undefined,
          error ? `${inputId}-error` : undefined,
        )}
      />
    </FormField>
  );
}

export function InputGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={classNames('ui-input-group', className)} />;
}
