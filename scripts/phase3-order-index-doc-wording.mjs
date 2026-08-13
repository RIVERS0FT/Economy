import { readFileSync, writeFileSync } from 'node:fs';

const path = 'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md';
let source = readFileSync(path, 'utf8');
const from = '客户端允许针对当前收到的 `orders` 数组建立只读派生的客户端订单索引';
const to = '客户端允许针对当前收到的 `orders` 数组建立只读派生加速器形式的客户端订单索引';
if (!source.includes(from)) throw new Error('missing client order index design wording');
source = source.replace(from, to);
writeFileSync(path, source);
