import { expect, test } from '@playwright/test';

function provinceRegion(page: import('@playwright/test').Page, provinceName: string) {
  return page.locator(`.province-map-region[data-province-name="${provinceName}"]`);
}

async function chooseRichSelectOption(
  page: import('@playwright/test').Page,
  scope: import('@playwright/test').Locator,
  label: string,
  optionName: string,
) {
  const trigger = scope.getByRole('combobox', { name: label });
  await trigger.click();
  const listbox = page.getByRole('listbox', { name: label });
  await expect(listbox).toBeVisible();
  await listbox.getByRole('option', { name: optionName }).click();
}

test('transport draft line style and physical geometry follow mode while the map editor clears status bars', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^运输/ }).click();
  await page.locator('.transport-page-footer').getByRole('button', { name: '增加路线', exact: true }).click();

  const statusBar = page.locator('.asset-bar');
  const pickingBar = page.locator('.transport-map-picking-bar');
  await expect(pickingBar).toBeVisible();
  await expect(pickingBar).toHaveCSS('backdrop-filter', 'none');
  const [desktopStatusBox, desktopPickingBox] = await Promise.all([statusBar.boundingBox(), pickingBar.boundingBox()]);
  expect(desktopStatusBox).not.toBeNull();
  expect(desktopPickingBox).not.toBeNull();
  expect(desktopPickingBox!.y).toBeGreaterThanOrEqual(desktopStatusBox!.y + desktopStatusBox!.height - 1);

  await provinceRegion(page, '加利福尼亚').click();
  await provinceRegion(page, '得克萨斯').click();

  const map = page.locator('.province-map-chart');
  const draft = page.locator('.province-map-route[data-route-kind="draft"]');
  await expect(draft).toHaveAttribute('data-route-id', 'draft-road-route');
  await expect(draft).toHaveAttribute('data-route-geometry-source', 'network');
  expect(await draft.getAttribute('data-route-lane-owner-id')).toBeNull();
  expect(await draft.getAttribute('data-route-forward-lanes')).toBeNull();
  expect(await map.getAttribute('data-route-lane-edge-count')).toBeNull();
  const roadPath = await draft.locator('.province-map-route-path').getAttribute('d');
  const roadDash = await draft.locator('.province-map-route-path').evaluate((element) => getComputedStyle(element).strokeDasharray);
  await expect(draft.locator('.province-map-route-return-path')).toHaveCount(0);

  await chooseRichSelectOption(page, pickingBar, '运输方式', '铁路运输');
  await expect(draft).toHaveAttribute('data-route-id', 'draft-rail-route');
  await expect(draft).toHaveAttribute('data-route-geometry-source', 'network');
  expect(await draft.getAttribute('data-route-lane-owner-id')).toBeNull();
  expect(await draft.getAttribute('data-route-forward-lanes')).toBeNull();
  const railPath = await draft.locator('.province-map-route-path').getAttribute('d');
  const railDash = await draft.locator('.province-map-route-path').evaluate((element) => getComputedStyle(element).strokeDasharray);
  await expect(draft.locator('.province-map-route-return-path')).toHaveCount(0);

  await chooseRichSelectOption(page, pickingBar, '运输方式', '航空运输');
  await expect(draft).toHaveAttribute('data-route-id', 'draft-air-route');
  expect(await draft.getAttribute('data-route-lane-owner-id')).toBeNull();
  expect(await draft.getAttribute('data-route-forward-lanes')).toBeNull();
  const airPath = await draft.locator('.province-map-route-path').getAttribute('d');
  const airDash = await draft.locator('.province-map-route-path').evaluate((element) => getComputedStyle(element).strokeDasharray);
  await expect(draft.locator('.province-map-route-return-path')).toHaveCount(0);

  expect(new Set([roadDash, railDash, airDash]).size).toBe(3);
  expect(roadPath).toBeTruthy();
  expect(railPath).toBeTruthy();
  expect(airPath).toBeTruthy();
  expect(airPath).toMatch(/\sQ[-\d.]+\s[-\d.]+\s[-\d.]+\s[-\d.]+/u);
  expect(new Set([roadPath, railPath, airPath]).size).toBe(3);
  await expect(pickingBar.locator('.transport-map-picking-cost')).toContainText('一次性建线费');
  await expect(pickingBar.locator('.transport-map-picking-cost')).not.toContainText('选择完整路线后计算');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(pickingBar).toBeVisible();
  await expect(pickingBar).toHaveCSS('backdrop-filter', 'none');
  const [mobileStatusBox, mobilePickingBox] = await Promise.all([statusBar.boundingBox(), pickingBar.boundingBox()]);
  expect(mobileStatusBox).not.toBeNull();
  expect(mobilePickingBox).not.toBeNull();
  expect(mobilePickingBox!.y).toBeGreaterThanOrEqual(mobileStatusBox!.y + mobileStatusBox!.height - 1);
  expect(mobilePickingBox!.y + mobilePickingBox!.height).toBeLessThanOrEqual(844 + 1);
});

test('transport route cards stay rounded without row dividers and the add action stays pinned to the page bottom', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^运输/ }).click();

  await expect(page.locator('.transport-route-card')).toHaveCount(0);
  await expect(page.getByText('暂无运输路线。选择“增加路线”后直接在地图上依次选择站点。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '运输路线', exact: true })).toHaveCount(0);

  const footer = page.locator('.transport-page-footer');
  const addRoute = footer.getByRole('button', { name: '增加路线', exact: true });
  await expect(footer).toBeVisible();
  await expect(addRoute).toBeVisible();
  await expect(footer).toHaveText('增加路线');
  await expect(footer.locator('.ui-status-tag')).toHaveCount(0);
  await expect(footer).not.toContainText(/\d+\s*\/\s*50/);

  const visual = await page.locator('.page-card-scroll').evaluate((container) => {
    const routesPanel = container.querySelector<HTMLElement>('.transport-routes-panel');
    if (!routesPanel) throw new Error('transport routes panel missing');

    const routeGrid = document.createElement('div');
    routeGrid.className = 'transport-route-grid transport-route-style-fixture';
    for (let index = 0; index < 10; index += 1) {
      const routeCard = document.createElement('button');
      routeCard.type = 'button';
      routeCard.className = 'transport-route-card ui-entity-card';
      routeCard.style.minHeight = '160px';
      routeCard.textContent = `route-${index}`;
      routeGrid.append(routeCard);
    }
    routesPanel.prepend(routeGrid);

    const firstCard = routeGrid.firstElementChild as HTMLElement;
    const firstStyle = getComputedStyle(firstCard);
    const gridStyle = getComputedStyle(routeGrid);

    const legacyPanel = document.createElement('article');
    legacyPanel.className = 'panel leaderboard-board-card';

    const sectionGroup = document.createElement('div');
    sectionGroup.className = 'transport-page-content';
    const firstSection = document.createElement('section');
    firstSection.className = 'transport-page-section';
    const secondSection = document.createElement('section');
    secondSection.className = 'transport-page-section';
    sectionGroup.append(firstSection, secondSection);

    container.append(legacyPanel, sectionGroup);

    const panelStyle = getComputedStyle(legacyPanel);
    const firstSectionStyle = getComputedStyle(firstSection);
    const secondSectionStyle = getComputedStyle(secondSection);
    const result = {
      routeBorderRadius: firstStyle.borderRadius,
      routeBorderTopWidth: firstStyle.borderTopWidth,
      routeBorderBottomWidth: firstStyle.borderBottomWidth,
      routeBackground: firstStyle.backgroundColor,
      routeGridRowGap: gridStyle.rowGap,
      panelBorderRadius: panelStyle.borderRadius,
      panelBorderTopWidth: panelStyle.borderTopWidth,
      panelBackdropFilter: panelStyle.backdropFilter,
      firstSectionBorderTopWidth: firstSectionStyle.borderTopWidth,
      secondSectionBorderTopWidth: secondSectionStyle.borderTopWidth,
      secondSectionBorderTopStyle: secondSectionStyle.borderTopStyle,
      footerAlignSelf: getComputedStyle(footer).alignSelf,
      footerMarginTop: getComputedStyle(footer).marginTop,
    };

    legacyPanel.remove();
    sectionGroup.remove();
    return result;
  });

  expect(visual.routeBorderRadius).not.toBe('0px');
  expect(visual.routeBorderTopWidth).toBe('1px');
  expect(visual.routeBorderBottomWidth).toBe('1px');
  expect(visual.routeBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(visual.routeGridRowGap).not.toBe('0px');
  expect(visual.panelBorderRadius).toBe('0px');
  expect(visual.panelBorderTopWidth).toBe('1px');
  expect(visual.panelBackdropFilter).toBe('none');
  expect(visual.firstSectionBorderTopWidth).toBe('0px');
  expect(visual.secondSectionBorderTopWidth).toBe('1px');
  expect(visual.secondSectionBorderTopStyle).toBe('solid');
  expect(visual.footerAlignSelf).toBe('end');
  expect(visual.footerMarginTop).not.toBe('0px');

  const scroll = page.locator('.page-card-scroll');
  const [scrollBox, footerBefore] = await Promise.all([scroll.boundingBox(), footer.boundingBox()]);
  expect(scrollBox).not.toBeNull();
  expect(footerBefore).not.toBeNull();
  expect(footerBefore!.y + footerBefore!.height).toBeLessThanOrEqual(scrollBox!.y + scrollBox!.height + 1);

  const scrollTop = await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(scrollTop).toBeGreaterThan(0);
  const footerAfter = await footer.boundingBox();
  expect(footerAfter).not.toBeNull();
  expect(Math.abs(footerAfter!.y - footerBefore!.y)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(footer).toBeVisible();
  await expect(addRoute).toBeVisible();
  await expect(footer).toHaveText('增加路线');
  await expect(footer.locator('.ui-status-tag')).toHaveCount(0);
  await expect(footer).not.toContainText(/\d+\s*\/\s*50/);
  const [mobileScrollBox, mobileFooterBox] = await Promise.all([scroll.boundingBox(), footer.boundingBox()]);
  expect(mobileScrollBox).not.toBeNull();
  expect(mobileFooterBox).not.toBeNull();
  expect(mobileFooterBox!.y + mobileFooterBox!.height).toBeLessThanOrEqual(mobileScrollBox!.y + mobileScrollBox!.height + 1);
});
