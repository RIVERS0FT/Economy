import { expect, test, type Locator, type Page } from '@playwright/test';

interface SheetGeometry {
  top: number;
  height: number;
}

interface SettleProbeState {
  handoff: SheetGeometry | null;
  minHeight: number | null;
  maxHeight: number | null;
  endTop: number | null;
  done: boolean;
}

type SettleProbeWindow = typeof window & {
  __economyMobileSheetSettleProbe?: SettleProbeState;
};

async function waitForSheetAnimations(surface: Locator) {
  await expect.poll(() => surface.evaluate((element) => (
    element.getAnimations().every((animation) => animation.playState === 'finished')
  ))).toBe(true);
}

async function armSettleProbe(detail: Locator) {
  await detail.evaluate((element) => {
    const target = element as HTMLElement;
    const testWindow = window as SettleProbeWindow;
    const probe: SettleProbeState = {
      handoff: null,
      minHeight: null,
      maxHeight: null,
      endTop: null,
      done: false,
    };
    testWindow.__economyMobileSheetSettleProbe = probe;

    const recordHeight = () => {
      const height = target.getBoundingClientRect().height;
      probe.minHeight = probe.minHeight === null ? height : Math.min(probe.minHeight, height);
      probe.maxHeight = probe.maxHeight === null ? height : Math.max(probe.maxHeight, height);
    };

    const observer = new MutationObserver(() => {
      if (!target.classList.contains('is-settling') || probe.handoff) return;
      const rect = target.getBoundingClientRect();
      probe.handoff = { top: rect.top, height: rect.height };
      probe.minHeight = rect.height;
      probe.maxHeight = rect.height;
      observer.disconnect();

      const resizeObserver = new ResizeObserver(() => recordHeight());
      resizeObserver.observe(target);
      const handleTransitionEnd = (event: TransitionEvent) => {
        if (event.target !== target || event.propertyName !== 'transform') return;
        const endRect = target.getBoundingClientRect();
        recordHeight();
        probe.endTop = endRect.top;
        probe.done = true;
        resizeObserver.disconnect();
        target.removeEventListener('transitionend', handleTransitionEnd);
      };
      target.addEventListener('transitionend', handleTransitionEnd);
    });
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
  });
}

async function readSettleProbe(page: Page, requireDone = false) {
  await expect.poll(() => page.evaluate(() => {
    const probe = (window as SettleProbeWindow).__economyMobileSheetSettleProbe;
    return requireDone ? probe?.done === true : probe?.handoff !== null && probe?.handoff !== undefined;
  })).toBe(true);

  return page.evaluate(() => {
    const probe = (window as SettleProbeWindow).__economyMobileSheetSettleProbe;
    if (!probe?.handoff || probe.minHeight === null || probe.maxHeight === null) {
      throw new Error('移动 Sheet settle 探针未捕获完整几何');
    }
    return {
      handoff: probe.handoff,
      minHeight: probe.minHeight,
      maxHeight: probe.maxHeight,
      endTop: probe.endTop,
      done: probe.done,
    };
  });
}

async function startTouchDrag(page: Page, handle: Locator) {
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('移动 Sheet 拖动把手几何不可用');
  const client = await page.context().newCDPSession(page);
  const point = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: point.x, y: point.y }],
  });
  return { client, point };
}

async function openFactoryDetail(page: Page) {
  const host = page.locator('.mobile-workspace-sheet-host');
  const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
  await expect(trigger).toBeVisible();
  await trigger.tap();
  await expect(host).toHaveAttribute('data-detail-active', 'true');
  const detail = host.locator('.mobile-workspace-sheet-detail-view');
  await expect(detail).toBeVisible();
  await waitForSheetAnimations(detail);
  return { host, detail };
}

test.describe('mobile sheet release stability', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('half-distance release starts closing from the exact finger position without a jump', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');
    const { host, detail } = await openFactoryDetail(page);
    const handle = detail.locator('.mobile-detail-sheet-drag-handle');

    const initialBox = await detail.boundingBox();
    expect(initialBox).not.toBeNull();
    if (!initialBox) throw new Error('移动 Sheet 详情初始几何不可用');
    const releaseDistance = Math.min(280, initialBox.height * 0.5);
    const expectedReleaseTop = initialBox.y + releaseDistance;
    const { client, point } = await startTouchDrag(page, handle);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y + 24 }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y + 72 }],
    });
    await expect.poll(() => detail.evaluate((element) => element.getBoundingClientRect().top))
      .toBeCloseTo(initialBox.y + 72, 0);

    await armSettleProbe(detail);
    // The final move and release intentionally happen without an intervening RAF.
    // The in-page settle probe captures the class handoff microtask before the
    // transition target can advance, so CI scheduling delay cannot masquerade as a jump.
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y + releaseDistance }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    const handoff = await readSettleProbe(page);
    expect(Math.abs(handoff.handoff.top - expectedReleaseTop)).toBeLessThanOrEqual(2);
    expect(Math.abs(handoff.handoff.height - initialBox.height)).toBeLessThanOrEqual(1);

    await expect(host).toHaveAttribute('data-detail-active', 'false');
    await expect(host.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);
    const settled = await readSettleProbe(page, true);
    expect(settled.maxHeight - settled.minHeight).toBeLessThanOrEqual(1);
    expect(settled.endTop).not.toBeNull();
    expect(settled.endTop ?? handoff.handoff.top).toBeGreaterThanOrEqual(handoff.handoff.top - 1);
    await expect(host).toBeVisible();
  });

  test('short release rebounds from the exact finger position with frozen sheet geometry', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');
    const { host, detail } = await openFactoryDetail(page);
    const handle = detail.locator('.mobile-detail-sheet-drag-handle');

    const initialBox = await detail.boundingBox();
    expect(initialBox).not.toBeNull();
    if (!initialBox) throw new Error('移动 Sheet 详情初始几何不可用');
    const releaseDistance = 36;
    const expectedReleaseTop = initialBox.y + releaseDistance;
    const { client, point } = await startTouchDrag(page, handle);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y + 24 }],
    });
    await expect.poll(() => detail.evaluate((element) => element.getBoundingClientRect().top))
      .toBeCloseTo(initialBox.y + 24, 0);

    await armSettleProbe(detail);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y + releaseDistance }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    const handoff = await readSettleProbe(page);
    expect(Math.abs(handoff.handoff.top - expectedReleaseTop)).toBeLessThanOrEqual(2);
    expect(Math.abs(handoff.handoff.height - initialBox.height)).toBeLessThanOrEqual(1);

    const settled = await readSettleProbe(page, true);
    expect(settled.maxHeight - settled.minHeight).toBeLessThanOrEqual(1);
    expect(settled.endTop).not.toBeNull();
    expect(settled.endTop ?? handoff.handoff.top).toBeLessThanOrEqual(handoff.handoff.top + 1);
    await expect.poll(() => detail.evaluate((element) => element.getBoundingClientRect().top))
      .toBeCloseTo(initialBox.y, 0);
    await expect(host).toHaveAttribute('data-detail-active', 'true');
    await expect(detail).toBeVisible();
  });
});
