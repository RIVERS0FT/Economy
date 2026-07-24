import { expect, test, type Locator, type Page } from '@playwright/test';

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function gridTrackCount(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).gridTemplateColumns
    .split(' ')
    .filter(Boolean)
    .length);
}

async function expectUniformPageSectionGaps(page: Page) {
  const result = await page.locator('.ui-page-stack').evaluate((element) => {
    const stack = element as HTMLElement;
    const expected = Number.parseFloat(getComputedStyle(stack).rowGap);
    const children = Array.from(stack.children).filter((child) => {
      const style = getComputedStyle(child);
      const rect = child.getBoundingClientRect();
      return style.display !== 'none'
        && style.position !== 'absolute'
        && style.position !== 'fixed'
        && rect.width > 0
        && rect.height > 0;
    });
    const actual = children.slice(1).map((child, index) => {
      const previous = children[index];
      return child.getBoundingClientRect().top - previous.getBoundingClientRect().bottom;
    });
    return { expected, actual };
  });

  expect(result.expected).toBeGreaterThan(0);
  expect(result.actual.length).toBeGreaterThan(0);
  for (const gap of result.actual) {
    expect(Math.abs(gap - result.expected)).toBeLessThanOrEqual(1);
  }
}

async function expectContractTabsDoNotOverlap(page: Page) {
  const container = page.locator('.contract-tabs');
  const tabs = page.getByRole('tab');
  const layout = await container.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      display: style.display,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      touchAction: style.touchAction,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  });

  expect(layout.display).toBe('flex');
  expect(layout.overflowX).toBe('auto');
  expect(layout.overflowY).toBe('hidden');
  expect(layout.touchAction).toContain('pan-x');
  expect(layout.touchAction).toContain('pan-y');
  expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth);
  await expect(tabs).toHaveCount(4);

  for (let index = 0; index < 4; index += 1) {
    const tab = tabs.nth(index);
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');

    const geometry = await container.evaluate((element) => {
      const containerRect = element.getBoundingClientRect();
      const tabElements = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
      const rects = tabElements.map((item) => {
        const rect = item.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      });
      const activeIndex = tabElements.findIndex((item) => item.getAttribute('aria-selected') === 'true');
      return {
        container: { left: containerRect.left, right: containerRect.right },
        rects,
        active: activeIndex >= 0 ? rects[activeIndex] : null,
      };
    });

    expect(geometry.active).not.toBeNull();
    for (let itemIndex = 1; itemIndex < geometry.rects.length; itemIndex += 1) {
      expect(geometry.rects[itemIndex].left).toBeGreaterThanOrEqual(geometry.rects[itemIndex - 1].right - 1);
    }
    for (const rect of geometry.rects) expect(rect.width).toBeGreaterThan(0);
    expect(geometry.active!.left).toBeGreaterThanOrEqual(geometry.container.left - 1);
    expect(geometry.active!.right).toBeLessThanOrEqual(geometry.container.right + 1);
  }
}

async function openContracts(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('runtime-test.html?view=contracts');
  await expect(page.getByRole('heading', { name: '合同', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: /进行中的合同/ })).toHaveAttribute('aria-selected', 'true');
}

test('desktop contract workspace uses shared controls and dense two-column layouts', async ({ page }) => {
  await openContracts(page, 1440, 900);

  expect(await gridTrackCount(page.locator('.contract-summary-grid'))).toBe(4);
  expect(await gridTrackCount(page.locator('.contract-detail-layout').first())).toBe(2);
  await expect(page.getByRole('checkbox', { name: '自动补充货款' })).toBeVisible();
  await expect(page.locator('.contract-card h2 .product-icon')).toHaveCount(1);
  await expectUniformPageSectionGaps(page);

  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(2);
  await expect(page.locator('.contract-direction-switch')).toBeVisible();
  await expect(page.getByRole('button', { name: '我长期采购', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expectUniformPageSectionGaps(page);

  const quantity = page.getByLabel('每批数量');
  const submit = page.locator('.contract-publish-preview').getByRole('button', { name: '发布合同', exact: true });
  await quantity.fill('');
  await expect(quantity).toHaveValue('');
  await expect(submit).toBeDisabled();
  await quantity.blur();
  await expect(quantity).toHaveValue('100');

  await page.getByRole('tab', { name: /合同广场/ }).click();
  expect(await gridTrackCount(page.locator('.contract-offer-grid'))).toBe(2);
  await expect(page.getByText('采购 机械', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /合同历史/ }).click();
  await expect(page.locator('.contract-history-panel')).toHaveCount(1);
  await expect(page.locator('.contract-history-row')).toHaveCount(1);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('tablet contract publish form keeps two-column fields', async ({ page }) => {
  await openContracts(page, 1100, 900);

  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-publish-grid'))).toBe(2);
  await expectUniformPageSectionGaps(page);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('mobile contract workspace keeps two-column summaries, scrollable tabs and full-size inputs', async ({ page }) => {
  await openContracts(page, 390, 844);

  expect(await gridTrackCount(page.locator('.contract-summary-grid'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-card-heading').first())).toBe(1);
  await expectContractTabsDoNotOverlap(page);
  await expectUniformPageSectionGaps(page);

  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-publish-grid'))).toBe(1);
  await expectUniformPageSectionGaps(page);

  const quantity = page.getByLabel('每批数量');
  const quantityBox = await requireBox(quantity);
  expect(quantityBox.height).toBeGreaterThanOrEqual(48);
  const quantityFontSize = await quantity.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(quantityFontSize).toBeGreaterThanOrEqual(16);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('narrow mobile contract tabs keep separate hit areas', async ({ page }) => {
  await openContracts(page, 320, 844);
  await expectContractTabsDoNotOverlap(page);
  await expectUniformPageSectionGaps(page);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
