import { readFileSync, writeFileSync } from 'node:fs';

const path = 'server/test/world-storage-v2.test.js';
const source = readFileSync(path, 'utf8');
const before = "    const committedBob = store.worldCache.world.players['2'];\n    assert.equal(Object.hasOwn(committedBob, 'facilities'), false);";
const after = `    const committedBob = store.worldCache.world.players['2'];
    assert.equal(Object.hasOwn(committedBob, 'facilities'), false);
    Object.defineProperty(committedBob, 'facilities', {
      configurable: true,
      enumerable: false,
      get() { return undefined; },
      set(value) {
        const error = new Error('UNRELATED_FACILITIES_MUTATION');
        error.assignedValue = value;
        throw error;
      },
    });`;
if (!source.includes(before)) throw new Error('trace insertion target missing');
writeFileSync(path, source.replace(before, after));
