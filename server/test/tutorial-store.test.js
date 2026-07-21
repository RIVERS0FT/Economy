import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';
import { createTutorialStore, CURRENT_TUTORIAL_VERSION } from '../src/tutorial-store.js';

const oldUser = { id: 101, email: 'old-player@example.com', name: 'Old Player' };
const newUser = { id: 202, email: 'new-player@example.com', name: 'New Player' };

function totalChanges(store) {
  return Number(store.database.prepare('SELECT total_changes() AS count').get().count);
}

test('existing players migrate as completed while new players start incomplete', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    store.getState(oldUser, 1_000);
    const beforeMigration = store.loadWorld(1_001).revision;
    const tutorialStore = createTutorialStore(store, 1_002);

    assert.equal(
      tutorialStore.getStatus(oldUser.id).completedVersion,
      CURRENT_TUTORIAL_VERSION,
    );
    assert.equal(store.loadWorld(1_003).revision, beforeMigration);

    store.getState(newUser, 2_000);
    assert.deepEqual(tutorialStore.getStatus(newUser.id), { completedVersion: 0 });

    const restartedStore = createTutorialStore(store, 2_001);
    assert.deepEqual(restartedStore.getStatus(newUser.id), { completedVersion: 0 });
  } finally {
    store.close();
  }
});

test('tutorial completion is idempotent and does not mutate world state', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    const tutorialStore = createTutorialStore(store, 1_000);
    store.getState(newUser, 2_000);
    const beforeCompletion = store.loadWorld(2_001).revision;
    const context = {
      requestKey: 'tutorial-request-202',
      method: 'POST',
      path: '/api/game/tutorial/complete',
      now: 3_000,
    };

    const first = tutorialStore.complete(
      newUser.id,
      CURRENT_TUTORIAL_VERSION,
      context,
    );
    const repeated = tutorialStore.complete(
      newUser.id,
      CURRENT_TUTORIAL_VERSION,
      context,
    );

    assert.deepEqual(repeated, first);
    assert.equal(first.result.ok, true);
    assert.equal(first.tutorial.completedVersion, CURRENT_TUTORIAL_VERSION);
    assert.equal(first.tutorial.completedAt, 3_000);
    assert.equal(store.loadWorld(3_001).revision, beforeCompletion);

    const changesBeforeNewKey = totalChanges(store);
    const repeatedWithNewKey = tutorialStore.complete(
      newUser.id,
      CURRENT_TUTORIAL_VERSION,
      { ...context, requestKey: 'tutorial-request-repeat-202', now: 4_000 },
    );
    assert.deepEqual(repeatedWithNewKey, first);
    assert.equal(totalChanges(store), changesBeforeNewKey);

    assert.throws(
      () => tutorialStore.complete(newUser.id, CURRENT_TUTORIAL_VERSION + 1, {
        ...context,
        requestKey: 'tutorial-invalid-202',
      }),
      (error) => error?.statusCode === 400,
    );
  } finally {
    store.close();
  }
});
