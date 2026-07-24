import {
  applyPopulationPolicy,
  createPopulationAdminSummary,
  resetPopulationPolicy,
  topUpPopulationByPolicy,
} from './population-admin-control.js';
import { EconomyStore as PersistentEconomyStore } from './storage.js';
import { ensurePlayer } from './domain.js';
import {
  applyProductionContractAction,
  createProductionContractClientState,
  migrateProductionContractWorld,
  processProductionContracts,
} from './contracts.js';
import { ensureGemState } from './invitations.js';
import { ensureWarehouse } from './warehouse.js';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const CONTRACT_ACTIONS = new Set([
  'createProductionContract',
  'acceptProductionContract',
  'cancelProductionContract',
  'prepareProductionContract',
  'fundProductionContract',
  'setProductionContractAutoReserve',
  'setProductionContractAutoFund',
  'requestProductionContractTermination',
  'terminateProductionContractNow',
]);

function normalizeJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createActionAcknowledgement(result, revision) {
  return normalizeJson({
    result: {
      ok: result?.ok === true,
      message: String(result?.message || ''),
    },
    revision: Number(revision),
  });
}

// Runtime policy mutations intentionally bypass the legacy population-policy audit table.
// The table remains readable only for backward-compatible retention of historical rows.
export class EconomyStore extends PersistentEconomyStore {
  prepareWorldForStorage(world, now) {
    const prepared = super.prepareWorldForStorage(world, now);
    migrateProductionContractWorld(prepared);
    prepared.version = 14;
    return prepared;
  }

  processWorldIfDue(world, now, currentUserId, options = {}) {
    const processed = super.processWorldIfDue(world, now, currentUserId, options);
    if (processed) processProductionContracts(world, now);
    return processed;
  }

  getStateSnapshot(user, knownRevision, now = Date.now()) {
    const snapshot = super.getStateSnapshot(user, knownRevision, now);
    if (snapshot.unchanged || !snapshot.state) return snapshot;

    return this.transaction(() => {
      const { world } = this.loadWorld(now);
      return {
        ...snapshot,
        state: normalizeJson({
          ...snapshot.state,
          ...createProductionContractClientState(world, Number(user.id), now),
        }),
      };
    }, { immediate: false });
  }

  apply(user, requestMeta, now = Date.now()) {
    if (!CONTRACT_ACTIONS.has(requestMeta.action)) return super.apply(user, requestMeta, now);

    const {
      action,
      payload = {},
      requestKey,
      method,
      path,
    } = requestMeta;

    return this.transaction(() => {
      const cached = this.selectIdempotency.get(Number(user.id), requestKey);
      if (cached) {
        if (cached.request_method !== method || cached.request_path !== path) {
          const error = new Error('幂等键已被其他操作使用');
          error.statusCode = 409;
          throw error;
        }
        const cachedResponse = JSON.parse(String(cached.response_json));
        return createActionAcknowledgement(cachedResponse.result, cachedResponse.revision);
      }

      const { revision, world } = this.loadWorld(now);
      const player = ensurePlayer(world, user, now);
      ensureWarehouse(player);
      ensureGemState(player);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });

      const gameResult = applyProductionContractAction(world, user, action, payload, now);
      if (gameResult?.ok) player.lastEconomicActivityAt = now;

      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      ensureWarehouse(world.players[String(user.id)]);
      ensureGemState(world.players[String(user.id)]);
      const nextRevision = this.saveWorld(revision, world, now);
      const response = createActionAcknowledgement(gameResult, nextRevision);
      this.insertIdempotency.run(
        Number(user.id),
        requestKey,
        method,
        path,
        JSON.stringify(response),
        now,
      );
      this.deleteExpiredIdempotency.run(now - IDEMPOTENCY_TTL_MS);
      return response;
    });
  }

  updatePopulationPolicy(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      const result = applyPopulationPolicy(world, payload, { adminUserId: Number(user.id), now });
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      return {
        policy: result.afterPolicy,
        populationEconomy: createPopulationAdminSummary(world, now),
        revision: nextRevision,
      };
    }, now);
  }

  resetPopulationPolicy(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      const result = resetPopulationPolicy(world, payload, { adminUserId: Number(user.id), now });
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      return {
        policy: result.afterPolicy,
        populationEconomy: createPopulationAdminSummary(world, now),
        revision: nextRevision,
      };
    }, now);
  }

  topUpPopulation(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      const result = topUpPopulationByPolicy(world, payload, { now });
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      return {
        ...result,
        populationEconomy: createPopulationAdminSummary(world, now),
        revision: nextRevision,
      };
    }, now);
  }
}
