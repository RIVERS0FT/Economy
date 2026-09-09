import { expect, test, type Locator } from '@playwright/test';

const examples = [
  { kind: 'industrial', technologyId: 'metallurgical-engineering', selector: '.facility-icon', attribute: 'data-facility-icon', assetId: 'steelworks' },
  { kind: 'product', technologyId: 'powered-production', selector: '.product-artwork', attribute: 'data-product-artwork', assetId: 'tools' },
  { kind: 'commercial', technologyId: 'urban-commerce', selector: '.commercial-building-artwork', attribute: 'data-commercial-artwork', assetId: 'restaurant' },
] as const;

async function expectFilledArtwork(frame: Locator, selector: string) {
  const clip = frame.locator(':scope > .research-artwork-clip');
  const image = clip.locator(`:scope > ${selector}`);
  await expect(clip).toHaveCount(1);
  await expect(image).toHaveCount(1);
  const geometry = await clip.evaluate((element) => {
    const parent = element.parentElement!;
    const image = element.firstElementChild!;
    const clipBox = element.getBoundingClientRect();
    const imageBox = image.getBoundingClientRect();
    const clipStyle = getComputedStyle(element);
    return {
      parentWidth: parent.clientWidth,
      parentHeight: parent.clientHeight,
      width: Number.parseFloat(clipStyle.width),
      height: Number.parseFloat(clipStyle.height),
      widthRatio: imageBox.width / clipBox.width,
      heightRatio: imageBox.height / clipBox.height,
      leftDelta: imageBox.left - clipBox.left,
      topDelta: imageBox.top - clipBox.top,
      position: clipStyle.position,
      overflow: clipStyle.overflow,
      radius: clipStyle.borderRadius,
      parentRadius: getComputedStyle(parent).borderRadius,
    };
  });
  // Test the actual image, not only the outer frame: 1.25rem icons used to
  // pass the existing detail-frame geometry checks while still looking tiny.
  expect(geometry.width).toBeGreaterThan(30);
  expect(geometry.height).toBeGreaterThan(30);
  expect(Math.abs(geometry.width - geometry.parentWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.height - geometry.parentHeight)).toBeLessThanOrEqual(1);
  expect(geometry.widthRatio).toBeCloseTo(1, 2);
  expect(geometry.heightRatio).toBeCloseTo(1, 2);
  expect(Math.abs(geometry.leftDelta)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.topDelta)).toBeLessThanOrEqual(1);
  expect(geometry.position).toBe('absolute');
  expect(geometry.overflow).toBe('hidden');
  expect(geometry.radius).toBe(geometry.parentRadius);
  expect(geometry.radius).not.toBe('0px');
}

for (const viewportSize of [
  { width: 1600, height: 1000 },
  { width: 390, height: 844 },
  { width: 320, height: 700 },
]) {
  for (const example of examples) {
    test(`${example.kind} research artwork fills and clips nodes and details at ${viewportSize.width}px`, async ({ page }) => {
      await page.setViewportSize(viewportSize);
      await page.goto('runtime-test.html?view=research&scenario=research-active');
      const viewport = page.locator('.research-tree-viewport');
      const node = page.locator(`.research-technology-node[data-technology-id="${example.technologyId}"]`);
      const frame = node.locator('.research-facility-artwork');
      await expect(node).toBeAttached();
      await expectFilledArtwork(frame, example.selector);
      await expect(frame.locator(example.selector)).toHaveAttribute(example.attribute, example.assetId);
      await expect(frame).toHaveCSS('overflow', 'visible');
      await expect(frame.locator('.research-artwork-clip')).toHaveCSS('border-radius', '50%');

      const worldBefore = await node.evaluate((element) => ({
        x: (element as HTMLElement).style.getPropertyValue('--research-node-x'),
        y: (element as HTMLElement).style.getPropertyValue('--research-node-y'),
      }));
      const viewportBox = await viewport.boundingBox();
      expect(viewportBox).not.toBeNull();
      await page.mouse.move(viewportBox!.x + viewportBox!.width - 24, viewportBox!.y + 24);
      await page.mouse.wheel(0, -2_000);
      await expect.poll(async () => Number(await viewport.getAttribute('data-zoom'))).toBeCloseTo(1.6, 2);
      await expect(viewport).not.toHaveAttribute('data-transforming', 'true');
      await expectFilledArtwork(frame, example.selector);

      const activeFrame = page.locator('.research-technology-node[data-status="active"] .research-facility-artwork');
      const ring = await activeFrame.evaluate((element) => {
        const style = getComputedStyle(element, '::after');
        return {
          overflow: getComputedStyle(element).overflow,
          opacity: style.opacity,
          top: Number.parseFloat(style.top),
          mask: style.maskImage,
        };
      });
      expect(ring.overflow).toBe('visible');
      expect(ring.opacity).toBe('1');
      expect(ring.top).toBeLessThan(0);
      expect(ring.mask).not.toBe('none');
      await expect(page.locator('.research-technology-node[data-status="locked"] .research-facility-artwork').first())
        .toHaveCSS('filter', 'grayscale(1) brightness(0.62)');

      // Keyboard activation also reaches nodes outside the current pan window.
      await node.press('Enter');
      await expect(node).toHaveAttribute('aria-pressed', 'true');
      await expect(frame).not.toHaveCSS('box-shadow', 'none');
      const mobile = viewportSize.width <= 720;
      const detail = mobile
        ? page.locator('.mobile-detail-sheet .mobile-workspace-sheet-detail-view')
        : page.locator('.research-action-panel');
      const detailFrame = detail.locator('.research-detail-level-artwork');
      await expect(detailFrame).toBeVisible();
      await expectFilledArtwork(detailFrame, example.selector);
      await expect(detailFrame.locator(example.selector)).toHaveAttribute(example.attribute, example.assetId);
      const detailGeometry = await detailFrame.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        };
      });
      if (mobile) {
        expect(detailGeometry.width / detailGeometry.height).toBeCloseTo(4 / 5, 2);
      } else {
        expect(detailGeometry.width).toBeCloseTo(detailGeometry.rem * 4.5, 0);
        expect(detailGeometry.width).toBeCloseTo(detailGeometry.height, 0);
        await expect(detailFrame.locator('.research-artwork-clip')).toHaveCSS('border-radius', '50%');
      }
      if (example.kind === 'commercial') {
        await expect(detailFrame.locator(example.selector)).toHaveAttribute('preserveAspectRatio', 'xMidYMid slice');
      } else {
        await expect(detailFrame.locator(example.selector)).toHaveCSS('background-size', example.kind === 'product' ? 'contain' : 'cover');
        await expect(detailFrame.locator(example.selector)).not.toHaveCSS('background-image', 'none');
      }

      const unlockFrames = detail.locator('.research-unlock-artwork');
      expect(await unlockFrames.count()).toBeGreaterThan(0);
      for (const unlockFrame of await unlockFrames.all()) {
        await expectFilledArtwork(unlockFrame, ':is(.facility-icon, .commercial-building-artwork)');
      }
      // Product labels in the unlock list remain ordinary small inline icons.
      for (const output of await detail.locator('.facility-build-output-item > .product-artwork').all()) {
        const outputWidth = await output.evaluate((element) => Number.parseFloat(getComputedStyle(element).width));
        expect(outputWidth).toBeLessThan(30);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (mobile) {
        await page.keyboard.press('Escape');
        await expect(detail).toBeHidden();
        await expect(node).toBeFocused();
      }
      expect(await node.evaluate((element) => ({
        x: (element as HTMLElement).style.getPropertyValue('--research-node-x'),
        y: (element as HTMLElement).style.getPropertyValue('--research-node-y'),
      }))).toEqual(worldBefore);
      await expect.poll(async () => Number(await viewport.getAttribute('data-zoom'))).toBeCloseTo(1.6, 2);
    });
  }
}
