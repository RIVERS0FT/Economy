import { expect, test, type Locator, type Page } from '@playwright/test';

async function waitForSheetAnimations(surface: Locator) {
  await expect.poll(() => surface.evaluate((element) => (
    element.getAnimations().every((animation) => animation.playState === 'finished')
  ))).toBe(true);
}

async function collectDetailFrames(page: Page, count = 8) {
  return page.evaluate(async (frameCount) => {
    const frames: Array<{ top: number; height: number }> = [];
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const detail = document.querySelector<HTMLElement>('.mobile-workspace-sheet-detail-view');
      if (!detail) break;
      const rect = detail.getBoundingClientRect();
      frames.push({ top: rect.top, height: rect.height });
    }
    return frames;
  }, count);
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

async function openResearchDetail(page: Page) {
  const host = page.locator('.mobile-workspace-sheet-host');
  const trigger = page.getByRole('button', { name: /冶金技术，研发中/ });
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
    await page.goto('runtime-test.html?view=research&scenario=research-active');
    const { host, detail } = await openResearchDetail(page);
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

    // The final move and release intentionally happen without an intervening RAF.
    // A stale-RAF implementation jumps from the previously committed 72px position.
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y + releaseDistance }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    const frames = await collectDetailFrames(page);
    expect(frames.length).toBeGreaterThanOrEqual(4);
    expect(Math.abs(frames[0].top - expectedReleaseTop)).toBeLessThanOrEqual(12);
    expect(Math.max(...frames.map((frame) => frame.height)) - Math.min(...frames.map((frame) => frame.height)))
      .toBeLessThanOrEqual(1);
    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index].top).toBeGreaterThanOrEqual(frames[index - 1].top - 1);
    }

    await expect(host).toHaveAttribute('data-detail-active', 'false');
    await expect(host.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);
    await expect(host).toBeVisible();
  });

  test('short release rebounds from the exact finger position with frozen sheet geometry', async ({ page }) => {
    await page.goto('runtime-test.html?view=research&scenario=research-active');
    const { host, detail } = await openResearchDetail(page);
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

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y + releaseDistance }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    const frames = await collectDetailFrames(page);
    expect(frames.length).toBeGreaterThanOrEqual(4);
    expect(Math.abs(frames[0].top - expectedReleaseTop)).toBeLessThanOrEqual(12);
    expect(Math.max(...frames.map((frame) => frame.height)) - Math.min(...frames.map((frame) => frame.height)))
      .toBeLessThanOrEqual(1);
    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index].top).toBeLessThanOrEqual(frames[index - 1].top + 1);
    }

    await expect.poll(() => detail.evaluate((element) => element.getBoundingClientRect().top))
      .toBeCloseTo(initialBox.y, 0);
    await expect(host).toHaveAttribute('data-detail-active', 'true');
    await expect(detail).toBeVisible();
  });
});
