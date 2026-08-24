const MOBILE_DETAIL_SHEET_SELECTOR = '.mobile-detail-sheet';
const MOBILE_DETAIL_SHEET_SCROLL_SELECTOR =
  '.mobile-detail-sheet-scroll, .page-card-scroll';
const MOBILE_DETAIL_SHEET_HEADER_SELECTOR =
  '.mobile-detail-sheet-header, .mobile-detail-sheet-drag-handle, .page-fixed-header';
const MOBILE_DETAIL_SHEET_AXIS_THRESHOLD = 8;
const MOBILE_DETAIL_SHEET_AXIS_DOMINANCE = 1.2;

type MobileDetailSheetGestureSource = 'header' | 'content' | 'surface';

interface MobileDetailSheetBrowserGestureSession {
  anchorX: number;
  anchorY: number;
  source: MobileDetailSheetGestureSource;
  scrollViewport?: HTMLElement;
  active: boolean;
}

const attachedDetailSheets = new WeakSet<HTMLElement>();
let configured = false;

function attachMobileDetailSheetGuard(sheet: HTMLElement) {
  if (attachedDetailSheets.has(sheet)) return;
  attachedDetailSheets.add(sheet);

  let session: MobileDetailSheetBrowserGestureSession | null = null;

  const handleTouchStart = (event: TouchEvent) => {
    session = null;
    if (event.touches.length !== 1) return;

    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const scrollViewport = target.closest<HTMLElement>(MOBILE_DETAIL_SHEET_SCROLL_SELECTOR) ?? undefined;
    const isHeader = Boolean(target.closest(MOBILE_DETAIL_SHEET_HEADER_SELECTOR));
    const touch = event.touches[0];
    session = {
      anchorX: touch.clientX,
      anchorY: touch.clientY,
      source: scrollViewport ? 'content' : isHeader ? 'header' : 'surface',
      scrollViewport,
      active: false,
    };
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!session) return;
    if (event.touches.length !== 1) {
      session = null;
      return;
    }

    if (session.active) {
      if (event.cancelable) event.preventDefault();
      return;
    }

    const touch = event.touches[0];
    if (session.source === 'content' && (session.scrollViewport?.scrollTop ?? 0) > 0) {
      // Keep native scrolling while content can still move. Updating the anchor
      // here lets the same gesture hand off cleanly if it later reaches the top.
      session.anchorX = touch.clientX;
      session.anchorY = touch.clientY;
      return;
    }

    const deltaX = touch.clientX - session.anchorX;
    const deltaY = touch.clientY - session.anchorY;
    if (Math.hypot(deltaX, deltaY) < MOBILE_DETAIL_SHEET_AXIS_THRESHOLD) return;
    if (deltaY <= 0 || deltaY < Math.abs(deltaX) * MOBILE_DETAIL_SHEET_AXIS_DOMINANCE) {
      // Do not abandon the whole touch sequence. A user can scroll or move
      // laterally first, then reverse into a downward pull at the top edge.
      session.anchorX = touch.clientX;
      session.anchorY = touch.clientY;
      return;
    }

    session.active = true;
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
