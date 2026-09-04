const RASTER_STYLE_PROPERTIES = [
  'display',
  'visibility',
  'opacity',
  'color',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'paint-order',
  'vector-effect',
  'filter',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'shape-rendering',
  'text-rendering',
] as const;

export interface ProvinceMapRasterSnapshot {
  image: CanvasImageSource;
  dispose: () => void;
}

function copyComputedSvgStyles(sourceSvg: SVGSVGElement, cloneSvg: SVGSVGElement) {
  const sourceNodes = [sourceSvg, ...sourceSvg.querySelectorAll<SVGElement>('*')];
  const cloneNodes = [cloneSvg, ...cloneSvg.querySelectorAll<SVGElement>('*')];
  if (sourceNodes.length !== cloneNodes.length) throw new Error('PROVINCE_MAP_RASTER_NODE_MISMATCH');

  for (let index = 0; index < sourceNodes.length; index += 1) {
    const source = sourceNodes[index];
    const clone = cloneNodes[index];
    const computed = getComputedStyle(source);
    for (const property of RASTER_STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (value) clone.style.setProperty(property, value);
    }
  }
}

function applySnapshotWorldLod(sourceSvg: SVGSVGElement, cloneSvg: SVGSVGElement) {
  const sourceDetailedFill = sourceSvg.querySelector<SVGPathElement>('.province-map-world-fill');
  const cloneDetailedFill = cloneSvg.querySelector<SVGPathElement>('.province-map-world-fill');
  const cloneLodFill = cloneSvg.querySelector<SVGPathElement>('.province-map-world-shadow');
  if (!sourceDetailedFill || !cloneDetailedFill || !cloneLodFill) return;

  cloneDetailedFill.style.display = 'none';
  cloneLodFill.style.fill = getComputedStyle(sourceDetailedFill).fill;
  cloneLodFill.style.fillOpacity = '.78';
}

async function decodeSvgImageElement(blob: Blob): Promise<ProvinceMapRasterSnapshot> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try {
    await image.decode();
    return {
      image,
      dispose: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function decodeSvgBlob(blob: Blob): Promise<ProvinceMapRasterSnapshot> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        image: bitmap,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Chromium can reject SVG blobs through createImageBitmap even when the same
      // serialized SVG is decodable by an HTMLImageElement. Keep snapshot generation
      // off the Camera hot path and fall back to the browser image decoder.
    }
  }

  return decodeSvgImageElement(blob);
}

export async function createProvinceMapRasterSnapshot(
  sourceSvg: SVGSVGElement,
  viewBox: string,
  pixelWidth: number,
  pixelHeight: number,
): Promise<ProvinceMapRasterSnapshot> {
  if (!(pixelWidth > 0) || !(pixelHeight > 0)) throw new Error('PROVINCE_MAP_RASTER_SIZE_REQUIRED');

  const cloneSvg = sourceSvg.cloneNode(true) as SVGSVGElement;
  cloneSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  cloneSvg.setAttribute('width', String(pixelWidth));
  cloneSvg.setAttribute('height', String(pixelHeight));
  cloneSvg.setAttribute('viewBox', viewBox);
  cloneSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  cloneSvg.removeAttribute('role');
  cloneSvg.removeAttribute('aria-label');
  cloneSvg.style.overflow = 'visible';

  copyComputedSvgStyles(sourceSvg, cloneSvg);
  applySnapshotWorldLod(sourceSvg, cloneSvg);

  const markup = new XMLSerializer().serializeToString(cloneSvg);
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  return decodeSvgBlob(blob);
}
