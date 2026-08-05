import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { installPersistentServerRuntimeMetrics } from '../src/persistent-server-runtime-metrics.js';

function createLiveInstallation(now) {
  let uninstalled = false;
  return {
    startedAt: now - 1_000,
    snapshot() {
      return {
        generatedAt: now,
        startedAt: now - 1_000,
        uptimeSeconds: 1,
        current: {},
        history: [],
        trendBuckets: [],
        trendHistory: [],
      };
    },
    uninstall() {
      uninstalled = true;
    },
    get uninstalled() {
      return uninstalled;
    },
  };
}

test('metrics storage initialization failure keeps the live server collector available', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-server-metrics-degraded-'));
  const now = Date.UTC(2026, 7, 5, 4, 0);
  const warnings = [];
  try {
    const installation = createLiveInstallation(now);
    const result = installPersistentServerRuntimeMetrics({
      installation,
      databasePath: directory,
      bootId: 'degraded-boot',
      now: () => now,
      registerSignals: false,
      warn: (...args) => warnings.push(args),
    });

    assert.equal(result, installation);
    assert.equal(result.persistence.enabled, false);
    assert.equal(result.persistence.degraded, true);
    assert.equal(result.snapshot().uptimeSeconds, 1);
    assert.equal(warnings.length, 1);
    result.uninstall();
    assert.equal(installation.uninstalled, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
