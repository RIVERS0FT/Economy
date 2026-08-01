import { resolve } from 'node:path';
import { FACILITY_TYPE_CATALOG } from '../server/src/industry-catalog.js';
import { generateArtworkThumbnails } from './artwork-thumbnails.mjs';

generateArtworkThumbnails({
  ids: FACILITY_TYPE_CATALOG.map((facility) => facility.id),
  label: '工厂场景',
  sourceDirectory: resolve(process.cwd(), 'src/assets/facility-icons'),
});
