import { expect, test, type Locator } from '@playwright/test';

async function inspectFacilityArtwork(slot: Locator) {
  await expect(slot).toBeVisible();
  const artwork = slot.locator(':scope > .facility-icon');
  await expect(artwork).toHaveAttribute('data-facility-icon', 'machine-factory');
  await expect.poll(() => artwork.evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain('machine-factory');

  return slot.evaluate((element) => {
    const slotElement = element as HTMLElement;
    const facilityIcon = slotElement.querySelector<HTMLElement>(':scope > .facility-icon');
    if (!facilityIcon) throw new Error('market facility artwork fixture is incomplete');

    const slotRect = slotElement.getBoundingClientRect();
    const artworkRect = facilityIcon.getBoundingClientRect();
    const artworkStyle = getComputedStyle(facilityIcon);
    return {
      slot: {
        width: slotRect.width,
        height: slotRect.height,
        left: slotRect.left + (slotRect.width - artworkRect.width) / 2,
        top: slotRect.top + (slotRect.height - artworkRect.height) / 2,
      },
      artwork: {
        width: artworkRect.width,
        height: artworkRect.height,
        left: artworkRect.left,
        top: artworkRect.top,
      },
      backgroundSize: artworkStyle.backgroundSize,
      backgroundPosition: artworkStyle.backgroundPosition,
      backgroundRepeat: artworkStyle.backgroundRepeat,
    };
  });
}

function expectContainedArtwork(
  metrics: Awaited<ReturnType<typeof inspectFacilityArtwork>>,
  slotSize: number,
  artworkSize: number,
) {
  expect(metrics.slot.width).toBeCloseTo(slotSize, 0);
  expect(metrics.slot.height).toBeCloseTo(slotSize, 0);
  expect(metrics.artwork.width).toBeCloseTo(artworkSize, 0);
  expect(metrics.artwork.height).toBeCloseTo(artworkSize, 0);
  expect(Math.abs(metrics.artwork.left - metrics.slot.left)).toBeLessThan(1.5);
  expect(Math.abs(metrics.artwork.top - metrics.slot.top)).toBeLessThan(1.5);
  expect(metrics.artwork.width).toBeLessThan(metrics.slot.width);
  expect(metrics.backgroundSize).toBe('cover');
  expect(metrics.backgroundPosition).toBe('50% 50%');
  expect(metrics.backgroundRepeat).toBe('no-repeat');
}

test('building subordinate facility trade artwork fits detail slots on desktop and mobile', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('runtime-test.html?view=production&scenario=facility-card-profit');
  await page.locator('.facility-cluster-selector-card').first().click();
  await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();
  await page.getByRole('button', { name: /交易该建筑资产/ }).click();
  expectContainedArtwork(await inspectFacilityArtwork(page.locator('.market-detail-hero__artwork')), 76, 68);

  await page.getByRole('button', { name: '返回建筑详情' }).click();
  await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const workspaceHost = page.locator('.mobile-workspace-sheet-host');
  await expect(workspaceHost).toHaveCount(1);
  await expect(workspaceHost).toHaveAttribute('data-detail-active', 'false');
  await expect(workspaceHost.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);
  await page.getByRole('button', { name: /交易该建筑资产/ }).click();
  expectContainedArtwork(await inspectFacilityArtwork(page.locator('.market-detail-hero__artwork')), 64, 58);

  expect(pageErrors).toEqual([]);
});