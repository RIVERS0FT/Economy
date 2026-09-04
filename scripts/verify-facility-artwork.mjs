import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { FACILITY_TYPE_CATALOG } from '../server/src/industry-catalog.js';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const facilityIds = FACILITY_TYPE_CATALOG.map((facility) => facility.id);
const fromScratchComplexities = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'];
const fromScratchFacilityIds = FACILITY_TYPE_CATALOG
  .filter((facility) => fromScratchComplexities.includes(facility.complexity))
  .map((facility) => facility.id);

const paths = {
  artworkStyles: 'src/styles/facility-artwork.css',
  generator: 'scripts/generate-facility-artwork-thumbnails.mjs',
  sharedGenerator: 'scripts/artwork-thumbnails.mjs',
  verifier: 'scripts/verify-facility-artwork.mjs',
  package: 'package.json',
  gitignore: '.gitignore',
  uiDesign: 'docs/UI_DESIGN_SYSTEM.md',
  artworkBaseline: 'scripts/facility-artwork-baseline.json',
  designIndex: 'docs/README.md',
  catalogDesign: 'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md',
  pageDesign: 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  main: 'src/main.tsx',
  component: 'src/components/icons/FacilityIcons.tsx',
  production: 'src/pages/production/ProductionFacilityDetail.tsx',
  market: 'src/pages/MarketPage.tsx',
  auction: 'src/pages/AuctionPage.tsx',
  marketArtworkBrowser: 'tests/browser/market-facility-artwork.spec.ts',
  resolutionBrowser: 'tests/browser/facility-artwork-resolution.spec.ts',
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
  const artworkBaseline = JSON.parse(read(paths.artworkBaseline));
  const baselineFacilityIds = Array.isArray(artworkBaseline.facilityIds)
    ? artworkBaseline.facilityIds
    : [];
  const baselineComplexities = Array.isArray(artworkBaseline.complexities)
    ? artworkBaseline.complexities
    : [];
  const baselineHashes = artworkBaseline.sha256
    && typeof artworkBaseline.sha256 === 'object'
    ? artworkBaseline.sha256
    : {};
  if (artworkBaseline.version !== 6
    || artworkBaseline.style !== 'fertilizer-tools-redraw-2026-08-05'
    || artworkBaseline.creationMode !== 'from-scratch-new-illustration'
    || JSON.stringify(baselineComplexities) !== JSON.stringify(fromScratchComplexities)) {
    failures.push(`${paths.artworkBaseline} 不是当前 C1–C7 从空白新绘／主体优先基线`);
  }
  const designIndex = read(paths.designIndex);
  const catalogDesign = read(paths.catalogDesign);
  const pageDesign = read(paths.pageDesign);
  const main = read(paths.main);
  const component = read(paths.component);
  const production = read(paths.production);
  const market = read(paths.market);
  const auction = read(paths.auction);
  const marketArtworkBrowser = read(paths.marketArtworkBrowser);
  const resolutionBrowser = read(paths.resolutionBrowser);

  const sourceDirectory = resolve(root, 'src/assets/facility-icons');
  const actualSources = readdirSync(sourceDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
    .map((entry) => entry.name)
    .sort();
  const expectedSources = facilityIds.map((id) => `${id}.png`).sort();
  if (JSON.stringify(actualSources) !== JSON.stringify(expectedSources)) {
    failures.push('工厂场景源图必须与服务器工厂目录一一对应，不得缺失或保留目录外 PNG');
  }
  if (JSON.stringify(baselineFacilityIds) !== JSON.stringify(fromScratchFacilityIds)) {
    failures.push(
      `${paths.artworkBaseline} 的 C1–C7 工厂顺序必须等于服务器目录：${fromScratchFacilityIds.join(', ')}`,
    );
  }

  for (const facilityId of facilityIds) {
    const sourcePath = `src/assets/facility-icons/${facilityId}.png`;
    const thumbnailPath = `src/assets/facility-icons/generated/256/${facilityId}.png`;
    validatePng(sourcePath, 1024, '工厂场景源图');
    validatePng(thumbnailPath, 256, '工厂场景运行时缩略图');

    if (fromScratchFacilityIds.includes(facilityId)) {
      const expectedHash = baselineHashes[facilityId];
      if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) {
        failures.push(`${paths.artworkBaseline} 缺少 ${facilityId} 的有效 SHA-256`);
      } else {
        const actualHash = createHash('sha256')
          .update(readFileSync(resolve(root, sourcePath)))
          .digest('hex');
        if (actualHash !== expectedHash) {
          failures.push(`${sourcePath} 已偏离批准的 C1–C7 从空白新绘插画基线`);
        }
      }
    }

    if (!styles.includes(`[data-facility-icon='${facilityId}']`)) {
      failures.push(`${paths.artworkStyles} 缺少 ${facilityId} 映射`);
    }
    if (!styles.includes(`../assets/facility-icons/generated/256/${facilityId}.png`)) {
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
    '.facility-detail-artwork',
    '.market-detail-hero__artwork',
    '.asset-auction-icon',
    '.asset-auction-package-icon',
    '.asset-auction-bundle-tile',
    '.asset-auction-summary-icon',
    '.asset-auction-history-icon',
    'background-image: var(--facility-artwork-image, none);',
    'background-position: center;',
    'background-size: cover;',
    'stroke: transparent;',
    '@media (prefers-reduced-data: reduce)',
    'stroke: currentColor;',
  ]) {
    if (!styles.includes(required)) failures.push(`${paths.artworkStyles} 缺少: ${required}`);
  }

  for (const forbidden of [
    '.unified-asset-tab.facility',
    '.market-asset-card__icon-layer > .facility-icon',
    '.market-asset-card__icon-layer::after',
    'top: -14px;',
    'height: calc(100% + 28px);',
    'rgb(0 0 0 / 72%) 0%',
    'rgb(0 0 0 / 68%) 0%',
    'top: -18px;',
    'height: calc(100% + 36px);',
  ]) {
    if (styles.includes(forbidden)) failures.push(`工厂插画样式不得恢复旧市场目录卡规则: ${forbidden}`);
  }

  for (const required of [
    '.facility-detail-artwork {',
    '.facility-detail-artwork::after',
    '.facility-detail-artwork .facility-detail-artwork-icon',
    'background-size: cover;',
    'aspect-ratio: 4 / 5;',
  ]) {
    if (!styles.includes(required)) failures.push(`工厂详情未落实纵向场景插画: ${required}`);
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
    'targetSize: 256',
    "rmSync(resolve(process.cwd(), 'src/assets/facility-icons/generated/128')",
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
    '"dev": "npm run generate:artwork && npm run generate:local-preview && vite"',
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
    [paths.production, production, '<FacilityIcon facilityTypeId={type.id} className="facility-detail-artwork-icon" />'],
    [paths.auction, auction, '<FacilityIcon facilityTypeId={item.id} />'],
  ]) {
    if (!source.includes(required)) failures.push(`${path} 未接入工厂场景主视觉: ${required}`);
    if (source.includes('assets/facility-icons/')) failures.push(`${path} 不得直接引用工厂场景图片路径`);
  }
  if (!market.includes('<FacilityIcon facilityTypeId={selectedFacility.id} />')) {
    failures.push(`${paths.market} 未接入工厂详情主视觉`);
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
      '通常应占画面宽度约 `60%–80%`',
      '核心主体必须落在中央约 `80%` 安全区域',
      '天空通常控制在画面高度约 `20%–30%`',
      '道路不是必选元素',
      '不得为了统一构图强制加入道路',
      '当前 C1 复杂度工厂 `farm`、`orchard`、`ranch` 与 `fishery`',
      '当前 C2 复杂度工厂 `logging-camp`、`mine`、`oil-field`、`mill` 与 `sawmill`',
      '当前 C3 复杂度工厂 `pulp-mill`、`steelworks`、`textile-mill`、`food-factory` 与 `paper-mill`',
      '当前 C4 复杂度工厂 `refinery`、`beverage-factory`、`furniture-factory` 与 `garment-factory`',
      '化肥厂当前批准构图以中央造粒塔、双侧储罐、输送管廊和装袋区为核心',
      '`tool-workshop` 当前批准构图以砖钢锯齿屋顶工坊、开放锻造间、工作台与工具架为核心',
      '当前 C5 `machine-factory`、C6 `electronics-factory` 与 C7 `appliance-factory`',
      '采用统一新风格从空白新绘',
      '不以旧图为编辑、描摹或重绘底稿',
      '不把旧 C2 图作为图像生成、编辑、构图参考或描摹输入',
      '不把旧 C3–C7 图作为图像生成、编辑、构图参考或描摹输入',
      '`scripts/facility-artwork-baseline.json`',
      'C1–C7 目录、覆盖复杂度与批准源图 SHA-256 基线一致',
      '无文字、无人物、无水印、无品牌标志',
      '`src/assets/facility-icons/generated/256/`',
      '`FacilityIcon`',
      '`prefers-reduced-data`',
      '覆盖完整 `4:5` 竖卡',
      '当前工厂详情横幅保持 `4:5` 独立插画槽并满幅承载插画',
      '当前工厂详情横幅只在独立插画槽内展示图像',
      '`background-size: cover` 与居中定位',
      '上下两层黑色渐变',
      '核心主体必须落在中央约 `80%` 安全区域内',
      '全部图片都必须在实际 `4:5` 居中裁切后保持核心主体完整',
      '当前工厂详情横幅',
    ]],
    [paths.designIndex, designIndex, ['工厂场景插画主视觉归属 `UI_DESIGN_SYSTEM.md`']],
    [paths.uiDesign, uiDesign, ['`FacilityIcon` 只按 `facilityTypeId` 选择视觉资源']],
    [paths.pageDesign, pageDesign, ['建筑详情只承担工厂经营与生产配置，不提供工厂买卖入口、即时交易草稿或从属交易页']],
    [paths.marketArtworkBrowser, marketArtworkBrowser, [
      'facility detail artwork fills banner slots on desktop and mobile without market trade entry',
      "expect(desktopMetrics.backgroundSize).toBe('cover')",
      "expect(desktopMetrics.backgroundPosition).toBe('50% 50%')",
      'Math.abs(desktopMetrics.artwork.width - desktopMetrics.slot.width)',
      'Math.abs(mobileMetrics.artwork.height - mobileMetrics.slot.height)',
    ]],
  ]) {
    for (const fragment of fragments) {
      if (!source.includes(fragment)) failures.push(`${path} 缺少工厂场景规则: ${fragment}`);
    }
  }

  if (styles.includes('facility-icons/generated/128/')) {
    failures.push('工厂场景样式不得继续引用 128px 运行时缩略图');
  }
  if (uiDesign.includes('facility-icons/generated/128/')) {
    failures.push('工厂场景权威设计不得继续声明 128px 运行时缩略图');
  }
  for (const required of [
    'building cards and facility details use 256px facility thumbnails without market trade entry',
    'naturalWidth',
    'naturalHeight',
    'expectedSize: number',
  ]) {
    if (!resolutionBrowser.includes(required)) {
      failures.push(paths.resolutionBrowser + ' 缺少: ' + required);
    }
  }
}

if (failures.length > 0) {
  console.error(`工厂场景插画与资源验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `工厂场景插画验证通过：${facilityIds.length} 种正式工厂与 1024×1024 RGBA 源图、256×256 运行时缩略图、ID 映射、市场列表与详情独立插画槽、主视觉使用边界及 C1–C7 从空白新绘 SHA-256 基线一致。`,
);
