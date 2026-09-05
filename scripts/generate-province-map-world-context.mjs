import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeArcs } from 'topojson-client';

const require = createRequire(import.meta.url);
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputs = [
  {
    resolution: '10m',
    outputPath: resolve(repositoryRoot, 'src/data/north-america-land-10m.json'),
  },
  {
    resolution: '110m',
    outputPath: resolve(repositoryRoot, 'src/data/north-america-coastline-110m.json'),
  },
];

const NORTH_AMERICA_CONTEXT_COUNTRY_IDS = new Set([
  '044', '084', '124', '188', '192', '214', '222', '304', '320',
  '332', '340', '388', '484', '558', '591', '666', '840',
]);

function buildPrunedTopology(resolution) {
  const atlasPath = require.resolve(`world-atlas/countries-${resolution}.json`);
  const worldCountryAtlas = JSON.parse(readFileSync(atlasPath, 'utf8'));
  const contextGeometries = worldCountryAtlas.objects.countries.geometries.filter((geometry) => {
    const normalizedId = String(geometry.id ?? '').padStart(3, '0');
    return NORTH_AMERICA_CONTEXT_COUNTRY_IDS.has(normalizedId);
  });
  assert.ok(contextGeometries.length >= 10, `PROVINCE_MAP_WORLD_${resolution.toUpperCase()}_CONTEXT_REQUIRED`);
  const mergedGeometry = mergeArcs(worldCountryAtlas, contextGeometries);

  const referencedArcIndexes = new Set();
  const collectArcIndexes = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length > 0 && value.every((entry) => Number.isInteger(entry))) {
      for (const arcRef of value) referencedArcIndexes.add(arcRef < 0 ? ~arcRef : arcRef);
      return;
    }
    for (const nested of value) collectArcIndexes(nested);
  };
  collectArcIndexes(mergedGeometry.arcs);
  const orderedArcIndexes = [...referencedArcIndexes].sort((left, right) => left - right);
  const remapByOriginalIndex = new Map(orderedArcIndexes.map((originalIndex, index) => [originalIndex, index]));
  const remapArcRefs = (value) => {
    if (!Array.isArray(value)) return value;
    if (value.length > 0 && value.every((entry) => Number.isInteger(entry))) {
      return value.map((arcRef) => {
        const originalIndex = arcRef < 0 ? ~arcRef : arcRef;
        const nextIndex = remapByOriginalIndex.get(originalIndex);
        assert.notEqual(nextIndex, undefined, `missing remapped arc ${originalIndex}`);
        return arcRef < 0 ? ~nextIndex : nextIndex;
      });
    }
    return value.map(remapArcRefs);
  };

  return {
    topology: {
      type: 'Topology',
      transform: worldCountryAtlas.transform,
      objects: {
        land: {
          type: mergedGeometry.type,
          arcs: remapArcRefs(mergedGeometry.arcs),
        },
      },
      arcs: orderedArcIndexes.map((originalIndex) => worldCountryAtlas.arcs[originalIndex]),
    },
    arcCount: orderedArcIndexes.length,
  };
}

for (const output of outputs) {
  const { topology, arcCount } = buildPrunedTopology(output.resolution);
  const generated = `${JSON.stringify(topology)}\n`;
  if (process.argv.includes('--check')) {
    const current = readFileSync(output.outputPath, 'utf8');
    assert.equal(
      current,
      generated,
      `北美 ${output.resolution} 运行时 TopoJSON 必须由固定 world-atlas 2.0.2 输入逐字生成`,
    );
    console.log(`Strategic map pruned ${output.resolution} topology verified: ${Buffer.byteLength(current)} bytes`);
  } else {
    writeFileSync(output.outputPath, generated);
    console.log(`Generated ${output.outputPath}: ${Buffer.byteLength(generated)} bytes from ${arcCount} arcs`);
  }
}
