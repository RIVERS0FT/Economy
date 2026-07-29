import { expect, test } from '@playwright/test';

test.describe('liquid glass official reference comparison', () => {
  test.use({ viewport: { width: 1120, height: 620 } });

  test('matches official material under identical background, geometry, content and static input', async ({ page }) => {
    await page.goto('liquid-glass-reference-test.html');

    const officialCell = page.locator('[data-comparison-surface="official"]');
    const projectCell = page.locator('[data-comparison-surface="project"]');
    await expect(page.locator('[data-comparison-background="project-auth"]')).toBeVisible();
    await expect(page.locator('[data-comparison-sampling-layer="true"]')).toHaveCount(1);
    await expect(page.locator('[data-persistent-financial-photography="true"]')).toHaveCount(1);
    await expect(officialCell).toBeVisible();
    await expect(projectCell).toBeVisible();
    await expect(officialCell.locator('.liquid-glass-reference-label')).toHaveText('官方组件');
    await expect(projectCell.locator('.liquid-glass-reference-label')).toHaveText('项目组件');

    await expect.poll(async () => page.evaluate(() => {
      const official = document.querySelector<HTMLElement>('[data-comparison-surface="official"]');
      const project = document.querySelector<HTMLElement>('[data-comparison-surface="project"]');
      const officialEffect = official?.querySelector<HTMLElement>('.liquid-glass-reference-effect');
      const projectEffect = project?.querySelector<HTMLElement>('.liquid-glass-surface__effect');
      if (!official || !project || !officialEffect || !projectEffect) return null;

      const readRect = (element: Element | null) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      };
      const readMaterial = (cell: HTMLElement, effect: HTMLElement) => {
        const card = cell.querySelector<HTMLElement>('.liquid-glass-reference-card');
        const glass = effect.querySelector<HTMLElement>(':scope > .glass');
        const warp = glass?.querySelector<HTMLElement>(':scope > .glass__warp');
        const surface = cell.querySelector<HTMLElement>('.liquid-glass-surface');
        const materialRoot = surface ?? card;
        const auxiliary = Array.from(materialRoot?.children ?? [])
          .filter((element): element is HTMLElement => (
            element instanceof HTMLElement
            && element.tagName === 'DIV'
            && element !== effect
            && !element.classList.contains('liquid-glass-surface')
          ));
        return {
          cellBackground: getComputedStyle(cell).backgroundImage,
          cardRect: readRect(card),
          effectRect: readRect(effect),
          glassRect: readRect(glass),
          warpRect: readRect(warp),
          backdropFilter: warp
            ? getComputedStyle(warp).backdropFilter
              || getComputedStyle(warp).getPropertyValue('-webkit-backdrop-filter')
            : '',
          glassBoxShadow: glass ? getComputedStyle(glass).boxShadow : '',
          surfaceBackground: surface ? getComputedStyle(surface).backgroundColor : 'rgba(0, 0, 0, 0)',
          surfaceBoxShadow: surface ? getComputedStyle(surface).boxShadow : 'none',
          auxiliary: auxiliary.map((element) => {
            const style = getComputedStyle(element);
            return {
              rect: readRect(element),
              backgroundColor: style.backgroundColor,
              opacity: style.opacity,
              padding: style.padding,
              maskImage: style.getPropertyValue('-webkit-mask-image') || style.maskImage,
              mixBlendMode: style.mixBlendMode,
            };
          }),
        };
      };

      return {
        official: readMaterial(official, officialEffect),
        project: readMaterial(project, projectEffect),
      };
    })).toEqual({
      official: {
        cellBackground: expect.any(String),
        cardRect: { width: 440, height: 352 },
        effectRect: { width: 440, height: 352 },
        glassRect: { width: 440, height: 352 },
        warpRect: { width: 440, height: 352 },
        backdropFilter: expect.stringMatching(/blur\(4px\) saturate\((?:140%|1\.4)\)/),
        glassBoxShadow: expect.stringContaining('0px 12px 40px'),
        surfaceBackground: 'rgba(0, 0, 0, 0)',
        surfaceBoxShadow: 'none',
        auxiliary: [
          {
            rect: { width: 440, height: 352 },
            backgroundColor: 'rgba(0, 0, 0, 0)',
            opacity: '1',
            padding: '0px',
            maskImage: 'none',
            mixBlendMode: 'normal',
          },
          {
            rect: { width: 440, height: 352 },
            backgroundColor: 'rgba(0, 0, 0, 0)',
            opacity: '1',
            padding: '0px',
            maskImage: 'none',
            mixBlendMode: 'normal',
          },
        ],
      },
      project: {
        cellBackground: expect.any(String),
        cardRect: { width: 440, height: 352 },
        effectRect: { width: 440, height: 352 },
        glassRect: { width: 440, height: 352 },
        warpRect: { width: 440, height: 352 },
        backdropFilter: expect.stringMatching(/blur\(4px\) saturate\((?:140%|1\.4)\)/),
        glassBoxShadow: expect.stringContaining('0px 12px 40px'),
        surfaceBackground: 'rgba(0, 0, 0, 0)',
        surfaceBoxShadow: 'none',
        auxiliary: [
          {
            rect: { width: 440, height: 352 },
            backgroundColor: 'rgba(0, 0, 0, 0)',
            opacity: '1',
            padding: '0px',
            maskImage: 'none',
            mixBlendMode: 'normal',
          },
          {
            rect: { width: 440, height: 352 },
            backgroundColor: 'rgba(0, 0, 0, 0)',
            opacity: '1',
            padding: '0px',
            maskImage: 'none',
            mixBlendMode: 'normal',
          },
        ],
      },
    });

    const comparison = await page.evaluate(() => {
      const comparisonPage = document.querySelector<HTMLElement>('[data-comparison-background="project-auth"]');
      const officialCell = document.querySelector<HTMLElement>('[data-comparison-surface="official"]');
      const projectCell = document.querySelector<HTMLElement>('[data-comparison-surface="project"]');
      const image = document.querySelector<HTMLImageElement>('.application-image-layer img');
      const atmosphere = document.querySelector<HTMLElement>('.application-atmosphere-layer');
      const samplingLayer = document.querySelector<HTMLElement>('[data-comparison-sampling-layer="true"]');
      const officialCard = officialCell?.querySelector<HTMLElement>('.liquid-glass-reference-card');
      const projectCard = projectCell?.querySelector<HTMLElement>('.liquid-glass-reference-card');
      const imageLayer = image?.closest<HTMLElement>('.application-image-layer');
      if (
        !comparisonPage
        || !officialCell
        || !projectCell
        || !officialCard
        || !projectCard
        || !image
        || !imageLayer
        || !atmosphere
        || !samplingLayer
      ) {
        throw new Error('comparison page is incomplete');
      }
      return {
        pageBackground: getComputedStyle(comparisonPage).backgroundImage,
        samplingLayerPosition: getComputedStyle(samplingLayer).position,
        samplingLayerIsolation: getComputedStyle(samplingLayer).isolation,
        imageAndAtmosphereShareParent: imageLayer.parentElement === atmosphere.parentElement,
        backgroundAndGlassShareSamplingRoot:
          imageLayer.parentElement === samplingLayer
          && atmosphere.parentElement === samplingLayer
          && comparisonPage.parentElement === samplingLayer,
        glassSharesSamplingRoot: samplingLayer.contains(officialCell) && samplingLayer.contains(projectCell),
        contentZIndex: getComputedStyle(comparisonPage).zIndex,
        imageLayerPosition: getComputedStyle(imageLayer).position,
        atmosphereLayerPosition: getComputedStyle(atmosphere).position,
        imageLayerZIndex: getComputedStyle(imageLayer).zIndex,
        atmosphereLayerZIndex: getComputedStyle(atmosphere).zIndex,
        glassWrapperZIndexes: [
          getComputedStyle(officialCell).zIndex,
          getComputedStyle(projectCell).zIndex,
          getComputedStyle(officialCard).zIndex,
          getComputedStyle(projectCard).zIndex,
        ],
        glassWrapperIsolations: [
          getComputedStyle(officialCell).isolation,
          getComputedStyle(projectCell).isolation,
          getComputedStyle(officialCard).isolation,
          getComputedStyle(projectCard).isolation,
        ],
        imageSource: image.currentSrc || image.src,
        imageFilter: getComputedStyle(image).filter,
        atmosphereBackground: getComputedStyle(atmosphere).backgroundImage,
        officialBackground: getComputedStyle(officialCell).backgroundImage,
        projectBackground: getComputedStyle(projectCell).backgroundImage,
      };
    });
    expect(comparison.pageBackground).toBe('none');
    expect(comparison.samplingLayerPosition).toBe('relative');
    expect(comparison.samplingLayerIsolation).toBe('isolate');
    expect(comparison.imageAndAtmosphereShareParent).toBe(true);
    expect(comparison.backgroundAndGlassShareSamplingRoot).toBe(true);
    expect(comparison.glassSharesSamplingRoot).toBe(true);
    expect(comparison.contentZIndex).toBe('auto');
    expect(comparison.imageLayerPosition).toBe('fixed');
    expect(comparison.atmosphereLayerPosition).toBe('fixed');
    expect(comparison.imageLayerZIndex).toBe('-2');
    expect(comparison.atmosphereLayerZIndex).toBe('-1');
    expect(comparison.glassWrapperZIndexes).toEqual(['auto', 'auto', 'auto', 'auto']);
    expect(comparison.glassWrapperIsolations).toEqual(['auto', 'auto', 'auto', 'auto']);
    expect(comparison.imageSource).toContain('No_Known_Restrictions_Trading_Floor');
    expect(comparison.imageFilter).toBe('saturate(0.72) contrast(1.08) brightness(0.72)');
    expect(comparison.atmosphereBackground).toContain('linear-gradient');
    expect(comparison.projectBackground).toBe(comparison.officialBackground);
  });
});
