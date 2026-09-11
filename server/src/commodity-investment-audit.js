import { cashQuantity } from './cash-economy-money.js';

const eventsByWorld = new WeakMap();
const statementsByStore = new WeakMap();

/** Pending events belong to the same isolated world draft as their economic mutation. */
export function stageCommodityInvestmentAudit(world, player, transaction) {
  const userId = cashQuantity(Number(player.userId), '投资账户玩家');
  const saveEpoch = cashQuantity(player.saveEpoch ?? 0, '存档世代', { allowZero: true });
  const events = eventsByWorld.get(world) ?? [];
  events.push({
    eventKey: `${userId}:${saveEpoch}:${transaction.id}`, userId, saveEpoch,
    transaction: structuredClone(transaction),
  });
  eventsByWorld.set(world, events);
}

function statementFor(store) {
  if (statementsByStore.has(store)) return statementsByStore.get(store);
  store.database.exec(`
    CREATE TABLE IF NOT EXISTS economy_commodity_investment_audit (
      event_key TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      save_epoch INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      processed_at INTEGER NOT NULL,
      revision_before INTEGER NOT NULL,
      revision_after INTEGER NOT NULL,
      event_json TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_commodity_investment_audit_player
      ON economy_commodity_investment_audit(user_id, save_epoch, occurred_at DESC);
  `);
  const statement = store.database.prepare(`
    INSERT INTO economy_commodity_investment_audit (
      event_key, user_id, save_epoch, event_type, occurred_at, processed_at,
      revision_before, revision_after, event_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  statementsByStore.set(store, statement);
  return statement;
}

export function configureCommodityInvestmentAuditStore(store) {
  statementFor(store);
}

/** The store calls this before committing its SQLite transaction; a duplicate event is an error. */
export function flushCommodityInvestmentAudit(store, world, beforeRevision, afterRevision) {
  const events = eventsByWorld.get(world);
  if (!events?.length) return 0;
  const statement = statementFor(store);
  for (const event of events) {
    const row = event.transaction;
    statement.run(event.eventKey, event.userId, event.saveEpoch, row.type,
      row.createdAt, row.processedAt, beforeRevision, afterRevision, JSON.stringify(row));
  }
  eventsByWorld.delete(world);
  return events.length;
}
