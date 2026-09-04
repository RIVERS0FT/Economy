import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label}: missing ${text}`);
}

const commodityCss = read('src/styles/market-commodity-row.css');
const design = read('docs/UI_DESIGN_SYSTEM.md');
const browserSpec = read('tests/browser/commodity-row-density.spec.ts');

for (const token of [
  '.entity-list-row:is(.market-commodity-row, .global-market-goods-row)',
  '--entity-list-row-height: 50px;',
  '--entity-list-artwork-slot: 36px;',
  '--entity-list-artwork-size: 32px;',
  '--entity-list-row-height: 46px;',
  '--entity-list-artwork-slot: 32px;',
  '--entity-list-artwork-size: 28px;',
  '--entity-list-row-height: 44px;',
  '--entity-list-artwork-slot: 30px;',
  '--entity-list-artwork-size: 26px;',
  '.global-market-goods-row__artwork,',
  'aspect-ratio: 1 / 1;',
]) requireText(commodityCss, token, 'commodity row density css');

for (const token of [
  '一级市场商品目录、全局商品详情与地区市场共享的紧凑商品数据行密度、1:1 商品插画槽',
  '商品数据行桌面最小高 `50px`，不大于 620px 时为 `46px`，不大于 360px 时为 `44px`',
  '插画槽与 `ProductArtwork` 必须显式保持 `1:1`',
  '`44px` 是移动触控下限',
  '商品数据行是紧凑高度例外',
]) requireText(design, token, 'commodity row density design');

for (const token of [
  "name: '打开小麦全局详情'",
  "name: '查看小麦详情'",
  "'.global-market-goods-row__artwork'",
  "'.market-commodity-row__artwork'",
  "'50px': { slot: [36, 36], artwork: [32, 32] },",
  "'46px': { slot: [32, 32], artwork: [28, 28] },",
  "'44px': { slot: [30, 30], artwork: [26, 26] },",
  'expect(metrics.slot).toEqual(density.slot);',
  'expect(metrics.artwork).toEqual(density.artwork);',
  'expect(compactGlobal.slot).toEqual([30, 30]);',
  'expect(compactGlobal.artwork).toEqual([26, 26]);',
  'expect(compactRegional).toEqual(compactGlobal);',
  "expect(compactGlobal.minHeight).toBe('44px');",
]) requireText(browserSpec, token, 'commodity row density browser coverage');

console.log('commodity row density verification passed');
