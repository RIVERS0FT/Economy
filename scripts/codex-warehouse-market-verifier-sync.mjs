import fs from 'node:fs';

const path = 'scripts/verify-warehouse-expansion.mjs';
let source = fs.readFileSync(path, 'utf8');
const replacements = [
  ["  '市场目录只展示商品',", "  '一级市场采用“商品目录 → 商品全局详情 → 地区商品详情”',"],
  ["  '自动交易只在当前地区商品详情显示并锁定当前商品',", "  '两条路径最终都复用同一个地区商品详情、订单簿、下单和自动交易实现',"],
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`missing verifier anchor: ${before}`);
  source = source.replace(before, after);
}
fs.writeFileSync(path, source);
console.log('Warehouse market verifier synchronized.');
