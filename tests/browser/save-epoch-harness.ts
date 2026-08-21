import {
  gameActions,
  getGameState,
  getPageSaveEpochErrorMessage,
  resetGameSession,
  resetGameStateDelivery,
} from '../../src/api/game';
import { subscribeStateAuthority } from '../../src/app/stateDelivery.js';

async function loadState(revision?: number) {
  try {
    const response = await getGameState(revision);
    return {
      ok: true,
      revision: response.revision,
      saveEpoch: response.state?.saveEpoch ?? null,
      error: '',
      staleMessage: getPageSaveEpochErrorMessage(),
    };
  } catch (error) {
    return {
      ok: false,
      revision: null,
      saveEpoch: null,
      error: error instanceof Error ? error.message : String(error),
      staleMessage: getPageSaveEpochErrorMessage(),
    };
  }
}

async function loadAndWriteOnAuthorityPublish() {
  resetGameSession();
  let publishWrite: Promise<unknown> | null = null;
  let started = false;
  const unsubscribe = subscribeStateAuthority(() => {
    if (started) return;
    started = true;
    publishWrite = gameActions.placeCommodityOrder('wheat', 'buy', 1, 1)
      .then((response) => ({ ok: response.result.ok, message: response.result.message }))
      .catch((error) => ({ ok: false, message: error instanceof Error ? error.message : String(error) }));
  });
  try {
    const state = await loadState();
    const write = publishWrite ? await publishWrite : null;
    return { state, write };
  } finally {
    unsubscribe();
  }
}

async function writeAfterOrdinaryReset() {
  resetGameStateDelivery();
  try {
    const response = await gameActions.placeCommodityOrder('wheat', 'buy', 1, 1);
    return { ok: response.result.ok, message: response.result.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

async function writeAfterEpochMismatch() {
  try {
    const response = await gameActions.placeCommodityOrder('wheat', 'buy', 1, 1);
    return { ok: response.result.ok, message: response.result.message };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      staleMessage: getPageSaveEpochErrorMessage(),
    };
  }
}

Object.assign(window, {
  __saveEpochHarness: {
    loadState,
    loadAndWriteOnAuthorityPublish,
    writeAfterOrdinaryReset,
    writeAfterEpochMismatch,
    resetGameSession,
  },
});
