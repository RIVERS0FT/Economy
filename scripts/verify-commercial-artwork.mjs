import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from '../server/src/commercial-catalog.js';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const ids = COMMERCIAL_BUILDING_TYPE_CATALOG.map((type) => type.id);
const baseline = JSON.parse(read('scripts/commercial-artwork-baseline.json'));
const component = read('src/components/commercial/CommercialBuildingArtwork.tsx');
const styles = read('src/styles/commercial-artwork.css');
const generator = read('scripts/generate-commercial-artwork-thumbnails.mjs');
const packageJson = read('package.json');
const gitignore = read('.gitignore');
const design = read('docs/UI_DESIGN_SYSTEM.md');
const main = read('src/main.tsx');

function validatePng(path, expectedSize, label) {
  assert.ok(existsSync(resolve(root, path)), `缺少${label}: ${path}`);
  const image = readFileSync(resolve(root, path));
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path} 不是有效 PNG`);
  assert.equal(image.readUInt32BE(16), expectedSize, `${path} 宽度必须为 ${expectedSize}`);
  assert.equal(image.readUInt32BE(20), expectedSize, `${path} 高度必须为 ${expectedSize}`);
  assert.equal(image[24], 8, `${path} 必须为 8-bit PNG`);
  assert.equal(image[25], 6, `${path} 必须为 RGBA PNG`);
  assert.equal(image[28], 0, `${path} 不得隔行`);
}

assert.equal(baseline.version, 1);
assert.equal(baseline.style, 'commercial-storefronts-2026-09-10');
assert.equal(baseline.creationMode, 'from-scratch-new-illustration');
assert.deepEqual(baseline.commercialTypeIds, ids, '商业插画基线顺序必须匹配正式商业目录');
const sourceDirectory = resolve(root, 'src/assets/commercial-icons');
assert.deepEqual(
  readdirSync(sourceDirectory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.png')).map((entry) => entry.name).sort(),
  ids.map((id) => `${id}.png`).sort(),
  '商业场景源图必须与正式商业目录一一对应',
);

for (const id of ids) {
  const sourcePath = `src/assets/commercial-icons/${id}.png`;
  const thumbnailPath = `src/assets/commercial-icons/generated/256/${id}.png`;
  validatePng(sourcePath, 1024, '商业场景源图');
  validatePng(thumbnailPath, 256, '商业场景运行时缩略图');
  const hash = createHash('sha256').update(readFileSync(resolve(root, sourcePath))).digest('hex');
  assert.equal(hash, baseline.sha256[id], `${sourcePath} 已偏离批准插画基线`);
  assert.ok(component.includes(`'${id}'`), `商业插画组件缺少 ${id}`);
  assert.ok(styles.includes(`[data-commercial-artwork='${id}']`), `商业插画样式缺少 ${id}`);
  assert.ok(styles.includes(`commercial-icons/generated/256/${id}.png`), `商业插画样式未使用 ${id} 的运行时缩略图`);
  assert.equal(styles.includes(`commercial-icons/${id}.png`), false, '运行时不得直接加载 1024px 源图');
}

for (const token of [
  "COMMERCIAL_BUILDING_TYPE_CATALOG } from '../server/src/commercial-catalog.js'",
  "sourceDirectory: resolve(process.cwd(), 'src/assets/commercial-icons')",
  'targetSize: 256',
]) assert.ok(generator.includes(token), `商业插画生成器缺少 ${token}`);
for (const token of [
  '"generate:commercial-artwork": "node scripts/generate-commercial-artwork-thumbnails.mjs"',
  '"verify:commercial-artwork": "npm run generate:commercial-artwork && node scripts/verify-commercial-artwork.mjs"',
  'npm run verify:commercial-artwork',
]) assert.ok(packageJson.includes(token), `package.json 缺少 ${token}`);
assert.ok(gitignore.includes('src/assets/commercial-icons/generated/'));
assert.ok(main.includes("import './styles/commercial-artwork.css';"));
assert.ok(main.indexOf("import './styles/commercial-artwork.css';") < main.indexOf("import './styles/design-system.css';"));
for (const token of [
  '`src/assets/commercial-icons/`',
  '`src/assets/commercial-icons/generated/256/`',
  '高质量写实数字插画／商业级写实 CG',
  '全部图片都必须在实际 `4:5` 居中裁切后保持核心店面完整',
]) assert.ok(design.includes(token), `商业插画设计缺少 ${token}`);

console.log(`commercial artwork verification passed: ${ids.length} source illustrations and 256px runtime thumbnails match the approved catalog baseline`);
