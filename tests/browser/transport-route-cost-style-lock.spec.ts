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

test('transport draft line style follows mode and map editor clears desktop and mobile status bars', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^运输/ }).click();
  await page.locator('.transport-page-actions').getByRole('button', { name: '增加路线', exact: true }).click();

  const statusBar = page.locator('.asset-bar');
  const pickingBar = page.locator('.transport-map-picking-bar');
  await expect(pickingBar).toBeVisible();
  const [desktopStatusBox, desktopPickingBox] = await Promise.all([statusBar.boundingBox(), pickingBar.boundingBox()]);
  expect(desktopStatusBox).not.toBeNull();
  expect(desktopPickingBox).not.toBeNull();
  expect(desktopPickingBox!.y).toBeGreaterThanOrEqual(desktopStatusBox!.y + desktopStatusBox!.height - 1);

  await provinceRegion(page, '加利福尼亚').click();
  await provinceRegion(page, '得克萨斯').click();

  const draft = page.locator('.province-map-route[data-route-kind="draft"]');
  await expect(draft).toHaveAttribute('data-route-id', 'draft-road-route');
  const roadDash = await draft.locator('.province-map-route-path').evaluate((element) => getComputedStyle(element).strokeDasharray);

  await chooseRichSelectOption(page, pickingBar, '运输方式', '铁路运输');
  await expect(draft).toHaveAttribute('data-route-id', 'draft-rail-route');
  const railDash = await draft.locator('.province-map-route-path').evaluate((element) => getComputedStyle(element).strokeDasharray);

  await chooseRichSelectOption(page, pickingBar, '运输方式', '航空运输');
  await expect(draft).toHaveAttribute('data-route-id', 'draft-air-route');
  const airDash = await draft.locator('.province-map-route-path').evaluate((element) => getComputedStyle(element).strokeDasharray);

  expect(new Set([roadDash, railDash, airDash]).size).toBe(3);
  await expect(pickingBar.locator('.transport-map-picking-cost')).toContainText('一次性建线费');
  await expect(pickingBar.locator('.transport-map-picking-cost')).not.toContainText('选择完整路线后计算');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(pickingBar).toBeVisible();
  const [mobileStatusBox, mobilePickingBox] = await Promise.all([statusBar.boundingBox(), pickingBar.boundingBox()]);
  expect(mobileStatusBox).not.toBeNull();
  expect(mobilePickingBox).not.toBeNull();
  expect(mobilePickingBox!.y).toBeGreaterThanOrEqual(mobileStatusBox!.y + mobileStatusBox!.height - 1);
  expect(mobilePickingBox!.y + mobilePickingBox!.height).toBeLessThanOrEqual(844 + 1);
});

test('scrolling page content uses divider sections instead of rounded cards', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^运输/ }).click();

  await expect(page.locator('.transport-route-card')).toHaveCount(0);
  await expect(page.getByText('暂无运输路线。选择“增加路线”后直接在地图上依次选择站点。')).toBeVisible();

  const visual = await page.locator('.page-card-scroll').evaluate((container) => {
    const routeGrid = document.createElement('div');
    routeGrid.className = 'transport-route-grid';
    const firstRow = document.createElement('button');
    firstRow.className = 'transport-route-card';
    const lastRow = document.createElement('button');
    lastRow.className = 'transport-route-card';
    routeGrid.append(firstRow, lastRow);

    const legacyPanel = document.createElement('article');
    legacyPanel.className = 'panel leaderboard-board-card';

    const sectionGroup = document.createElement('div');
    sectionGroup.className = 'transport-page-content';
    const firstSection = document.createElement('section');
    firstSection.className = 'transport-page-section';
    const secondSection = document.createElement('section');
    secondSection.className = 'transport-page-section';
    sectionGroup.append(firstSection, secondSection);

    container.append(routeGrid, legacyPanel, sectionGroup);

    const firstStyle = getComputedStyle(firstRow);
    const lastStyle = getComputedStyle(lastRow);
    const panelStyle = getComputedStyle(legacyPanel);
    const firstSectionStyle = getComputedStyle(firstSection);
    const secondSectionStyle = getComputedStyle(secondSection);
    const result = {
      routeBorderRadius: firstStyle.borderRadius,
      routeBorderBottomWidth: firstStyle.borderBottomWidth,
      routeBorderBottomStyle: firstStyle.borderBottomStyle,
      routeLastBorderBottomWidth: lastStyle.borderBottomWidth,
      panelBorderRadius: panelStyle.borderRadius,
      panelBorderTopWidth: panelStyle.borderTopWidth,
      panelBackdropFilter: panelStyle.backdropFilter,
      firstSectionBorderTopWidth: firstSectionStyle.borderTopWidth,
      secondSectionBorderTopWidth: secondSectionStyle.borderTopWidth,
      secondSectionBorderTopStyle: secondSectionStyle.borderTopStyle,
    };

    routeGrid.remove();
    legacyPanel.remove();
    sectionGroup.remove();
    return result;
  });

  expect(visual.routeBorderRadius).toBe('0px');
  expect(visual.routeBorderBottomWidth).toBe('1px');
  expect(visual.routeBorderBottomStyle).toBe('solid');
  expect(visual.routeLastBorderBottomWidth).toBe('0px');
  expect(visual.panelBorderRadius).toBe('0px');
  expect(visual.panelBorderTopWidth).toBe('1px');
  expect(visual.panelBackdropFilter).toBe('none');
  expect(visual.firstSectionBorderTopWidth).toBe('0px');
  expect(visual.secondSectionBorderTopWidth).toBe('1px');
  expect(visual.secondSectionBorderTopStyle).toBe('solid');
});
