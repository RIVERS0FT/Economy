import {
  applyPopulationPolicy,
  createPopulationAdminSummary,
  resetPopulationPolicy,
  topUpPopulationByPolicy,
} from './population-admin-control.js';
import { EconomyStore as PersistentEconomyStore } from './storage.js';

// Runtime policy mutations intentionally bypass the legacy population-policy audit table.
// The table remains readable only for backward-compatible retention of historical rows.
export class EconomyStore extends PersistentEconomyStore {
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
