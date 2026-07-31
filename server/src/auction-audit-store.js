import { randomUUID } from 'node:crypto';
import { internalMoneyToMicros, microsToInternalMoney } from './money.js';

const AUCTION_AUDIT_BUFFER = Symbol('economy.auctionAuditBuffer');
const BID_HISTORY_LIMIT = 10;

function nullableSafeInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Math.floor(Number(value));
  return Number.isSafeInteger(number) ? number : null;
}

function storedMoney(value) {
  if (value === null || value === undefined) return null;
  const micros = internalMoneyToMicros(value);
  if (micros === null || micros > BigInt(Number.MAX_SAFE_INTEGER) || micros < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('拍卖审计金额超出系统可表示范围');
  }
  return Number(micros);
}

function restoredMoney(value) {
  if (value === null || value === undefined) return null;
  try {
    return microsToInternalMoney(BigInt(value));
  } catch {
    return null;
  }
}

export function queueAuctionAuditEvent(world, event) {
  if (!world || typeof world !== 'object') return;
  let buffer = world[AUCTION_AUDIT_BUFFER];
  if (!Array.isArray(buffer)) {
    buffer = [];
    Object.defineProperty(world, AUCTION_AUDIT_BUFFER, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: buffer,
    });
  }
  buffer.push({
    sourceKey: String(event.sourceKey || `auction-event-${randomUUID()}`),
    auctionId: String(event.auctionId || ''),
    eventType: String(event.eventType || 'unknown'),
    actorUserId: nullableSafeInteger(event.actorUserId),
    amount: event.amount === null || event.amount === undefined ? null : Number(event.amount),
    previousEndsAt: nullableSafeInteger(event.previousEndsAt),
    nextEndsAt: nullableSafeInteger(event.nextEndsAt),
    metadata: event.metadata && typeof event.metadata === 'object' ? structuredClone(event.metadata) : {},
    createdAt: Math.max(0, nullableSafeInteger(event.createdAt) ?? Date.now()),
  });
}

function drainAuctionAuditEvents(world) {
  const events = Array.isArray(world?.[AUCTION_AUDIT_BUFFER]) ? world[AUCTION_AUDIT_BUFFER] : [];
  if (world && world[AUCTION_AUDIT_BUFFER]) delete world[AUCTION_AUDIT_BUFFER];
  return events;
}

export function configureAuctionAuditStore(store) {
  store.database.exec(`
    CREATE TABLE IF NOT EXISTS economy_asset_auction_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_key TEXT NOT NULL UNIQUE,
      auction_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_user_id INTEGER,
      amount_micros INTEGER,
      previous_ends_at INTEGER,
      next_ends_at INTEGER,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      revision_before INTEGER NOT NULL,
      revision_after INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_economy_asset_auction_events_auction
      ON economy_asset_auction_events(auction_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_economy_asset_auction_events_bid_history
      ON economy_asset_auction_events(auction_id, event_type, id DESC);
    CREATE TRIGGER IF NOT EXISTS economy_asset_auction_events_no_update
      BEFORE UPDATE ON economy_asset_auction_events
      BEGIN SELECT RAISE(ABORT, 'auction audit events are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS economy_asset_auction_events_no_delete
      BEFORE DELETE ON economy_asset_auction_events
      BEGIN SELECT RAISE(ABORT, 'auction audit events are append-only'); END;
  `);
  store.insertAuctionAuditEvent = store.database.prepare(`
    INSERT OR IGNORE INTO economy_asset_auction_events (
      source_key, auction_id, event_type, actor_user_id, amount_micros,
      previous_ends_at, next_ends_at, metadata_json,
      revision_before, revision_after, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  store.selectRecentAuctionBidEvents = store.database.prepare(`
    SELECT actor_user_id, amount_micros, metadata_json, created_at
    FROM economy_asset_auction_events
    WHERE auction_id = ? AND event_type = 'bid_placed'
    ORDER BY id DESC
    LIMIT ?
  `);
}

export function flushAuctionAuditEvents(store, world, revisionBefore, revisionAfter) {
  const events = drainAuctionAuditEvents(world);
  for (const event of events) {
    store.insertAuctionAuditEvent.run(
      event.sourceKey,
      event.auctionId,
      event.eventType,
      event.actorUserId,
      storedMoney(event.amount),
      event.previousEndsAt,
      event.nextEndsAt,
      JSON.stringify(event.metadata || {}),
      Number(revisionBefore),
      Number(revisionAfter),
      event.createdAt,
    );
  }
  return events.length;
}

export function listRecentAuctionBidEvents(store, auctionId, limit = BID_HISTORY_LIMIT) {
  const normalizedLimit = Math.min(BID_HISTORY_LIMIT, Math.max(1, Math.floor(Number(limit) || BID_HISTORY_LIMIT)));
  return store.selectRecentAuctionBidEvents.all(String(auctionId), normalizedLimit).map((row) => {
    let metadata = {};
    try { metadata = JSON.parse(String(row.metadata_json || '{}')); } catch { /* keep empty */ }
    return {
      actorUserId: nullableSafeInteger(row.actor_user_id),
      bidderLabel: String(metadata.bidderLabel || '竞买人'),
      amount: restoredMoney(row.amount_micros) || 0,
      createdAt: Number(row.created_at || 0),
    };
  });
}

export const AUCTION_BID_HISTORY_LIMIT = BID_HISTORY_LIMIT;
