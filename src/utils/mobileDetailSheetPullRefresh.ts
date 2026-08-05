const MOBILE_DETAIL_SHEET_SELECTOR = '.mobile-detail-sheet';
const MOBILE_DETAIL_SHEET_SCROLL_SELECTOR = '.mobile-detail-sheet-scroll';
const MOBILE_DETAIL_SHEET_AXIS_THRESHOLD = 8;
const MOBILE_DETAIL_SHEET_AXIS_DOMINANCE = 1.2;
const INTERACTIVE_TARGET_SELECTOR =
  'button, a, input, select, textarea, [role="scrollbar"], .ui-scrollbar, [data-mobile-detail-sheet-no-drag]';

type MobileDetailSheetGestureSource = 'header' | 'content';

interface MobileDetailSheetBrowserGestureSession {
  startX: number;
  startY: number;
  source: MobileDetailSheetGestureSource;
  scrollViewport?: HTMLElement;
  active: boolean;
}

const attachedDetailSheets = new WeakSet<HTMLElement>();
let configured = false;

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_TARGET_SELECTOR));
}

function attachMobileDetailSheetGuard(sheet: HTMLElement) {
  if (attachedDetailSheets.has(sheet)) return;
  attachedDetailSheets.add(sheet);

  let session: MobileDetailSheetBrowserGestureSession | null = null;

  const handleTouchStart = (event: TouchEvent) => {
    session = null;
    if (event.touches.length !== 1 || isInteractiveTarget(event.target)) return;

    const target = event.target instanceof Element ? event.target : null;
    const isHeader = Boolean(
      target?.closest('.mobile-detail-sheet-header, .mobile-detail-sheet-drag-handle'),
    );
    const scrollViewport = target?.closest<HTMLElement>(MOBILE_DETAIL_SHEET_SCROLL_SELECTOR) ?? undefined;
    if (!isHeader && !scrollViewport) return;
    if (scrollViewport && scrollViewport.scrollTop > 0) return;

    const touch = event.touches[0];
    session = {
      startX: touch.clientX,
      startY: touch.clientY,
      source: isHeader ? 'header' : 'content',
      scrollViewport,
      active: false,
    };
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!session || event.touches.length !== 1) return;
    if (session.source === 'content' && (session.scrollViewport?.scrollTop ?? 0) > 0) {
      session = null;
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - session.startX;
    const deltaY = touch.clientY - session.startY;
    if (!session.active) {
      if (Math.hypot(deltaX, deltaY) < MOBILE_DETAIL_SHEET_AXIS_THRESHOLD) return;
      if (deltaY <= 0 || deltaY < Math.abs(deltaX) * MOBILE_DETAIL_SHEET_AXIS_DOMINANCE) {
        session = null;
        return;
      }
      session.active = true;
    }

    if (event.cancelable) event.preventDefault();
  };

  const clearSession = () => {
    session = null;
  };

  sheet.addEventListener('touchstart', handleTouchStart, { passive: true });
  sheet.addEventListener('touchmove', handleTouchMove, { passive: false });
  sheet.addEventListener('touchend', clearSession, { passive: true });
  sheet.addEventListener('touchcancel', clearSession, { passive: true });
}

function attachMobileDetailSheetsWithin(root: ParentNode) {
  if (root instanceof HTMLElement && root.matches(MOBILE_DETAIL_SHEET_SELECTOR)) {
    attachMobileDetailSheetGuard(root);
  }
  root.querySelectorAll<HTMLElement>(MOBILE_DETAIL_SHEET_SELECTOR).forEach(attachMobileDetailSheetGuard);
}

export function configureMobileDetailSheetPullRefreshGuard() {
  if (configured || typeof document === 'undefined') return;
  configured = true;

  attachMobileDetailSheetsWithin(document);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement) attachMobileDetailSheetsWithin(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
