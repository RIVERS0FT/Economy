type PopoverCapableElement = HTMLElement & {
  showPopover: () => void;
  hidePopover: () => void;
};

function asPopoverElement(element: HTMLElement): PopoverCapableElement | null {
  const candidate = element as Partial<PopoverCapableElement>;
  return typeof candidate.showPopover === 'function' && typeof candidate.hidePopover === 'function'
    ? element as PopoverCapableElement
    : null;
}

export function supportsTopLayerPopover() {
  if (typeof HTMLElement === 'undefined') return false;
  return asPopoverElement(HTMLElement.prototype) !== null;
}

export function isTopLayerPopoverOpen(element: HTMLElement) {
  try {
    return element.matches(':popover-open');
  } catch {
    return false;
  }
}

export function showTopLayerPopover(element: HTMLElement) {
  const popover = asPopoverElement(element);
  if (!popover || isTopLayerPopoverOpen(element)) return false;
  try {
    popover.showPopover();
    return true;
  } catch {
    return false;
  }
}

export function hideTopLayerPopover(element: HTMLElement): void {
  const popover = asPopoverElement(element);
  if (!popover || !isTopLayerPopoverOpen(element)) return;
  try {
    popover.hidePopover();
  } catch {
    // Hiding a detached or already-closed popover is a no-op for callers.
  }
}
