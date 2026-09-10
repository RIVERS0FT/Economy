import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from '../server/src/commercial-catalog.js';
import { generateArtworkThumbnails } from './artwork-thumbnails.mjs';

rmSync(resolve(process.cwd(), 'src/assets/commercial-icons/generated/128'), {
  recursive: true,
  force: true,
});

generateArtworkThumbnails({
  ids: COMMERCIAL_BUILDING_TYPE_CATALOG.map((type) => type.id),
  label: '商业建筑场景',
  sourceDirectory: resolve(process.cwd(), 'src/assets/commercial-icons'),
  targetSize: 256,
});
