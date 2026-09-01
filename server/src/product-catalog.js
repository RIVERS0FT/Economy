const rawProducts = [
  { id: 'wheat', name: '小麦', category: 'raw', basePrice: 1.2 },
  { id: 'rice', name: '水稻', category: 'raw', basePrice: 1.2 },
  { id: 'cotton', name: '棉花', category: 'raw', basePrice: 1.2 },
  { id: 'sugarcane', name: '甘蔗', category: 'raw', basePrice: 1.2 },
  { id: 'fruit', name: '水果', category: 'raw', basePrice: 1.3 },
  { id: 'timber', name: '木材', category: 'raw', basePrice: 6 },
  { id: 'ore', name: '铁矿石', category: 'raw', basePrice: 7 },
  { id: 'copper-ore', name: '铜矿石', category: 'raw', basePrice: 7 },
  { id: 'crude-oil', name: '原油', category: 'raw', basePrice: 9 },
  { id: 'meat', name: '肉', category: 'consumer', basePrice: 2.4 },
  { id: 'eggs', name: '蛋', category: 'consumer', basePrice: 2.4 },
  { id: 'milk', name: '奶', category: 'consumer', basePrice: 2.4 },
  { id: 'fish', name: '鱼类', category: 'raw', basePrice: 2.5 },
  { id: 'wool', name: '毛', category: 'raw', basePrice: 2.4 },
  { id: 'flour', name: '面粉', category: 'intermediate', basePrice: 13 },
  { id: 'sugar', name: '砂糖', category: 'intermediate', basePrice: 13 },
  { id: 'lumber', name: '木板', category: 'intermediate', basePrice: 17 },
  { id: 'steel', name: '钢材', category: 'intermediate', basePrice: 29 },
  { id: 'copper', name: '铜材', category: 'intermediate', basePrice: 29 },
  { id: 'plastic', name: '塑料', category: 'intermediate', basePrice: 30 },
  { id: 'industrial-fuel', name: '燃料', category: 'intermediate', basePrice: 4 },
  { id: 'industrial-chemicals', name: '工业化学品', category: 'intermediate', basePrice: 5 },
  { id: 'fertilizer', name: '化肥', category: 'intermediate', basePrice: 6.76 },
  { id: 'feed', name: '配合饲料', category: 'intermediate', basePrice: 5.8 },
  { id: 'veterinary-medicine', name: '养殖药剂', category: 'intermediate', basePrice: 14.1 },
  { id: 'textile', name: '纺织品', category: 'intermediate', basePrice: 20 },
  { id: 'pulp', name: '纸浆', category: 'intermediate', basePrice: 20 },
  { id: 'food', name: '食品', category: 'consumer', basePrice: 15 },
  { id: 'beverage', name: '饮料', category: 'consumer', basePrice: 18 },
  { id: 'prepared-meal', name: '预制餐', category: 'consumer', basePrice: 18 },
  { id: 'paper', name: '纸品', category: 'consumer', basePrice: 15 },
  { id: 'furniture', name: '家具', category: 'consumer', basePrice: 24 },
  { id: 'clothing', name: '服装', category: 'consumer', basePrice: 55 },
  { id: 'tools', name: '工具', category: 'industrial', basePrice: 12 },
  { id: 'machinery', name: '机械', category: 'industrial', basePrice: 15.55 },
  { id: 'tractor', name: '拖拉机', category: 'industrial', basePrice: 15.35 },
  { id: 'electronics', name: '电子产品', category: 'industrial', basePrice: 84 },
  { id: 'appliance', name: '家电', category: 'industrial', basePrice: 92 },
];

export const PRODUCT_CATALOG = Object.freeze(rawProducts.map((product) => Object.freeze({ ...product })));
const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

export function productDisplayName(productId) {
  const id = String(productId || '');
  const product = PRODUCT_BY_ID.get(id);
  if (!product) throw new Error(`未知商品: ${id}`);
  return product.name;
}

export function resolveProductDisplayNames(template) {
  return String(template || '').replace(/\{product:([^{}]+)\}/g, (_match, productId) => productDisplayName(productId));
}
