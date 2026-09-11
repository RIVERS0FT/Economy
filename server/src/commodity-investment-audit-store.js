import { cashEconomyError } from './cash-economy-money.js';

const statementsByStore = new WeakMap();
function statements(store) {
  const cached = statementsByStore.get(store);
  if (cached) return cached;
  store.database.exec(`
    CREATE TABLE IF NOT EXISTS economy_investment_ledger (
      user_id INTEGER NOT NULL,
      save_epoch INTEGER NOT NULL,
      sequence INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      processed_at INTEGER NOT NULL,
      revision_before INTEGER NOT NULL,
      revision_after INTEGER NOT NULL,
      transaction_json TEXT NOT NULL,
      PRIMARY KEY (user_id, save_epoch, sequence)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_economy_investment_ledger_time
      ON economy_investment_ledger(processed_at, user_id, sequence);
  `);
  const value = {
    read: store.database.prepare('SELECT transaction_json FROM economy_investment_ledger WHERE user_id = ? AND save_epoch = ? AND sequence = ?'),
    insert: store.database.prepare('INSERT INTO economy_investment_ledger VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  };
  statementsByStore.set(store, value);
  return value;
}

/** Append within the same SQLite transaction as the world save; never truncate on player save deletion. */
export function flushCommodityInvestmentAudit(store, world, scope, revisionBefore, revisionAfter) {
  const players = scope?.allPlayers === false ? [...scope.playerIds].map((id) => world.players[id]).filter(Boolean)
    : Object.values(world.players ?? {});
  for (const player of players) {
    if (!player.commodityInvestmentAccount) continue;
    const sql = statements(store);
    for (const record of player.commodityInvestmentAccount.recentTransactions) {
      const match = /^commodity-investment-([1-9][0-9]*)$/.exec(record.id);
      const sequence = match ? Number(match[1]) : NaN;
      if (!Number.isSafeInteger(sequence) || sequence > player.commodityInvestmentAccount.sequence) {
        throw cashEconomyError('INVESTMENT_AUDIT_INVALID', '投资流水身份无效');
      }
      const epoch = Number(player.saveEpoch ?? 0);
      const json = JSON.stringify(record);
      const old = sql.read.get(player.userId, epoch, sequence);
      if (old) {
        if (old.transaction_json !== json) throw cashEconomyError('INVESTMENT_AUDIT_CONFLICT', '已提交投资流水不能被改写');
        continue;
      }
      sql.insert.run(player.userId, epoch, sequence, record.createdAt, record.processedAt,
        revisionBefore, revisionAfter, json);
    }
  }
}
