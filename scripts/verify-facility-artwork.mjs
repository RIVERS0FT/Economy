import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { FACILITY_TYPE_CATALOG } from '../server/src/industry-catalog.js';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const facilityIds = FACILITY_TYPE_CATALOG.map((facility) => facility.id);

const paths = {
  artworkStyles: 'src/styles/facility-artwork.css',
  generator: 'scripts/generate-facility-artwork-thumbnails.mjs',
  sharedGenerator: 'scripts/artwork-thumbnails.mjs',
  verifier: 'scripts/verify-facility-artwork.mjs',
  package: 'package.json',
  gitignore: '.gitignore',
  uiDesign: 'docs/UI_DESIGN_SYSTEM.md',
  designIndex: 'docs/README.md',
  catalogDesign: 'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md',
  pageDesign: 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  main: 'src/main.tsx',
  component: 'src/components/icons/FacilityIcons.tsx',
  production: 'src/pages/production/ProductionFacilityDetail.tsx',
  market: 'src/pages/MarketPage.tsx',
  auction: 'src/pages/AuctionPage.tsx',
};

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
    failures.push(`${path} 必须使用 8-bit RGBA 且不得隔行`);
  }
}

for (const path of Object.values(paths)) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

if (failures.length === 0) {
  const styles = read(paths.artworkStyles);
  const generator = read(paths.generator);
  const sharedGenerator = read(paths.sharedGenerator);
  const packageJson = read(paths.package);
  const gitignore = read(paths.gitignore);
  const uiDesign = read(paths.uiDesign);
  const designIndex = read(paths.designIndex);
  const catalogDesign = read(paths.catalogDesign);
  const pageDesign = read(paths.pageDesign);
  const main = read(paths.main);
  const component = read(paths.component);
  const production = read(paths.production);
  const market = read(paths.market);
  const auction = read(paths.auction);

  const sourceDirectory = resolve(root, 'src/assets/facility-icons');
  const actualSources = readdirSync(sourceDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
    .map((entry) => entry.name)
    .sort();
  const expectedSources = facilityIds.map((id) => `${id}.png`).sort();
  if (JSON.stringify(actualSources) !== JSON.stringify(expectedSources)) {
    failures.push('工厂场景源图必须与服务器工厂目录一一对应，不得缺失或保留目录外 PNG');
  }

  for (const facilityId of facilityIds) {
    const sourcePath = `src/assets/facility-icons/${facilityId}.png`;
    const thumbnailPath = `src/assets/facility-icons/generated/128/${facilityId}.png`;
    validatePng(sourcePath, 1024, '工厂场景源图');
    validatePng(thumbnailPath, 128, '工厂场景运行时缩略图');

    if (!styles.includes(`[data-facility-icon='${facilityId}']`)) {
      failures.push(`${paths.artworkStyles} 缺少 ${facilityId} 映射`);
    }
    if (!styles.includes(`../assets/facility-icons/generated/128/${facilityId}.png`)) {
      failures.push(`${paths.artworkStyles} 未引用 ${thumbnailPath}`);
    }
    if (styles.includes(`../assets/facility-icons/${facilityId}.png`)) {
      failures.push(`${paths.artworkStyles} 不得直接加载 1024×1024 源图 ${sourcePath}`);
    }
    if (!component.includes(`'${facilityId}'`)) {
      failures.push(`${paths.component} 未声明工厂 ${facilityId}`);
    }
  }

  for (const required of [
    'data-facility-icon={facilityTypeId}',
    'export function FacilityIcon',
    'M3 20V10',
    "className={className ? `game-icon facility-icon ${className}` : 'game-icon facility-icon'}",
  ]) {
    if (!component.includes(required)) failures.push(`${paths.component} 缺少: ${required}`);
  }

  for (const required of [
    '.facility-cluster-selector-card',
    '.market-asset-card__icon-layer',
    '.asset-auction-icon',
    '.asset-auction-package-icon',
    '.asset-auction-bundle-tile',
    '.asset-auction-summary-icon',
    '.asset-auction-history-icon',
    'background-image: var(--facility-artwork-image, none);',
    'background-size: cover;',
    'stroke: transparent;',
    '@media (prefers-reduced-data: reduce)',
    'stroke: currentColor;',
  ]) {
    if (!styles.includes(required)) failures.push(`${paths.artworkStyles} 缺少: ${required}`);
  }

  const productionStyles = read('src/styles/facility-group-card-grid.css');
  for (const required of [
    'aspect-ratio: 4 / 5;',
    '.facility-cluster-selector-card::before',
    '.facility-cluster-icon',
    'inset: 0;',
    'width: 100%;',
    'height: 100%;',
    'transform: none;',
    'rgb(0 0 0 / 82%) 0%',
    'transparent 44%',
    'rgb(0 0 0 / 76%) 0%',
    'transparent 42%',
  ]) {
    if (!productionStyles.includes(required)) failures.push(`工厂选择卡未落实竖向铺满插画和上下渐变: ${required}`);
  }

  for (const required of [
    "FACILITY_TYPE_CATALOG } from '../server/src/industry-catalog.js'",
    'FACILITY_TYPE_CATALOG.map((facility) => facility.id)',
    "sourceDirectory: resolve(process.cwd(), 'src/assets/facility-icons')",
    "generateArtworkThumbnails } from './artwork-thumbnails.mjs'",
  ]) {
    if (!generator.includes(required)) failures.push(`${paths.generator} 缺少: ${required}`);
  }

  for (const required of [
    "import { deflateSync, inflateSync } from 'node:zlib';",
    'downsampleWithPremultipliedAlpha',
    'generated/${targetSize}',
    'level: 9',
  ]) {
    if (!sharedGenerator.includes(required)) failures.push(`${paths.sharedGenerator} 缺少: ${required}`);
  }

  for (const required of [
    '"dev": "npm run generate:artwork && vite"',
    '"generate:artwork": "npm run generate:product-artwork && npm run generate:facility-artwork"',
    '"generate:facility-artwork": "node scripts/generate-facility-artwork-thumbnails.mjs"',
    '"verify:facility-artwork": "npm run generate:facility-artwork && node scripts/verify-facility-artwork.mjs"',
    'npm run verify:facility-artwork',
  ]) {
    if (!packageJson.includes(required)) failures.push(`${paths.package} 缺少: ${required}`);
  }

  if (!gitignore.includes('src/assets/facility-icons/generated/')) {
    failures.push(`${paths.gitignore} 必须忽略构建生成的工厂场景缩略图`);
  }

  const artworkImport = "import './styles/facility-artwork.css';";
  if (!main.includes(artworkImport)) failures.push(`${paths.main} 未加载工厂场景图片样式`);
  if (main.indexOf(artworkImport) > main.indexOf("import './styles/design-system.css';")) {
    failures.push('facility-artwork.css 必须在 design-system.css 前加载');
  }

  for (const [path, source, required] of [
    [paths.production, production, '<FacilityIcon facilityTypeId={type.id} className="facility-cluster-icon" />'],
    [paths.market, market, '<FacilityIcon facilityTypeId={facility.id} />'],
    [paths.auction, auction, '<FacilityIcon facilityTypeId={item.id} />'],
  ]) {
    if (!source.includes(required)) failures.push(`${path} 未接入工厂场景主视觉: ${required}`);
    if (source.includes('assets/facility-icons/')) failures.push(`${path} 不得直接引用工厂场景图片路径`);
  }

  for (const [path, source] of [
    ['src/pages/OverviewPage.tsx', read('src/pages/OverviewPage.tsx')],
    ['src/pages/BankPage.tsx', read('src/pages/BankPage.tsx')],
  ]) {
    if (source.includes('FacilityIcon')) failures.push(`${path} 的紧凑工厂语义位置必须继续使用 FactoryIcon`);
  }

  for (const [path, source, fragments] of [
    [paths.uiDesign, uiDesign, [
      '工厂场景插画图标绘制规范',
      '`src/assets/facility-icons/`',
      '高质量写实数字插画／商业级写实 CG',
      '明亮自然的日间环境光',
      '主体建筑或主要设施居中或略居中',
      '无文字、无人物、无水印、无品牌标志',
      '`src/assets/facility-icons/generated/128/`',
      '`FacilityIcon`',
      '`prefers-reduced-data`',
      '覆盖完整 `4:5` 竖卡',
      '`background-size: cover` 与居中定位',
      '上下两层黑色渐变',
      '中央主体区域保持透明',
    ]],
    [paths.designIndex, designIndex, ['工厂场景插画主视觉归属 `UI_DESIGN_SYSTEM.md`']],
    [paths.catalogDesign, catalogDesign, ['`FacilityIcon` 只按 `facilityTypeId` 选择视觉资源']],
    [paths.pageDesign, pageDesign, ['商品与工厂目录卡统一使用图标层在前、数据层在后的双层结构']],
  ]) {
    for (const fragment of fragments) {
      if (!source.includes(fragment)) failures.push(`${path} 缺少工厂场景规则: ${fragment}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`工厂场景插画与资源验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `工厂场景插画验证通过：${facilityIds.length} 种正式工厂与 1024×1024 RGBA 源图、128×128 运行时缩略图、ID 映射、上下可读性渐变和主视觉使用边界一致。`,
);
