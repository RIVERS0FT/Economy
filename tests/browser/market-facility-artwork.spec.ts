import { expect, test, type Locator } from '@playwright/test';

async function inspectFacilityArtwork(facilityTab: Locator) {
  await expect(facilityTab).toBeVisible();
  const artwork = facilityTab.locator(':scope > .market-asset-card__icon-layer > .facility-icon');
  await expect(artwork).toHaveAttribute('data-facility-icon', 'machine-factory');
  await expect.poll(() => artwork.evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain('machine-factory');

  return facilityTab.evaluate((element) => {
    const card = element as HTMLElement;
    const iconLayer = card.querySelector<HTMLElement>(':scope > .market-asset-card__icon-layer');
    const dataLayer = card.querySelector<HTMLElement>(':scope > .market-asset-card__data-layer');
    const facilityIcon = iconLayer?.querySelector<HTMLElement>(':scope > .facility-icon');
    if (!iconLayer || !dataLayer || !facilityIcon) {
      throw new Error('market facility artwork fixture is incomplete');
    }

    const cardRect = card.getBoundingClientRect();
    const artworkRect = facilityIcon.getBoundingClientRect();
    const artworkStyle = getComputedStyle(facilityIcon);
    const cardStyle = getComputedStyle(card);
    const iconLayerStyle = getComputedStyle(iconLayer);
    const dataLayerStyle = getComputedStyle(dataLayer);
    const readabilityStyle = getComputedStyle(iconLayer, '::after');

    return {
      card: {
        width: card.clientWidth,
        height: card.clientHeight,
        left: cardRect.left + card.clientLeft,
        top: cardRect.top + card.clientTop,
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
      transform: artworkStyle.transform,
      cardOverflow: cardStyle.overflow,
      iconLayerZIndex: iconLayerStyle.zIndex,
      dataLayerZIndex: dataLayerStyle.zIndex,
      readabilityBackground: readabilityStyle.backgroundImage,
      readabilityPointerEvents: readabilityStyle.pointerEvents,
    };
  });
}

function expectFullBleed(metrics: Awaited<ReturnType<typeof inspectFacilityArtwork>>) {
  expect(metrics.card.width).toBeGreaterThan(metrics.card.height);
  expect(Math.abs(metrics.artwork.left - metrics.card.left)).toBeLessThan(1.5);
  expect(Math.abs(metrics.artwork.top - metrics.card.top)).toBeLessThan(1.5);
  expect(Math.abs(metrics.artwork.width - metrics.card.width)).toBeLessThan(1.5);
  expect(Math.abs(metrics.artwork.height - metrics.card.height)).toBeLessThan(1.5);
  expect(metrics.backgroundSize).toBe('cover');
  expect(metrics.backgroundPosition).toBe('50% 50%');
  expect(metrics.backgroundRepeat).toBe('no-repeat');
  expect(metrics.transform).toBe('none');
  expect(metrics.cardOverflow).toBe('hidden');
  expect(Number(metrics.dataLayerZIndex)).toBeGreaterThan(Number(metrics.iconLayerZIndex));
  expect((metrics.readabilityBackground.match(/linear-gradient/g) ?? []).length).toBe(2);
  expect(metrics.readabilityPointerEvents).toBe('none');
}

test('market facility artwork fills the card with centered cover cropping on desktop and mobile', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');
  const desktopFacility = page.getByRole('tab', { name: /^机械工厂/ });
  expectFullBleed(await inspectFacilityArtwork(desktopFacility));

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileFacility = page.getByRole('tab', { name: /^机械工厂/ });
  expectFullBleed(await inspectFacilityArtwork(mobileFacility));

  expect(pageErrors).toEqual([]);
});
