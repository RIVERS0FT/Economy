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
const generatorPath = 'scripts/generate-product-artwork-thumbnails.mjs';
const packagePath = 'package.json';
const gitignorePath = '.gitignore';
const uiDesignPath = 'docs/UI_DESIGN_SYSTEM.md';
const mainPath = 'src/main.tsx';
const productIconsPath = 'src/components/icons/ProductIcons.tsx';
const formulaPath = 'src/components/facilities/FacilityProductionFormula.tsx';
const denseProductPages = [
  'src/pages/AssetsPage.tsx',
  'src/pages/MarketPage.tsx',
  formulaPath,
];

function validatePng(path, expectedSize, label) {
  if (!existsSync(resolve(root, path))) {
    failures.push(`缺少${label}: ${path}`);
    return;
  }

  const image = readFileSync(resolve(root, path));
  if (image.length < 29 || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    failures.push(`${path} 不是有效 PNG`);
    return;
  }

  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  const bitDepth = image[24];
  const colorType = image[25];
  const interlaceMethod = image[28];
  if (width !== expectedSize || height !== expectedSize) {
    failures.push(`${path} 必须为 ${expectedSize}×${expectedSize}，当前为 ${width}×${height}`);
  }
  if (bitDepth !== 8 || colorType !== 6 || interlaceMethod !== 0) {
    failures.push(`${path} 必须使用 8-bit RGBA 真透明通道且不得隔行`);
  }
}

for (const path of [
  artworkStylePath,
  generatorPath,
  packagePath,
  gitignorePath,
  uiDesignPath,
  mainPath,
  productIconsPath,
  formulaPath,
]) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

if (failures.length === 0) {
  const artworkStyles = read(artworkStylePath);
  const generator = read(generatorPath);
  const packageJson = read(packagePath);
  const gitignore = read(gitignorePath);
  const uiDesign = read(uiDesignPath);
  const main = read(mainPath);
  const productIcons = read(productIconsPath);

  for (const productId of productIds) {
    const sourcePath = `src/assets/product-icons/${productId}.png`;
    const thumbnailPath = `src/assets/product-icons/generated/128/${productId}.png`;
    validatePng(sourcePath, 1024, '商品源图片');
    validatePng(thumbnailPath, 128, '商品运行时缩略图');

    if (!artworkStyles.includes(`[data-product-icon='${productId}']`)) {
      failures.push(`${artworkStylePath} 缺少 ${productId} 映射`);
    }
    if (!artworkStyles.includes(`../assets/product-icons/generated/128/${productId}.png`)) {
      failures.push(`${artworkStylePath} 未引用 ${thumbnailPath}`);
    }
    if (artworkStyles.includes(`../assets/product-icons/${productId}.png`)) {
      failures.push(`${artworkStylePath} 不得直接加载 1024×1024 源图片 ${sourcePath}`);
    }
    if (!productIcons.includes(`'${productId}'`)) {
      failures.push(`${productIconsPath} 未声明商品 ${productId}`);
    }
    if (!generator.includes(`'${productId}'`)) {
      failures.push(`${generatorPath} 未生成商品 ${productId}`);
    }
  }

  for (const required of [
    '.warehouse-product-card-icon',
    '.market-asset-card__icon-layer',
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

  for (const required of [
    "import { deflateSync, inflateSync } from 'node:zlib';",
    'const targetSize = 128;',
    'downsampleWithPremultipliedAlpha',
    "resolve(sourceDirectory, 'generated/128')",
    'level: 9',
  ]) {
    if (!generator.includes(required)) failures.push(`${generatorPath} 缺少: ${required}`);
  }

  for (const required of [
    '"dev": "npm run generate:product-artwork && vite"',
    '"generate:product-artwork": "node scripts/generate-product-artwork-thumbnails.mjs"',
    '"verify:product-artwork": "npm run generate:product-artwork && node scripts/verify-product-artwork.mjs"',
    'npm run verify:product-artwork',
  ]) {
    if (!packageJson.includes(required)) failures.push(`${packagePath} 缺少: ${required}`);
  }

  if (!gitignore.includes('src/assets/product-icons/generated/')) {
    failures.push(`${gitignorePath} 必须忽略构建生成的商品缩略图`);
  }

  for (const required of [
    '`src/assets/product-icons/generated/128/`',
    '`128 × 128`',
    '不得直接加载 `1024 × 1024` 源图',
    '预乘 Alpha',
    '构建产物不得提交仓库',
  ]) {
    if (!uiDesign.includes(required)) failures.push(`${uiDesignPath} 缺少运行时缩略图规则: ${required}`);
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

console.log(
  `商品图片视觉验证通过：${productIds.length} 种 1024×1024 RGBA PNG 源图已生成 128×128 运行时缩略图，紧凑语义位置继续使用 SVG。`,
);
