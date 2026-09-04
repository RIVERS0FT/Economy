import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRODUCT_CATALOG } from '../server/src/domain.js';
import { inspectArtworkTransparency } from './artwork-thumbnails.mjs';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const productIds = PRODUCT_CATALOG.map((product) => product.id);
const sourceArtworkHash = (productId) => createHash('sha256')
  .update(readFileSync(resolve(root, `src/assets/product-icons/${productId}.png`)))
  .digest('hex');

const artworkStylePath = 'src/styles/product-artwork.css';
const generatorPath = 'scripts/generate-product-artwork-thumbnails.mjs';
const sharedGeneratorPath = 'scripts/artwork-thumbnails.mjs';
const packagePath = 'package.json';
const gitignorePath = '.gitignore';
const uiDesignPath = 'docs/UI_DESIGN_SYSTEM.md';
const mainPath = 'src/main.tsx';
const productIconsPath = 'src/components/icons/ProductIcons.tsx';
const iconSystemPath = 'src/styles/icon-system.css';
const productArtworkPath = 'src/components/products/ProductArtwork.tsx';
const richSelectPath = 'src/components/ui/RichSelectInput.tsx';
const formulaPath = 'src/components/facilities/FacilityProductionFormula.tsx';
const marketCommodityRowPath = 'src/components/market/MarketCommodityRow.tsx';
const denseProductPages = [
  'src/components/assets/AssetOverviewPanel.tsx',
  'src/pages/MarketPage.tsx',
  marketCommodityRowPath,
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
  sharedGeneratorPath,
  packagePath,
  gitignorePath,
  uiDesignPath,
  mainPath,
  productIconsPath,
  iconSystemPath,
  productArtworkPath,
  richSelectPath,
  formulaPath,
  marketCommodityRowPath,
]) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

if (failures.length === 0) {
  const artworkStyles = read(artworkStylePath);
  const generator = read(generatorPath);
  const sharedGenerator = read(sharedGeneratorPath);
  const packageJson = read(packagePath);
  const gitignore = read(gitignorePath);
  const uiDesign = read(uiDesignPath);
  const main = read(mainPath);
  const productIcons = read(productIconsPath);
  const iconSystem = read(iconSystemPath);

  for (const productId of productIds) {
    const sourcePath = `src/assets/product-icons/${productId}.png`;
    const thumbnailPath = `src/assets/product-icons/generated/128/${productId}.png`;
    validatePng(sourcePath, 1024, '商品源图片');
    validatePng(thumbnailPath, 128, '商品运行时缩略图');
    const transparency = inspectArtworkTransparency(resolve(root, sourcePath), 1024);
    if (transparency.cornerAlphas.some((alpha) => alpha !== 0)) {
      failures.push(`${sourcePath} 四角必须完全透明`);
    }
    if (transparency.transparentRatio < 0.05 || transparency.visibleRatio < 0.05) {
      failures.push(`${sourcePath} 必须包含真实透明背景和可见商品主体`);
    }

    if (!artworkStyles.includes(`[data-product-icon='${productId}']`)) {
      failures.push(`${artworkStylePath} 缺少 ${productId} 映射`);
    }
    if (!artworkStyles.includes(`../assets/product-icons/generated/128/${productId}.png`)) {
      failures.push(`${artworkStylePath} 未引用 ${thumbnailPath}`);
    }
    if (artworkStyles.includes(`../assets/product-icons/${productId}.png`)) {
      failures.push(`${artworkStylePath} 不得直接加载 1024×1024 源图片 ${sourcePath}`);
    }
    if (!generator.includes(`'${productId}'`)) {
      failures.push(`${generatorPath} 未生成商品 ${productId}`);
    }
  }

  const fuelArtworkHash = sourceArtworkHash('industrial-fuel');
  const chemicalArtworkHash = sourceArtworkHash('industrial-chemicals');
  const fertilizerArtworkHash = sourceArtworkHash('fertilizer');
  if (new Set([fuelArtworkHash, chemicalArtworkHash, fertilizerArtworkHash]).size !== 3) {
    failures.push('工业燃料、工业化学品与化肥必须使用三张互不相同的商品源图');
  }
  for (const productId of ['industrial-fuel', 'industrial-chemicals']) {
    const transparency = inspectArtworkTransparency(
      resolve(root, `src/assets/product-icons/${productId}.png`),
      1024,
    );
    if (transparency.greenDominantVisibleRatio > 0.002) {
      failures.push(`${productId} 透明商品插画不得保留可见绿色色键残边`);
    }
  }

  for (const required of [
    "'industrial-fuel'",
    "'industrial-chemicals'",
    "case 'industrial-fuel':",
    "case 'industrial-chemicals':",
  ]) {
    if (!productIcons.includes(required)) failures.push(`${productIconsPath} 缺少: ${required}`);
  }
  for (const required of [
    ".product-icon[data-product-icon='industrial-fuel']",
    'color: var(--color-danger);',
  ]) {
    if (!iconSystem.includes(required)) failures.push(`${iconSystemPath} 缺少燃料危险色语义: ${required}`);
  }

  for (const required of [
    '`industrial-fuel`：红色钢制燃料桶与易燃标志',
    '紧凑 SVG 使用红色危险语义',
    '`industrial-chemicals`：密封工业化学品桶、实验器皿与分子结构',
    '不得出现肥料袋、叶片、土壤或颗粒等农业语义',
    '不得与化肥复用同一源图',
    '四角完全透明，边缘干净且不得带白边或色键残边',
  ]) {
    if (!uiDesign.includes(required)) failures.push(`${uiDesignPath} 缺少商品辨识规则: ${required}`);
  }

  if (!productIcons.includes('default:') || !productIcons.includes('data-product-icon={productId}')) {
    failures.push(`${productIconsPath} 必须保留未知商品 ID 的通用 SVG 回退`);
  }

  for (const required of [
    '.warehouse-product-card-icon',
    '.asset-auction-icon',
    '.asset-auction-package-icon',
    '.asset-auction-bundle-tile',
    '.asset-auction-history-icon',
    '.product-artwork {',
    'background-image: var(--product-artwork-image, none);',
    'stroke: transparent;',
    '@media (prefers-reduced-data: reduce)',
    'stroke: currentColor;',
  ]) {
    if (!artworkStyles.includes(required)) failures.push(`${artworkStylePath} 缺少: ${required}`);
  }

  for (const required of [
    "generateArtworkThumbnails } from './artwork-thumbnails.mjs'",
    "sourceDirectory: resolve(process.cwd(), 'src/assets/product-icons')",
  ]) {
    if (!generator.includes(required)) failures.push(`${generatorPath} 缺少: ${required}`);
  }

  for (const required of [
    "import { deflateSync, inflateSync } from 'node:zlib';",
    'targetSize = 128',
    'downsampleWithPremultipliedAlpha',
    'generated/${targetSize}',
    'level: 9',
  ]) {
    if (!sharedGenerator.includes(required)) failures.push(`${sharedGeneratorPath} 缺少: ${required}`);
  }

  for (const required of [
    '"dev": "npm run generate:artwork && npm run generate:local-preview && vite"',
    '"generate:artwork": "npm run generate:product-artwork && npm run generate:facility-artwork"',
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

  const marketCommodityRow = read(marketCommodityRowPath);
  const marketPage = read('src/pages/MarketPage.tsx');
  for (const required of [
    "from '../components/products/ProductArtwork'",
    'className="market-detail-product-icon-card ui-entity-card"',
    '<ProductArtwork productId={selectedProduct.id} className="market-detail-product-artwork" />',
  ]) {
    if (!marketPage.includes(required)) failures.push(`src/pages/MarketPage.tsx 缺少商品详情图标: ${required}`);
  }
  for (const required of [
    "from '../products/ProductArtwork'",
    '<ProductArtwork productId={productId} />',
    'className="market-commodity-row__artwork"',
  ]) {
    if (!marketCommodityRow.includes(required)) failures.push(`${marketCommodityRowPath} 缺少商品目录主视觉: ${required}`);
  }

  const formula = read(formulaPath);
  const productArtwork = read(productArtworkPath);
  const richSelect = read(richSelectPath);
  if (!formula.includes('ProductArtwork') || formula.includes('<ProductIcon')) {
    failures.push('生产公式必须使用 ProductArtwork PNG 且不得渲染商品 SVG');
  }
  for (const required of [
    'data-product-artwork={productId}',
    "classNames('product-icon', 'product-artwork', className)",
  ]) if (!productArtwork.includes(required)) failures.push(`${productArtworkPath} 缺少: ${required}`);
  for (const forbidden of ['<svg', '<path']) {
    if (productArtwork.includes(forbidden)) failures.push(`${productArtworkPath} 不得包含: ${forbidden}`);
  }
  for (const required of ['role="listbox"', 'role="option"', 'createPortal(']) {
    if (!richSelect.includes(required)) failures.push(`${richSelectPath} 缺少: ${required}`);
  }
}

if (failures.length > 0) {
  console.error(`商品图片视觉与资源验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `商品图片视觉验证通过：${productIds.length} 种正式商品的 1024×1024 RGBA PNG 源图已生成 128×128 运行时缩略图，共享市场商品行、生产结算及富内容下拉框使用 ProductArtwork PNG，其余紧凑语义位置继续使用 SVG 或通用回退。`,
);
