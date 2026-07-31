import { isDeepStrictEqual } from 'node:util';
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
import { configureContractAuditStore } from './contract-audit-store.js';
import { ensureGemState } from './invitations.js';
import { configurePlayerAdminStatistics } from './player-admin-statistics.js';
import { ensureWarehouse } from './warehouse.js';
import { createEconomicCalendarClientState } from './economic-events.js';
import { flushAuctionAuditEvents } from './auction-audit-store.js';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const CONTRACT_ACTIONS = new Set([
  'createProductionContract',
  'acceptProductionContract',
  'cancelProductionContract',
  'prepareProductionContract',
  'fundProductionContract',
  'setProductionContractAutoReserve',
  'setProductionContractAutoFund',
  'proposeProductionContractRenewal',
  'acceptProductionContractRenewal',
  'rejectProductionContractRenewal',
  'revokeProductionContractRenewal',
  'requestProductionContractTermination',
  'terminateProductionContractNow',
]);

function normalizeJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableLegacyLeaderboard(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    const { updatedAt: _updatedAt, ...stableEntry } = entry;
    return stableEntry;
  });
}

function stableRankedLeaderboards(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { generatedAt: _generatedAt, ...stableValue } = value;
  return stableValue;
}

function createStablePartitionClientState(state) {
  const stableState = {
    ...state,
    leaderboard: stableLegacyLeaderboard(state?.leaderboard),
  };
  const stats = state?.stats && typeof state.stats === 'object' && !Array.isArray(state.stats)
    ? { ...state.stats }
    : state?.stats;
  const leaderboards = stableRankedLeaderboards(state?.leaderboards ?? stats?.leaderboards);
  if (stats && typeof stats === 'object' && !Array.isArray(stats)) delete stats.leaderboards;
  stableState.stats = stats;
  delete stableState.leaderboards;
  if (leaderboards) stableState.leaderboards = leaderboards;
  return stableState;
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

function contractProjectionForState(world) {
  const projection = {
    ...world,
    players: structuredClone(world.players || {}),
    productionContracts: structuredClone(world.productionContracts || []),
  };
  if (world.populationEconomy !== undefined) {
    projection.populationEconomy = structuredClone(world.populationEconomy);
  }
  return projection;
}

function contractSnapshot(world) {
  return structuredClone(world.productionContracts || []);
}

// Runtime policy mutations intentionally bypass the legacy population-policy audit table.
// The table remains readable only for backward-compatible retention of historical rows.
export class EconomyStore extends PersistentEconomyStore {
  constructor(...args) {
    super(...args);
    configureContractAuditStore(this);
    configurePlayerAdminStatistics(this);
  }

  prepareWorldForStorage(world, now) {
    const prepared = super.prepareWorldForStorage(world, now);
    migrateProductionContractWorld(prepared);
    prepared.version = 21;
    return prepared;
  }

  _persistWorldWithContractAudit(revision, world, now) {
    this.prepareWorldForStorage(world, now);
    const cached = this.worldCache;
    const unchanged = cached
      && cached.revision === revision
      && !cached.needsPersistence
      && isDeepStrictEqual(world, cached.world);
    if (unchanged) {
      this.flushContractAuditEvents(world, revision, revision);
      flushAuctionAuditEvents(this, world, revision, revision);
      return revision;
    }

    world.lastProcessedAt = now;
    const stateJson = JSON.stringify(world);
    const nextRevision = revision + 1;
    this.updateWorld.run(nextRevision, stateJson, now);
    this.flushContractAuditEvents(world, revision, nextRevision);
    flushAuctionAuditEvents(this, world, revision, nextRevision);
    this.cacheWorld(nextRevision, stateJson, world);
    return nextRevision;
  }

  saveWorld(revision, world, now) {
    return this._persistWorldWithContractAudit(revision, world, now);
  }

  saveWorldIfChanged(revision, world, now, _previousStateJson) {
    return this._persistWorldWithContractAudit(revision, world, now);
  }

  processWorldIfDue(world, now, currentUserId, options = {}) {
    const beforeContracts = contractSnapshot(world);
    const processed = super.processWorldIfDue(world, now, currentUserId, options);
    if (processed) {
      processProductionContracts(world, now);
      this.captureContractAuditTransition(beforeContracts, world, {
        triggerType: options.auditTrigger || (currentUserId === undefined ? 'scheduler' : 'request_world_process'),
        now,
      });
    }
    return processed;
  }

  getStateSnapshot(user, knownRevision, now = Date.now()) {
    const snapshot = super.getStateSnapshot(user, knownRevision, now);
    if (snapshot.unchanged || !snapshot.state) return snapshot;

    const cached = this.worldCache;
    const contractState = cached && cached.revision === snapshot.revision
      ? createProductionContractClientState(
        contractProjectionForState(cached.world),
        Number(user.id),
        now,
      )
      : this.transaction(() => {
        const { world } = this.loadWorld(now);
        return createProductionContractClientState(world, Number(user.id), now);
      }, { immediate: false });

    return {
      ...snapshot,
      state: {
        ...createStablePartitionClientState(snapshot.state),
        ...normalizeJson(contractState),
        economicCalendar: normalizeJson(createEconomicCalendarClientState(now)),
      },
    };
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
      this.processWorldIfDue(world, now, Number(user.id), { force: true, auditTrigger: 'action_preprocess' });

      const beforeActionPlayer = structuredClone(world.players[String(user.id)]);
      const beforeActionContracts = contractSnapshot(world);
      const gameResult = applyProductionContractAction(world, user, action, payload, now);
      const activePlayer = world.players[String(user.id)];
      const actionChanged = activePlayer && (
        !isDeepStrictEqual(activePlayer, beforeActionPlayer)
        || !isDeepStrictEqual(world.productionContracts || [], beforeActionContracts)
      );
      if (gameResult?.ok && actionChanged) {
        activePlayer.lastEconomicActivityAt = now;
        this.captureContractAuditTransition(beforeActionContracts, world, {
          actorUserId: Number(user.id),
          triggerType: 'player_action',
          action,
          requestKey,
          now,
        });
      }

      this.processWorldIfDue(world, now, Number(user.id), { force: true, auditTrigger: 'action_postprocess' });
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
