// Temporary branch-only verifier migration helper; removed before squash merge.
import { readFileSync, writeFileSync } from 'node:fs';

const hotpathPath = 'scripts/verify-authoritative-hotpaths.mjs';
let hotpathSource = readFileSync(hotpathPath, 'utf8');
hotpathSource = hotpathSource.replace("  '已提交世界',\n  '请求草稿',", "  'committed world',\n  'Mutation Scope',");
writeFileSync(hotpathPath, hotpathSource);

const capacityPath = 'scripts/verify-state-delivery-capacity.mjs';
let capacitySource = readFileSync(capacityPath, 'utf8');
capacitySource = capacitySource.replace("  'isDeepStrictEqual(world, cached.world)',\n", '');
const storageForbidMarker = "\nforbidText('server/src/storage.js', [";
if (!capacitySource.includes("requireText('server/src/world-storage-v2.js'")) {
  capacitySource = capacitySource.replace(storageForbidMarker, `\nrequireText('server/src/world-storage-v2.js', [\n  'prepareSegmentedWorldWrite(',\n  'segmentedSnapshotsEqual(',\n  'applySegmentedWorldWrite(',\n]);\n${storageForbidMarker}`);
}
writeFileSync(capacityPath, capacitySource);
