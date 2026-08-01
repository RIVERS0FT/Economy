import { resolve } from 'node:path';
import { generateArtworkThumbnails } from './artwork-thumbnails.mjs';

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

generateArtworkThumbnails({
  ids: productIds,
  label: '商品',
  sourceDirectory: resolve(process.cwd(), 'src/assets/product-icons'),
});
