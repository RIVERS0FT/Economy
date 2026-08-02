import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content.replace(/\r\n/g, '\n'));
}

function replaceOnce(path, before, after) {
  const source = read(path);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path} 缺少待替换内容`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${path} 待替换内容出现多次`);
  }
  write(path, source.slice(0, first) + after + source.slice(first + before.length));
}

function replaceAllRequired(path, before, after, minimumCount = 1) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count < minimumCount) throw new Error(`${path} 待替换内容不足：${before}`);
  write(path, source.split(before).join(after));
}

const uiDesignPath = 'docs/UI_DESIGN_SYSTEM.md';
replaceOnce(
  uiDesignPath,
  '工厂场景插画 128px 运行时缩略图映射',
  '工厂场景插画 256px 运行时缩略图映射',
);
replaceOnce(
  uiDesignPath,
  '`src/assets/facility-icons/generated/128/` 下的 128px RGBA 缩略图',
  '`src/assets/facility-icons/generated/256/` 下的 256px RGBA 缩略图',
);
replaceOnce(
  uiDesignPath,
  '生产集群选择卡中的插画必须覆盖完整 `4:5` 竖卡；市场工厂目录卡中的插画必须覆盖完整目录卡。',
  '生产集群选择卡、市场工厂目录卡与拍卖工厂主视觉统一加载 256px 运行时缩略图；生产集群选择卡中的插画必须覆盖完整 `4:5` 竖卡，市场工厂目录卡中的插画必须覆盖完整目录卡。',
);

const verifierPath = 'scripts/verify-facility-artwork.mjs';
replaceAllRequired(
  verifierPath,
  'src/assets/facility-icons/generated/128/',
  'src/assets/facility-icons/generated/256/',
  2,
);
replaceAllRequired(
  verifierPath,
  '../assets/facility-icons/generated/128/',
  '../assets/facility-icons/generated/256/',
  1,
);
replaceOnce(
  verifierPath,
  "validatePng(thumbnailPath, 128, '工厂场景运行时缩略图');",
  "validatePng(thumbnailPath, 256, '工厂场景运行时缩略图');",
);
replaceOnce(
  verifierPath,
  `  marketArtworkBrowser: 'tests/browser/market-facility-artwork.spec.ts',\n};`,
  `  marketArtworkBrowser: 'tests/browser/market-facility-artwork.spec.ts',\n  resolutionBrowser: 'tests/browser/facility-artwork-resolution.spec.ts',\n};`,
);
replaceOnce(
  verifierPath,
  `  const marketArtworkBrowser = read(paths.marketArtworkBrowser);`,
  `  const marketArtworkBrowser = read(paths.marketArtworkBrowser);\n  const resolutionBrowser = read(paths.resolutionBrowser);`,
);
replaceOnce(
  verifierPath,
  `    "sourceDirectory: resolve(process.cwd(), 'src/assets/facility-icons')",\n    "generateArtworkThumbnails } from './artwork-thumbnails.mjs'",`,
  `    "sourceDirectory: resolve(process.cwd(), 'src/assets/facility-icons')",\n    'targetSize: 256',\n    "rmSync(resolve(process.cwd(), 'src/assets/facility-icons/generated/128')",\n    "generateArtworkThumbnails } from './artwork-thumbnails.mjs'",`,
);
replaceOnce(
  verifierPath,
  `  }\n}\n\nif (failures.length > 0) {`,
  `  }\n\n  if (styles.includes('facility-icons/generated/128/')) {\n    failures.push('工厂场景样式不得继续引用 128px 运行时缩略图');\n  }\n  if (uiDesign.includes('facility-icons/generated/128/')) {\n    failures.push('工厂场景权威设计不得继续声明 128px 运行时缩略图');\n  }\n  for (const required of [\n    'production and market facility artwork use 256px runtime thumbnails',\n    'naturalWidth',\n    'naturalHeight',\n    'expectedSize: number',\n  ]) {\n    if (!resolutionBrowser.includes(required)) {\n      failures.push(\`${paths.resolutionBrowser} 缺少: \${required}\`);\n    }\n  }\n}\n\nif (failures.length > 0) {`,
);
replaceOnce(
  verifierPath,
  '工厂场景插画验证通过：${facilityIds.length} 种正式工厂与 1024×1024 RGBA 源图、128×128 运行时缩略图、',
  '工厂场景插画验证通过：${facilityIds.length} 种正式工厂与 1024×1024 RGBA 源图、256×256 运行时缩略图、',
);

const browserPath = 'tests/browser/facility-artwork-resolution.spec.ts';
write(browserPath, `import { expect, test, type Locator } from '@playwright/test';\n\nasync function expectBackgroundImageResolution(locator: Locator, expectedSize: number) {\n  const size = await locator.evaluate(async (element) => {\n    const backgroundImage = getComputedStyle(element).backgroundImage;\n    const match = backgroundImage.match(/url\\(["']?(.*?)["']?\\)/);\n    if (!match) return null;\n\n    const image = new Image();\n    image.src = match[1];\n    await image.decode();\n    return { width: image.naturalWidth, height: image.naturalHeight };\n  });\n\n  expect(size).toEqual({ width: expectedSize, height: expectedSize });\n}\n\ntest('production and market facility artwork use 256px runtime thumbnails', async ({ page }) => {\n  await page.setViewportSize({ width: 1440, height: 900 });\n  await page.goto('runtime-test.html?view=production&scenario=facility-card-profit');\n  await expectBackgroundImageResolution(\n    page.locator('.facility-cluster-selector-card .facility-icon').first(),\n    256,\n  );\n\n  await page.goto('market-runtime-test.html?scenario=active');\n  await expectBackgroundImageResolution(\n    page.locator('.unified-asset-tab.facility .market-asset-card__icon-layer .facility-icon').first(),\n    256,\n  );\n});\n`);

console.log('工厂场景运行时缩略图已升级为 256px。');
