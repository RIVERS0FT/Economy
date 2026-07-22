import {
  useEffect,
  useId,
  useRef,
  type ChangeEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { normalizeIntegerDraft, parseIntegerDraft } from '../../utils/integerDraft';

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
  'aria-describedby': ariaDescribedBy,
  children,
  ...props
}: SharedFieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
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
      <select
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
      >
        {children}
      </select>
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
