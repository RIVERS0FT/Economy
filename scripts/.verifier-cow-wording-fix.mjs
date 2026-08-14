// Temporary branch-only verifier migration helper; remove it with the temporary workflow before squash merge.
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

const populationVerifierPath = 'scripts/verify-staple-crops-demand.mjs';
let populationVerifierSource = readFileSync(populationVerifierPath, 'utf8');
populationVerifierSource = populationVerifierSource.replace(
  "const runtimeStore = read('server/src/runtime-store.js');",
  "const runtimeStore = `${read('server/src/runtime-store-core.js')}\\n${read('server/src/runtime-store.js')}`;",
);
writeFileSync(populationVerifierPath, populationVerifierSource);

const auctionVerifierPath = 'scripts/verify-asset-auctions.mjs';
let auctionVerifierSource = readFileSync(auctionVerifierPath, 'utf8');
auctionVerifierSource = auctionVerifierSource.replace("  'flushAuctionAuditEvents(this, world, revision, nextRevision);',\n  'getAuctionBidHistory(user, auctionId, now = Date.now())',", "  'getAuctionBidHistory(user, auctionId, now = Date.now())',");
auctionVerifierSource = auctionVerifierSource.replace(
  "requireText('server/src/runtime-store.js', ['flushAuctionAuditEvents(this, world, revision, nextRevision);', 'prepared.version = 26;']);",
  "requireText('server/src/runtime-store-core.js', ['flushAuctionAuditEvents(this, world, revision, nextRevision);']);\nrequireText('server/src/world-storage-v2.js', ['AUTHORITATIVE_WORLD_VERSION = 29;']);",
);
writeFileSync(auctionVerifierPath, auctionVerifierSource);
