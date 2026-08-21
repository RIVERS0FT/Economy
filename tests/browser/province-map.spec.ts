import { expect, test, type Page } from '@playwright/test';

async function readOutlineGeometry(page: Page) {
  return page.evaluate(() => {
    const pathRects = [...document.querySelectorAll<SVGGraphicsElement>('.province-map-echart svg path')]
      .map((path) => path.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const left = Math.min(...pathRects.map((rect) => rect.left));
    const top = Math.min(...pathRects.map((rect) => rect.top));
    const right = Math.max(...pathRects.map((rect) => rect.right));
    const bottom = Math.max(...pathRects.map((rect) => rect.bottom));
    return {
      left,
      top,
      right,
      bottom,
      outlineAspect: (right - left) / (bottom - top),
    };
  });
}

async function readMapVisualState(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('.strategic-map-stage');
    const vignette = document.querySelector<HTMLElement>('.strategic-map-vignette');
    if (!stage || !vignette) throw new Error('map visual layers are missing');
    const stageStyle = getComputedStyle(stage);
    const vignetteStyle = getComputedStyle(vignette);
    return {
      stageBackground: stageStyle.backgroundImage,
      vignetteBackground: vignetteStyle.backgroundImage,
      vignetteOpacity: vignetteStyle.opacity,
    };
  });
}

async function findMapBlankPoint(page: Page) {
  return page.evaluate(() => {
    for (let y = 80; y < window.innerHeight - 80; y += 12) {
      for (let x = 80; x < window.innerWidth - 80; x += 12) {
        const target = document.elementFromPoint(x, y);
        if (
          target instanceof SVGSVGElement
          && target.closest('.economy-chart__canvas')
        ) return { x, y };
      }
    }
    throw new Error('no uncovered map blank point found');
  });
}

async function clickProvinceLabel(page: Page, provinceId: string) {
  const label = page.locator(`.province-map-label[data-province-id="${provinceId}"]`);
  await expect(label).toBeVisible();
  const point = await label.evaluate((element) => {
    const x = Number(element.getAttribute('data-label-center-x'));
    const y = Number(element.getAttribute('data-label-center-y'));
    const matrix = element.ownerSVGElement?.getScreenCTM();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) {
      throw new Error('province label center transform is missing');
    }
    return {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f,
    };
  });
  await page.mouse.click(point.x, point.y);
}

async function provinceLabelVisualWidth(page: Page, provinceId: string) {
  const box = await page.locator(`.province-map-label[data-province-id="${provinceId}"]`).boundingBox();
  if (!box) throw new Error(`province label ${provinceId} has no visual bounds`);
  return box.width;
}

test('persistent US strategy map exposes 48 states, lenses, and local context', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.economy-chart__canvas');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-province-count', '48');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-feature-count', '48');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-label-mode', 'curved-chinese-full-name');
  await expect(canvas).toHaveAttribute('data-map-label-mode', 'curved-chinese-full-name');
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');
  await expect(canvas).toHaveAttribute('data-map-label-camera-mode', 'shared-transform');
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', /^[1-9]\d*$/);
  await expect(canvas).toHaveAttribute('data-map-label-camera-sync-count', /^\d+$/);
  await expect(canvas).toHaveAttribute('data-map-tooltip-mode', 'desktop');
  await expect(page.locator('.application-map-layer')).toBeVisible();
  await expect(page.locator('.application-ui-layer')).toBeVisible();
  await expect(page.locator('.workspace-strategic-chrome')).toBeVisible();
  await expect(page.locator('.strategic-province-inspector')).toHaveCount(0);
  await expect(page.locator('.application-map-layer > .strategic-map-lens-bar')).toBeVisible();
  await expect(page.locator('.province-map-page')).toHaveCount(1);
  await expect(page.locator('.province-map-page > *')).toHaveCount(0);
  await expect(page.getByText('战略经营地图', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('地图图例')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-map-fit-mode', 'contain');
  await expect(canvas).toHaveAttribute('data-map-contain-viewport', '1440x900');

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`missing ${selector}`);
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return {
      viewport: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight },
      mapLayer: rect('.application-map-layer'),
      map: rect('.strategic-map-stage'),
      mapLayerOverflow: getComputedStyle(document.querySelector<HTMLElement>('.application-map-layer')!).overflow,
      mapStageOverflow: getComputedStyle(document.querySelector<HTMLElement>('.strategic-map-stage')!).overflow,
      edgeStyles: [
        '.application-map-layer',
        '.strategic-map-stage',
        '.province-map-chart',
        '.province-map-echart',
        '.province-map-echart .economy-chart__canvas',
      ].map((selector) => {
        const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
        return {
          borderTopWidth: style.borderTopWidth,
          borderRadius: style.borderRadius,
          outlineStyle: style.outlineStyle,
          boxShadow: style.boxShadow,
        };
      }),
      pathBounds: (() => {
        const paths = [...document.querySelectorAll<SVGGraphicsElement>('.province-map-echart svg path')]
          .map((path) => path.getBoundingClientRect())
          .filter((bounds) => bounds.width > 0 && bounds.height > 0);
        const left = Math.min(...paths.map((bounds) => bounds.left));
        const top = Math.min(...paths.map((bounds) => bounds.top));
        const right = Math.max(...paths.map((bounds) => bounds.right));
        const bottom = Math.max(...paths.map((bounds) => bounds.bottom));
        return { left, top, right, bottom, outlineAspect: (right - left) / (bottom - top) };
      })(),
    };
  });
  expect(geometry.mapLayer).toEqual(geometry.viewport);
  expect(geometry.map).toEqual(geometry.mapLayer);
  expect(geometry.mapLayerOverflow).toBe('hidden');
  expect(geometry.mapStageOverflow).toBe('visible');
  for (const edgeStyle of geometry.edgeStyles) {
    expect(edgeStyle).toEqual({
      borderTopWidth: '0px',
      borderRadius: '0px',
      outlineStyle: 'none',
      boxShadow: 'none',
    });
  }
  expect(geometry.pathBounds.left).toBeGreaterThanOrEqual(geometry.viewport.left - 1);
  expect(geometry.pathBounds.top).toBeGreaterThanOrEqual(geometry.viewport.top - 1);
  expect(geometry.pathBounds.right).toBeLessThanOrEqual(geometry.viewport.right + 1);
  expect(geometry.pathBounds.bottom).toBeLessThanOrEqual(geometry.viewport.bottom + 1);
  expect(geometry.pathBounds.right - geometry.pathBounds.left).toBeGreaterThanOrEqual(geometry.viewport.right * 0.94);

  const labelOverlay = map.locator('.province-map-label-overlay');
  await expect(labelOverlay).toBeVisible();
  const labels = labelOverlay.locator('.province-map-label');
  await expect(labels).toHaveCount(48);
  await expect(canvas).toHaveAttribute('data-map-label-geometry-mode', 'natural-ratio-rigid-glyphs');
  await expect(labelOverlay.locator('textPath')).toHaveCount(0);
  expect(await labels.locator('.province-map-label-glyph').count()).toBeGreaterThan(48);
  const fitValues = await labels.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-label-fit')));
  expect(fitValues.every((value) => value === 'inside')).toBe(true);
  const labelGeometry = await labels.evaluateAll((nodes) => nodes.map((node) => ({
    glyphMode: node.getAttribute('data-label-glyph-mode'),
    naturalAspect: Number(node.getAttribute('data-label-natural-aspect')),
    availableLength: Number(node.getAttribute('data-label-available-length')),
    availableHeight: Number(node.getAttribute('data-label-available-height')),
    usedWidth: Number(node.getAttribute('data-label-used-width')),
    usedHeight: Number(node.getAttribute('data-label-used-height')),
    axisAngle: Number(node.getAttribute('data-label-axis-angle')),
    glyphTransforms: [...node.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
      .map((glyph) => glyph.getAttribute('transform') || ''),
  })));
  expect(labelGeometry).toHaveLength(48);
  for (const geometry of labelGeometry) {
    expect(geometry.glyphMode).toBe('rigid');
    expect(Number.isFinite(geometry.axisAngle)).toBe(true);
    expect(geometry.availableLength).toBeGreaterThan(0);
    expect(geometry.availableHeight).toBeGreaterThan(0);
    expect(geometry.usedWidth).toBeGreaterThan(0);
    expect(geometry.usedHeight).toBeGreaterThan(0);
    expect(geometry.usedWidth).toBeLessThanOrEqual(geometry.availableLength + 0.6);
    expect(geometry.usedHeight).toBeLessThanOrEqual(geometry.availableHeight + 0.6);
    const usedAspect = geometry.usedWidth / geometry.usedHeight;
    expect(Math.abs(usedAspect - geometry.naturalAspect) / geometry.naturalAspect).toBeLessThan(0.035);
    expect(geometry.glyphTransforms.length).toBeGreaterThan(0);
    expect(geometry.glyphTransforms.every((transform) => /^translate\([^)]*\) rotate\([^)]*\)$/.test(transform))).toBe(true);
    expect(geometry.glyphTransforms.some((transform) => /scale/i.test(transform))).toBe(false);
  }
  const renderedRegionLabels = await labels.allTextContents();
  for (const name of ['加利福尼亚州', '得克萨斯州', '华盛顿州', '佛罗里达州', '纽约州']) {
    expect(renderedRegionLabels).toContain(name);
  }
  for (const code of ['CA', 'TX', 'WA', 'FL', 'NY', 'CO', 'AK', 'HI', 'DC']) {
    expect(renderedRegionLabels).not.toContain(code);
  }
  const curvedLabelCount = Number(await canvas.getAttribute('data-map-curved-label-count'));
  expect(curvedLabelCount).toBeGreaterThan(0);

  const instanceId = await canvas.getAttribute('data-echarts-instance-id');
  const visualBeforeProvincePage = await readMapVisualState(page);
  const coloradoLabel = page.locator('.province-map-label[data-province-id="150000"]');
  await expect(coloradoLabel).toHaveText('科罗拉多州');
  const coloradoBox = await coloradoLabel.boundingBox();
  expect(coloradoBox).not.toBeNull();
  const coloradoWidthBeforeZoom = await provinceLabelVisualWidth(page, '150000');
  const layoutRevisionBeforeRoam = await canvas.getAttribute('data-map-label-layout-revision');
  const cameraSyncBeforeRoam = Number(await canvas.getAttribute('data-map-label-camera-sync-count'));
  await page.mouse.move(
    (coloradoBox?.x ?? 0) + (coloradoBox?.width ?? 0) / 2,
    (coloradoBox?.y ?? 0) + (coloradoBox?.height ?? 0) / 2,
  );
  await page.mouse.wheel(0, -480);
  await expect.poll(async () => {
    const outline = await readOutlineGeometry(page);
    return outline.right - outline.left;
  }).toBeGreaterThan((geometry.pathBounds.right - geometry.pathBounds.left) * 1.05);
  await expect.poll(() => provinceLabelVisualWidth(page, '150000')).toBeGreaterThan(coloradoWidthBeforeZoom * 1.05);
  const zoomedOutline = await readOutlineGeometry(page);
  const zoomedColoradoWidth = await provinceLabelVisualWidth(page, '150000');
  const mapScale = (zoomedOutline.right - zoomedOutline.left) / (geometry.pathBounds.right - geometry.pathBounds.left);
  const labelScale = zoomedColoradoWidth / coloradoWidthBeforeZoom;
  expect(Math.abs(labelScale - mapScale) / mapScale).toBeLessThan(0.04);
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', layoutRevisionBeforeRoam || '');
  expect(Number(await canvas.getAttribute('data-map-label-camera-sync-count'))).toBeGreaterThan(cameraSyncBeforeRoam);
  const cameraBeforeSelection = await readOutlineGeometry(page);
  await clickProvinceLabel(page, '150000');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '150000');
  await expect(page.getByRole('heading', { name: '科罗拉多州', exact: true })).toBeVisible();
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', layoutRevisionBeforeRoam || '');
  await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-presentation', 'building');
  await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-page', 'province');
  const provinceTabs = page.getByRole('tablist', { name: '科罗拉多州页面分区' });
  await expect(provinceTabs.getByRole('tab', { name: '概览', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(provinceTabs.getByRole('tab', { name: '市场', exact: true })).toBeVisible();
  await expect(provinceTabs.getByRole('tab', { name: '建筑', exact: true })).toBeVisible();
  await expect(provinceTabs.getByRole('tab', { name: '仓库', exact: true })).toBeVisible();
  expect(await readMapVisualState(page)).toEqual(visualBeforeProvincePage);
  const cameraAfterSelection = await readOutlineGeometry(page);
  expect(cameraAfterSelection.left).toBeCloseTo(cameraBeforeSelection.left, 0);
  expect(cameraAfterSelection.top).toBeCloseTo(cameraBeforeSelection.top, 0);
  expect(cameraAfterSelection.right).toBeCloseTo(cameraBeforeSelection.right, 0);
  expect(cameraAfterSelection.bottom).toBeCloseTo(cameraBeforeSelection.bottom, 0);

  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  const blankPoint = await findMapBlankPoint(page);
  await page.mouse.dblclick(blankPoint.x, blankPoint.y);
  await expect(canvas).toHaveAttribute('data-map-camera-reset', 'blank-double-click');
  await page.waitForTimeout(320);
  const cameraAfterBlankDoubleClick = await readOutlineGeometry(page);
  expect(cameraAfterBlankDoubleClick.left).toBeCloseTo(geometry.pathBounds.left, 0);
  expect(cameraAfterBlankDoubleClick.top).toBeCloseTo(geometry.pathBounds.top, 0);
  expect(cameraAfterBlankDoubleClick.right).toBeCloseTo(geometry.pathBounds.right, 0);
  expect(cameraAfterBlankDoubleClick.bottom).toBeCloseTo(geometry.pathBounds.bottom, 0);
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');

  await clickProvinceLabel(page, '150000');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '150000');
  await expect(page.getByRole('heading', { name: '科罗拉多州', exact: true })).toBeVisible();

  await provinceTabs.getByRole('tab', { name: '市场', exact: true }).click();
  await expect(provinceTabs.getByRole('tab', { name: '市场', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.market-catalog-surface')).toBeVisible();
  await page.getByRole('button', { name: '查看机械详情', exact: true }).click();
  await expect(page.getByRole('button', { name: '返回商品列表', exact: true })).toBeVisible();
  await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-page', 'province');
  await page.getByRole('button', { name: '返回商品列表', exact: true }).click();

  await provinceTabs.getByRole('tab', { name: '建筑', exact: true }).click();
  await expect(provinceTabs.getByRole('tab', { name: '建筑', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.production-workspace')).toBeVisible();
  await expect(page.locator('.factory-warehouse-card')).toHaveCount(0);

  await provinceTabs.getByRole('tab', { name: '仓库', exact: true }).click();
  await expect(page.locator('.province-warehouse-section')).toBeVisible();
  await provinceTabs.getByRole('tab', { name: '仓库', exact: true }).press('Home');
  await expect(provinceTabs.getByRole('tab', { name: '概览', exact: true })).toBeFocused();
  await expect(provinceTabs.getByRole('tab', { name: '概览', exact: true })).toHaveAttribute('aria-selected', 'true');

  const layoutRevisionBeforeResize = Number(await canvas.getAttribute('data-map-label-layout-revision'));
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(canvas).toHaveAttribute('data-map-contain-viewport', '900x900');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-label-layout-revision')))
    .toBeGreaterThan(layoutRevisionBeforeResize);
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');
  const resizedOutline = await readOutlineGeometry(page);
  expect(resizedOutline.left).toBeGreaterThanOrEqual(-1);
  expect(resizedOutline.top).toBeGreaterThanOrEqual(-1);
  expect(resizedOutline.right).toBeLessThanOrEqual(901);
  expect(resizedOutline.bottom).toBeLessThanOrEqual(901);
  expect(resizedOutline.right - resizedOutline.left).toBeGreaterThanOrEqual(846);
  expect(resizedOutline.outlineAspect).toBeCloseTo(geometry.pathBounds.outlineAspect, 2);
  await expect(canvas).toHaveAttribute('data-echarts-instance-id', instanceId || '');

  const visualBeforeNotification = await readMapVisualState(page);
  await page.getByRole('button', { name: /^通知，/ }).click();
  await expect(page.getByRole('dialog', { name: '通知' })).toBeVisible();
  await expect(page.locator('.notification-panel-layer')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  expect(await readMapVisualState(page)).toEqual(visualBeforeNotification);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __lastSelectedTab?: string }).__lastSelectedTab)).toBe('map');
  await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-page', 'map');
  await expect(page.locator('.province-map-page')).toHaveCount(1);
  await expect(page.locator('.province-map-page > *')).toHaveCount(0);
  await expect(page.locator('.strategic-map-stage')).toBeVisible();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  await expect(canvas).toHaveAttribute('data-echarts-instance-id', instanceId || '');

  const layoutRevisionBeforeLens = await canvas.getAttribute('data-map-label-layout-revision');
  await page.getByRole('navigation', { name: '地图镜头' }).getByRole('button', { name: '市场', exact: true }).click();
  await expect(page.locator('.strategic-map-stage')).toHaveAttribute('data-map-lens', 'market');
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', layoutRevisionBeforeLens || '');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-lens', 'market');

  await page.getByRole('navigation', { name: '游戏主导航' })
    .getByRole('button', { name: '市场', exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __lastSelectedTab?: string }).__lastSelectedTab)).toBe('market');
  await expect(page.getByRole('heading', { name: '科罗拉多州市场', exact: true })).toBeVisible();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  await expect(page.getByLabel('州级地区', { exact: true })).toHaveCount(0);
  await expect(page.locator('.province-context-select')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-echarts-instance-id', instanceId || '');

  await page.getByRole('navigation', { name: '游戏主导航' })
    .getByRole('button', { name: '建筑', exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __lastSelectedTab?: string }).__lastSelectedTab)).toBe('buildings');
  await expect(page.getByRole('heading', { name: '科罗拉多州建筑', exact: true })).toBeVisible();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  await expect(page.getByLabel('州级地区', { exact: true })).toHaveCount(0);
  await expect(page.locator('.province-context-select')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-echarts-instance-id', instanceId || '');
});

test('mobile strategy map fills the root map layer without obsolete map cards or inspector', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.economy-chart__canvas');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');
  await expect(canvas).toHaveAttribute('data-map-label-camera-mode', 'shared-transform');
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', /^[1-9]\d*$/);
  await expect(canvas).toHaveAttribute('data-map-label-camera-sync-count', /^\d+$/);
  await expect(canvas).toHaveAttribute('data-map-tooltip-mode', 'desktop');
  await clickProvinceLabel(page, '150000');
  await expect(page.getByRole('heading', { name: '科罗拉多州', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toHaveAttribute('data-map-contain-viewport', '390x844');
  await expect(canvas).toHaveAttribute('data-map-tooltip-mode', 'hidden-mobile');
  await expect(page.locator('.province-map-tooltip')).toBeHidden();
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-feature-count', '48');
  await expect(page.locator('.strategic-province-inspector')).toHaveCount(0);
  await expect(page.locator('.application-map-layer > .strategic-map-lens-bar')).toBeHidden();
  await expect(page.locator('.province-map-page > *')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-map-fit-mode', 'contain');
  await expect(canvas).toHaveAttribute('data-map-contain-viewport', '390x844');

  const geometry = await page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`missing ${selector}`);
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const pathRects = [...document.querySelectorAll<SVGGraphicsElement>('.province-map-echart svg path')]
      .map((path) => path.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    return {
      viewport: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight },
      mapLayer: box('.application-map-layer'),
      navigation: box('.mobile-bottom-navigation'),
      mapLeft: Math.min(...pathRects.map((rect) => rect.left)),
      mapTop: Math.min(...pathRects.map((rect) => rect.top)),
      mapRight: Math.max(...pathRects.map((rect) => rect.right)),
      mapBottom: Math.max(...pathRects.map((rect) => rect.bottom)),
      outlineAspect: (
        Math.max(...pathRects.map((rect) => rect.right))
        - Math.min(...pathRects.map((rect) => rect.left))
      ) / (
        Math.max(...pathRects.map((rect) => rect.bottom))
        - Math.min(...pathRects.map((rect) => rect.top))
      ),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.mapLayer).toEqual(geometry.viewport);
  expect(geometry.mapLeft).toBeGreaterThanOrEqual(geometry.mapLayer.left - 1);
  expect(geometry.mapTop).toBeGreaterThanOrEqual(geometry.mapLayer.top - 1);
  expect(geometry.mapRight).toBeLessThanOrEqual(geometry.mapLayer.right + 1);
  expect(geometry.mapBottom).toBeLessThanOrEqual(geometry.mapLayer.bottom + 1);
  expect(geometry.mapRight - geometry.mapLeft).toBeGreaterThanOrEqual(geometry.viewportWidth * 0.94);
  expect(geometry.outlineAspect).toBeGreaterThan(1);
  expect(geometry.navigation.top).toBeLessThan(geometry.mapLayer.bottom);

  const mobileLabels = await map.locator('.province-map-label').allTextContents();
  expect(mobileLabels).toHaveLength(48);
  for (const name of ['加利福尼亚州', '得克萨斯州', '科罗拉多州', '佛罗里达州', '纽约州']) {
    expect(mobileLabels).toContain(name);
  }
  for (const code of ['CA', 'TX', 'CO', 'FL', 'NY', 'AK', 'HI', 'DC']) {
    expect(mobileLabels).not.toContain(code);
  }

  await expect(page.getByRole('tablist', { name: '科罗拉多州页面分区' }).getByRole('tab')).toHaveCount(4);
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '150000');
  const mobileLayout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(mobileLayout.scrollWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth);
});


test('mobile strategy map keeps labels and blank-space gestures usable', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:1420/economy/',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  try {
    await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

    const map = page.getByTestId('us-mainland-map');
    const canvas = map.locator('.economy-chart__canvas');
    await expect(map).toHaveAttribute('data-echarts-ready', 'true');
    await expect(canvas).toHaveCSS('touch-action', 'none');
    await expect(canvas).toHaveAttribute('data-map-label-count', '48');
    await expect(canvas).toHaveAttribute('data-map-tooltip-mode', 'hidden-mobile');
    await expect(page.locator('.province-map-tooltip')).toBeHidden();

    const renderedLabels = await map.locator('.province-map-label').allTextContents();
    for (const name of ['加利福尼亚州', '得克萨斯州', '科罗拉多州', '佛罗里达州', '纽约州']) {
      expect(renderedLabels).toContain(name);
    }
    for (const code of ['CA', 'TX', 'CO', 'FL', 'NY']) expect(renderedLabels).not.toContain(code);

    const stateFills = await map.locator('svg:not(.province-map-label-overlay) path').evaluateAll((paths) => paths
      .map((mapPath) => getComputedStyle(mapPath).fill)
      .filter((fill) => fill.startsWith('rgb')));
    expect(stateFills.length).toBeGreaterThanOrEqual(48);
    expect(stateFills.some((fill) => fill === 'rgb(0, 0, 0)' || fill === 'rgba(0, 0, 0, 1)')).toBe(false);

    const initialOutline = await readOutlineGeometry(page);
    const initialColoradoVisualWidth = await provinceLabelVisualWidth(page, '150000');
    const mobileLayoutRevisionBeforeRoam = await canvas.getAttribute('data-map-label-layout-revision');
    const mobileCameraSyncBeforeRoam = Number(await canvas.getAttribute('data-map-label-camera-sync-count'));
    let blankPoint = await findMapBlankPoint(page);
    await page.mouse.move(blankPoint.x, blankPoint.y);
    await page.mouse.wheel(0, -480);
    await expect.poll(async () => {
      const outline = await readOutlineGeometry(page);
      return outline.right - outline.left;
    }).toBeGreaterThan((initialOutline.right - initialOutline.left) * 1.05);
    await expect.poll(() => provinceLabelVisualWidth(page, '150000')).toBeGreaterThan(initialColoradoVisualWidth * 1.05);
    await expect(canvas).toHaveAttribute('data-map-label-layout-revision', mobileLayoutRevisionBeforeRoam || '');
    expect(Number(await canvas.getAttribute('data-map-label-camera-sync-count'))).toBeGreaterThan(mobileCameraSyncBeforeRoam);

    blankPoint = await findMapBlankPoint(page);
    const beforeBlankPan = await readOutlineGeometry(page);
    await page.mouse.move(blankPoint.x, blankPoint.y);
    await page.mouse.down();
    await page.mouse.move(blankPoint.x + 42, blankPoint.y + 24, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => {
      const outline = await readOutlineGeometry(page);
      return Math.abs(outline.left - beforeBlankPan.left) + Math.abs(outline.top - beforeBlankPan.top);
    }).toBeGreaterThan(8);

    blankPoint = await findMapBlankPoint(page);
    await page.touchscreen.tap(blankPoint.x, blankPoint.y);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(blankPoint.x, blankPoint.y);
    await expect(canvas).toHaveAttribute('data-map-camera-reset', 'blank-double-tap');
    await page.waitForTimeout(320);
    const resetOutline = await readOutlineGeometry(page);
    expect(resetOutline.left).toBeCloseTo(initialOutline.left, 0);
    expect(resetOutline.top).toBeCloseTo(initialOutline.top, 0);
    expect(resetOutline.right).toBeCloseTo(initialOutline.right, 0);
    expect(resetOutline.bottom).toBeCloseTo(initialOutline.bottom, 0);
    await expect(canvas).toHaveAttribute('data-map-label-count', '48');
    await expect(canvas).toHaveAttribute('data-map-tooltip-mode', 'hidden-mobile');
    await expect(page.locator('.province-map-tooltip')).toBeHidden();
  } finally {
    await context.close();
  }
});