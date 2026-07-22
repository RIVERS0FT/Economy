import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const productIds = [
  'wheat',
  'rice',
  'cotton',
  'sugarcane',
  'fruit',
  'timber',
  'ore',
  'copper-ore',
  'crude-oil',
  'meat',
  'eggs',
  'milk',
  'fish',
  'wool',
  'flour',
  'sugar',
  'lumber',
  'steel',
  'copper',
  'plastic',
  'textile',
  'pulp',
  'food',
  'beverage',
  'prepared-meal',
  'paper',
  'furniture',
  'clothing',
  'machinery',
  'electronics',
  'appliance',
];

const artworkStylePath = 'src/styles/product-artwork.css';
const mainPath = 'src/main.tsx';
const productIconsPath = 'src/components/icons/ProductIcons.tsx';
const formulaPath = 'src/components/facilities/FacilityProductionFormula.tsx';
const denseProductPages = [
  'src/pages/AssetsPage.tsx',
  'src/pages/MarketPage.tsx',
  formulaPath,
];

for (const path of [artworkStylePath, mainPath, productIconsPath, formulaPath]) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

if (failures.length === 0) {
  const artworkStyles = read(artworkStylePath);
  const main = read(mainPath);
  const productIcons = read(productIconsPath);

  for (const productId of productIds) {
    const imagePath = `src/assets/product-icons/${productId}.png`;
    if (!existsSync(resolve(root, imagePath))) {
      failures.push(`缺少商品图片: ${imagePath}`);
      continue;
    }

    const image = readFileSync(resolve(root, imagePath));
    const pngSignature = image.subarray(0, 8).toString('hex');
    if (pngSignature !== '89504e470d0a1a0a') {
      failures.push(`${imagePath} 不是有效 PNG`);
      continue;
    }
    if (image.length < 26) {
      failures.push(`${imagePath} PNG 头部不完整`);
      continue;
    }

    const width = image.readUInt32BE(16);
    const height = image.readUInt32BE(20);
    const colorType = image[25];
    if (width !== 1024 || height !== 1024) {
      failures.push(`${imagePath} 必须为 1024×1024，当前为 ${width}×${height}`);
    }
    if (colorType !== 6) {
      failures.push(`${imagePath} 必须使用 RGBA 真透明通道，当前 PNG color type=${colorType}`);
    }

    if (!artworkStyles.includes(`[data-product-icon='${productId}']`)) {
      failures.push(`${artworkStylePath} 缺少 ${productId} 映射`);
    }
    if (!artworkStyles.includes(`../assets/product-icons/${productId}.png`)) {
      failures.push(`${artworkStylePath} 未引用 ${imagePath}`);
    }
    if (!productIcons.includes(`'${productId}'`)) {
      failures.push(`${productIconsPath} 未声明商品 ${productId}`);
    }
  }

  for (const required of [
    '.warehouse-product-card-icon',
    '.unified-asset-tab:not(.facility) .asset-kind-icon',
    '.market-summary > .widget-heading .product-icon-label',
    '.asset-auction-icon',
    '.asset-auction-package-icon',
    '.asset-auction-bundle-tile',
    '.asset-auction-history-icon',
    'background-image: var(--product-artwork-image, none);',
    'stroke: transparent;',
    '@media (prefers-reduced-data: reduce)',
    'stroke: currentColor;',
  ]) {
    if (!artworkStyles.includes(required)) failures.push(`${artworkStylePath} 缺少: ${required}`);
  }

  const artworkImport = "import './styles/product-artwork.css';";
  if (!main.includes(artworkImport)) failures.push(`${mainPath} 未加载商品图片样式`);
  if (main.indexOf(artworkImport) > main.indexOf("import './styles/design-system.css';")) {
    failures.push('product-artwork.css 必须在 design-system.css 前加载');
  }

  for (const pagePath of denseProductPages) {
    const source = read(pagePath);
    if (source.includes('assets/product-icons/')) {
      failures.push(`${pagePath} 不得直接引用商品图片路径`);
    }
  }

  const formula = read(formulaPath);
  if (!formula.includes('ProductIcon')) {
    failures.push('生产公式必须继续使用紧凑 ProductIcon SVG');
  }
}

if (failures.length > 0) {
  console.error(`商品图片视觉与资源验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`商品图片视觉验证通过：${productIds.length} 种 1024×1024 RGBA PNG 已接入，紧凑语义位置继续使用 SVG。`);
