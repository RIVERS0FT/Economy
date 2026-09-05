import { expect, test } from '@playwright/test';

type DecodeProbe = {
  started: number;
  completed: number;
  revoked: number;
  released: boolean;
  release: () => void;
};

test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true } });

test('a late raster decode cannot replace an active SVG fallback and is refreshed after settle', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const pending: Array<() => void> = [];
    const probe: DecodeProbe = {
      started: 0,
      completed: 0,
      revoked: 0,
      released: false,
      release() {
        probe.released = true;
        for (const resolve of pending.splice(0)) resolve();
      },
    };
    (window as typeof window & { __rasterDecodeProbe: DecodeProbe }).__rasterDecodeProbe = probe;
    const originalBitmap = window.createImageBitmap;
    window.createImageBitmap = ((image: ImageBitmapSource, ...args: unknown[]) => {
      // Exercise the supported Image.decode fallback even on browsers that can
      // decode SVG blobs through createImageBitmap. Other images remain real.
      if (image instanceof Blob && image.type.startsWith('image/svg+xml')) {
        return Promise.reject(new DOMException('Controlled SVG fallback', 'InvalidStateError'));
      }
      return Reflect.apply(originalBitmap, window, [image, ...args]);
    }) as typeof window.createImageBitmap;
    const originalDecode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      const image = this;
      return originalDecode.call(image).then(async () => {
        if (!image.src.startsWith('blob:')) return;
        probe.started += 1;
        if (!probe.released) await new Promise<void>((resolve) => pending.push(resolve));
        probe.completed += 1;
      });
    };
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (url) => {
      if (url.startsWith('blob:')) probe.revoked += 1;
      originalRevoke.call(URL, url);
    };
  });

  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const viewport = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __rasterDecodeProbe: DecodeProbe }).__rasterDecodeProbe.started
  )), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(viewport).toHaveAttribute('data-map-raster-ready', 'false');
  await expect(viewport).toHaveAttribute('data-map-zoom-active', 'false');

  const result = await viewport.evaluate(async (container) => {
    const probe = (window as typeof window & { __rasterDecodeProbe: DecodeProbe }).__rasterDecodeProbe;
    const raster = container.querySelector<HTMLCanvasElement>('.province-map-camera-raster');
    const svg = container.querySelector<SVGSVGElement>('.province-map-world-svg');
    const surface = container.querySelector<HTMLElement>('.province-map-camera-surface');
    if (!raster || !svg || !surface) throw new Error('Map raster fixture is incomplete');
    const before = { revision: container.dataset.mapRasterRevision ?? '0', width: raster.width, height: raster.height };
    const bounds = container.getBoundingClientRect();
    const wheel = () => container.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true,
      clientX: bounds.left + bounds.width * 0.54,
      clientY: bounds.top + bounds.height * 0.47,
      deltaY: -18,
    }));
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    wheel();
    await nextFrame();
    // Release an already-decoded image while the real Camera is in fallback.
    // This is a deterministic barrier, not a sleep guessing decoder latency.
    probe.release();
    const frames = [];
    for (let index = 0; index < 8; index += 1) {
      wheel();
      await nextFrame();
      frames.push({
        index,
        active: container.dataset.mapZoomActive,
        ready: container.dataset.mapRasterReady,
        revision: container.dataset.mapRasterRevision ?? '0',
        width: raster.width,
        height: raster.height,
        rasterOpacity: getComputedStyle(raster).opacity,
        svgOpacity: getComputedStyle(svg).opacity,
        surfaceTransform: getComputedStyle(surface).transform,
      });
    }
    return { before, frames, completed: probe.completed, revoked: probe.revoked };
  });
  await testInfo.attach('map-raster-decode-lifecycle.json', {
    body: Buffer.from(JSON.stringify(result, null, 2)), contentType: 'application/json',
  });
  expect(result.completed).toBeGreaterThan(0);
  expect(result.revoked).toBeGreaterThan(0);
  for (const frame of result.frames) {
    expect(frame.active).toBe('true');
    expect(frame.ready).toBe('false');
    expect(frame.revision).toBe(result.before.revision);
    expect(frame.width).toBe(result.before.width);
    expect(frame.height).toBe(result.before.height);
    expect(frame.rasterOpacity).toBe('0');
    expect(frame.svgOpacity).toBe('1');
    expect(frame.surfaceTransform).not.toBe('none');
  }

  await expect(viewport).toHaveAttribute('data-map-zoom-active', 'false');
  await expect(viewport).toHaveAttribute('data-map-raster-ready', 'true', { timeout: 15_000 });
  await expect.poll(async () => Number(await viewport.getAttribute('data-map-raster-revision')))
    .toBeGreaterThan(Number(result.before.revision));
  await expect(viewport.locator('.province-map-world-svg')).toHaveCount(1);
  await expect(viewport.locator('.province-map-camera-raster')).toHaveCount(1);
  await expect(viewport.locator('.province-map-camera-raster')).toHaveCSS('opacity', '0');
  await expect(viewport.locator('.province-map-world-svg')).toHaveCSS('opacity', '1');
  await expect(viewport.locator('.province-map-camera-surface')).toHaveCSS('transform', 'none');
});
