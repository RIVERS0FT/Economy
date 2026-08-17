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

test('persistent US strategy map exposes 48 states, lenses, and local context', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-province-count', '48');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-feature-count', '48');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  await expect(page.locator('.application-map-layer')).toBeVisible();
  await expect(page.locator('.application-ui-layer')).toBeVisible();
  await expect(page.locator('.workspace-strategic-chrome')).toBeVisible();
  await expect(page.locator('.strategic-province-inspector')).toHaveCount(0);
  await expect(page.locator('.application-map-layer > .strategic-map-lens-bar')).toBeVisible();
  await expect(page.locator('.province-map-page')).toHaveCount(1);
  await expect(page.locator('.province-map-page > *')).toHaveCount(0);
  await expect(page.getByText('战略经营地图', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('地图图例')).toHaveCount(0);
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-map-fit-mode', 'contain');
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-map-contain-viewport', '1440x900');

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

  const svg = map.locator('svg');
  await expect(svg).toBeVisible();
  expect(await svg.locator('path').count()).toBeGreaterThanOrEqual(48);
  for (const excludedCode of ['AK', 'HI', 'DC']) {
    await expect(svg.getByText(excludedCode, { exact: true })).toHaveCount(0);
  }
  const renderedRegionLabels = await svg.locator('text').allTextContents();
  for (const name of ['CA', 'TX', 'WA', 'FL', 'NY']) expect(renderedRegionLabels).toContain(name);

  const instanceId = await map.locator('.economy-chart__canvas').getAttribute('data-echarts-instance-id');
  const visualBeforeProvincePage = await readMapVisualState(page);
  const coloradoLabel = svg.locator('text').filter({ hasText: /^CO$/ });
  const coloradoBox = await coloradoLabel.boundingBox();
  expect(coloradoBox).not.toBeNull();
  await page.mouse.move(
    (coloradoBox?.x ?? 0) + (coloradoBox?.width ?? 0) / 2,
    (coloradoBox?.y ?? 0) + (coloradoBox?.height ?? 0) / 2,
  );
  await page.mouse.wheel(0, -480);
  await expect.poll(async () => {
    const outline = await readOutlineGeometry(page);
    return outline.right - outline.left;
  }).toBeGreaterThan((geometry.pathBounds.right - geometry.pathBounds.left) * 1.05);
  const cameraBeforeSelection = await readOutlineGeometry(page);
  await coloradoLabel.click();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '150000');
  await expect(page.getByRole('heading', { name: '科罗拉多州', exact: true })).toBeVisible();
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
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute(
    'data-map-camera-reset',
    'blank-double-click',
  );
  await page.waitForTimeout(320);
  const cameraAfterBlankDoubleClick = await readOutlineGeometry(page);
  expect(cameraAfterBlankDoubleClick.left).toBeCloseTo(geometry.pathBounds.left, 0);
  expect(cameraAfterBlankDoubleClick.top).toBeCloseTo(geometry.pathBounds.top, 0);
  expect(cameraAfterBlankDoubleClick.right).toBeCloseTo(geometry.pathBounds.right, 0);
  expect(cameraAfterBlankDoubleClick.bottom).toBeCloseTo(geometry.pathBounds.bottom, 0);
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');

  await coloradoLabel.click();
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

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-map-contain-viewport', '900x900');
  const resizedOutline = await readOutlineGeometry(page);
  expect(resizedOutline.left).toBeGreaterThanOrEqual(-1);
  expect(resizedOutline.top).toBeGreaterThanOrEqual(-1);
  expect(resizedOutline.right).toBeLessThanOrEqual(901);
  expect(resizedOutline.bottom).toBeLessThanOrEqual(901);
  expect(resizedOutline.right - resizedOutline.left).toBeGreaterThanOrEqual(846);
  expect(resizedOutline.outlineAspect).toBeCloseTo(geometry.pathBounds.outlineAspect, 2);
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-echarts-instance-id', instanceId || '');

  const visualBeforeNotification = await readMapVisualState(page);
  await page.getByRole('button', { name: /^通知，/ }).click();
  await expect(page.getByRole('dialog', { name: '通知' })).toBeVisible();
  await expect(page.locator('.notification-panel-layer')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  expect(await readMapVisualState(page)).toEqual(visualBeforeNotification);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await expect(page.locator('.province-map-page')).toBeVisible();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-echarts-instance-id', instanceId || '');

  await page.getByRole('navigation', { name: '地图镜头' }).getByRole('button', { name: '市场', exact: true }).click();
  await expect(page.locator('.strategic-map-stage')).toHaveAttribute('data-map-lens', 'market');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-lens', 'market');

  await page.getByRole('navigation', { name: '游戏主导航' })
    .getByRole('button', { name: '市场', exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __lastSelectedTab?: string }).__lastSelectedTab)).toBe('market');
  await expect(page.getByRole('heading', { name: '科罗拉多州市场', exact: true })).toBeVisible();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  await expect(page.getByLabel('州级地区', { exact: true })).toHaveCount(0);
  await expect(page.locator('.province-context-select')).toHaveCount(0);
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-echarts-instance-id', instanceId || '');

  await page.getByRole('navigation', { name: '游戏主导航' })
    .getByRole('button', { name: '建筑', exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __lastSelectedTab?: string }).__lastSelectedTab)).toBe('buildings');
  await expect(page.getByRole('heading', { name: '科罗拉多州建筑', exact: true })).toBeVisible();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  await expect(page.getByLabel('州级地区', { exact: true })).toHaveCount(0);
  await expect(page.locator('.province-context-select')).toHaveCount(0);
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-echarts-instance-id', instanceId || '');
});

test('mobile strategy map fills the root map layer without obsolete map cards or inspector', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await map.locator('svg text').filter({ hasText: /^CO$/ }).click();
  await expect(page.getByRole('heading', { name: '科罗拉多州', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-map-contain-viewport', '390x844');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-feature-count', '48');
  await expect(page.locator('.strategic-province-inspector')).toHaveCount(0);
  await expect(page.locator('.application-map-layer > .strategic-map-lens-bar')).toBeHidden();
  await expect(page.locator('.province-map-page > *')).toHaveCount(0);
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-map-fit-mode', 'contain');
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-map-contain-viewport', '390x844');

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
  for (const excludedCode of ['AK', 'HI', 'DC']) {
    await expect(map.locator('svg').getByText(excludedCode, { exact: true })).toHaveCount(0);
  }

  await expect(page.getByRole('tablist', { name: '科罗拉多州页面分区' }).getByRole('tab')).toHaveCount(4);
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '150000');
  const mobileLayout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(mobileLayout.scrollWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth);
});
