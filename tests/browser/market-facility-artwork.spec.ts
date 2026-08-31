import { expect, test, type Locator, type Page } from '@playwright/test';

async function inspectFacilityDetailArtwork(page: Page) {
  const slot = page.locator('.facility-detail-artwork').first();
  await expect(slot).toBeVisible();
  const artwork = slot.locator(':scope > .facility-detail-artwork-icon');
  await expect(artwork).toHaveAttribute('data-facility-icon', 'machine-factory');
  await expect.poll(() => artwork.evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain('machine-factory');

  return slot.evaluate((element) => {
    const slotElement = element as HTMLElement;
    const facilityIcon = slotElement.querySelector<HTMLElement>(':scope > .facility-detail-artwork-icon');
    if (!facilityIcon) throw new Error('facility detail artwork fixture is incomplete');

    const slotRect = slotElement.getBoundingClientRect();
    const artworkRect = facilityIcon.getBoundingClientRect();
    const artworkStyle = getComputedStyle(facilityIcon);
    return {
      slot: {
        width: slotRect.width,
        height: slotRect.height,
        aspectRatio: slotRect.width / slotRect.height,
      },
      artwork: {
        width: artworkRect.width,
        height: artworkRect.height,
      },
      backgroundSize: artworkStyle.backgroundSize,
      backgroundPosition: artworkStyle.backgroundPosition,
      backgroundRepeat: artworkStyle.backgroundRepeat,
    };
  });
}

test('facility detail artwork fills banner slots on desktop and mobile without market trade entry', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('runtime-test.html?view=production&scenario=facility-card-profit');
  await page.locator('.facility-cluster-selector-card').first().click();
  await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();
  await expect(page.getByRole('button', { name: /交易该建筑资产/ })).toHaveCount(0);

  const desktopMetrics = await inspectFacilityDetailArtwork(page);
  expect(desktopMetrics.slot.aspectRatio).toBeCloseTo(0.8, 1);
  expect(Math.abs(desktopMetrics.artwork.width - desktopMetrics.slot.width)).toBeLessThan(2.5);
  expect(Math.abs(desktopMetrics.artwork.height - desktopMetrics.slot.height)).toBeLessThan(2.5);
  expect(desktopMetrics.backgroundSize).toBe('cover');
  expect(desktopMetrics.backgroundPosition).toBe('50% 50%');
  expect(desktopMetrics.backgroundRepeat).toBe('no-repeat');

  await page.setViewportSize({ width: 390, height: 844 });
  const workspaceHost = page.locator('.mobile-workspace-sheet-host');
  await expect(workspaceHost).toHaveCount(1);
  await expect(workspaceHost).toHaveAttribute('data-detail-active', 'false');
  await expect(workspaceHost.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);

  const mobileCard = page.locator('.facility-cluster-selector-card').first();
  await expect(mobileCard).toBeVisible();
  await mobileCard.click();
  await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();
  await expect(page.getByRole('button', { name: /交易该建筑资产/ })).toHaveCount(0);

  const mobileMetrics = await inspectFacilityDetailArtwork(page);
  expect(mobileMetrics.slot.aspectRatio).toBeCloseTo(0.8, 1);
  expect(Math.abs(mobileMetrics.artwork.width - mobileMetrics.slot.width)).toBeLessThan(2.5);
  expect(Math.abs(mobileMetrics.artwork.height - mobileMetrics.slot.height)).toBeLessThan(2.5);
  expect(mobileMetrics.backgroundSize).toBe('cover');
  expect(mobileMetrics.backgroundPosition).toBe('50% 50%');
  expect(mobileMetrics.backgroundRepeat).toBe('no-repeat');
  await expect(workspaceHost).toHaveAttribute('data-detail-active', 'false');
  await expect(workspaceHost.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
