import type { EChartsCoreOption } from './echartsCore';

const CSS_VARIABLE_PATTERN = /var\(\s*(--[\w-]+)\s*\)/g;
const MAX_CSS_VARIABLE_DEPTH = 8;

type StyleReader = Pick<CSSStyleDeclaration, 'getPropertyValue'>;
type UnknownRecord = Record<string, unknown>;
type UnknownFunction = (this: unknown, ...args: unknown[]) => unknown;

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isColorProperty(propertyName: string | undefined) {
  return propertyName === 'color' || Boolean(propertyName?.endsWith('Color'));
}

export function resolveCssColorVariables(value: string, styles: StyleReader) {
  let resolved = value;
  for (let depth = 0; depth < MAX_CSS_VARIABLE_DEPTH && resolved.includes('var('); depth += 1) {
    const next = resolved.replace(CSS_VARIABLE_PATTERN, (match, variableName: string) => {
      const computed = styles.getPropertyValue(variableName).trim();
      return computed || match;
    });
    if (next === resolved) break;
    resolved = next;
  }
  return resolved;
}

function resolveOptionNode(
  value: unknown,
  propertyName: string | undefined,
  styles: StyleReader,
  seen: WeakMap<object, unknown>,
): unknown {
  if (typeof value === 'string') {
    return isColorProperty(propertyName) ? resolveCssColorVariables(value, styles) : value;
  }

  if (typeof value === 'function') {
    if (!isColorProperty(propertyName)) return value;
    const colorCallback = value as UnknownFunction;
    return function resolvedColorCallback(this: unknown, ...args: unknown[]) {
      return resolveOptionNode(colorCallback.apply(this, args), propertyName, styles, new WeakMap());
    };
  }

  if (Array.isArray(value)) {
    const cached = seen.get(value);
    if (cached) return cached;
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) copy.push(resolveOptionNode(item, propertyName, styles, seen));
    return copy;
  }

  if (!isPlainRecord(value)) return value;
  const cached = seen.get(value);
  if (cached) return cached;
  const copy: UnknownRecord = {};
  seen.set(value, copy);
  for (const [key, child] of Object.entries(value)) {
    copy[key] = resolveOptionNode(child, key, styles, seen);
  }
  return copy;
}

export function resolveEChartsCssColors(option: EChartsCoreOption, container: HTMLElement) {
  const styles = getComputedStyle(container);
  return resolveOptionNode(option, undefined, styles, new WeakMap()) as EChartsCoreOption;
}
