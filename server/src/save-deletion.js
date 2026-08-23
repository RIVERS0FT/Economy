import { ensurePlayer } from './domain.js';
import { applyFacilityGroupAction, migrateFacilityGroupWorld } from './facility-groups.js';
import { applyAssetAuctionAction } from './asset-auctions.js';
import { applyProductionContractAction } from './contracts.js';
import {
  activeLoanLiability,
  ensureBankWorld,
  ensurePlayerBankAccount,
} from './banking.js';
import {
  ensurePlayerWeeklyCashSettlement,
  ensureWeeklyCashSettlementWorld,
  settlePlayerWeeklyCashOnLogin,
  weeklySettlementLiability,
} from './weekly-cash-settlement.js';
import { ensureWarehouse } from './warehouse.js';
import { ensureGemState } from './invitations.js';
import { migrateResearchWorld } from './research.js';

export const SAVE_DELETION_CONFIRMATION = '删除存档';

const statementsByStore = new WeakMap();
const PARTICIPANT_ID_FIELDS = Object.freeze([
  'publisherId',
  'buyerId',
  'supplierId',
  'borrowerId',
  'lenderId',
  'lessorId',
  'lesseeId',
]);

function httpError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

function safeNonNegativeInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function setupStatements(store) {
  const cached = statementsByStore.get(store);
  if (cached) return cached;
  store.database.exec(`
    CREATE TABLE IF NOT EXISTS economy_save_deletions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      save_epoch_before INTEGER NOT NULL CHECK (save_epoch_before >= 0),
      save_epoch_after INTEGER NOT NULL CHECK (save_epoch_after > save_epoch_before),
      deleted_at INTEGER NOT NULL,
      request_key TEXT NOT NULL UNIQUE,
      asset_summary_json TEXT NOT NULL,
      auto_closed_json TEXT NOT NULL
    ) STRICT;
  `);
  const tableDefinition = store.database.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'economy_save_deletions'
  `).get();
  if (String(tableDefinition?.sql || '').includes('user_id INTEGER NOT NULL UNIQUE')) {
    store.database.exec(`
      DROP TABLE IF EXISTS economy_save_deletions_repeatable;
      CREATE TABLE economy_save_deletions_repeatable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        save_epoch_before INTEGER NOT NULL CHECK (save_epoch_before >= 0),
        save_epoch_after INTEGER NOT NULL CHECK (save_epoch_after > save_epoch_before),
        deleted_at INTEGER NOT NULL,
        request_key TEXT NOT NULL UNIQUE,
        asset_summary_json TEXT NOT NULL,
        auto_closed_json TEXT NOT NULL
      ) STRICT;
      INSERT INTO economy_save_deletions_repeatable (
        id, user_id, save_epoch_before, save_epoch_after, deleted_at,
        request_key, asset_summary_json, auto_closed_json
      )
      SELECT
        id, user_id, save_epoch_before, save_epoch_after, deleted_at,
        request_key, asset_summary_json, auto_closed_json
      FROM economy_save_deletions
      ORDER BY id;
      DROP TABLE economy_save_deletions;
      ALTER TABLE economy_save_deletions_repeatable RENAME TO economy_save_deletions;
    `);
  }
  store.database.exec(`
    CREATE INDEX IF NOT EXISTS idx_economy_save_deletions_deleted
      ON economy_save_deletions(deleted_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_economy_save_deletions_user_deleted
      ON economy_save_deletions(user_id, deleted_at DESC, id DESC);
    CREATE TABLE IF NOT EXISTS economy_tutorial_completions (
      user_id INTEGER PRIMARY KEY,
      completed_version INTEGER NOT NULL CHECK (completed_version >= 0),
      completed_at INTEGER NOT NULL
    ) STRICT;
  `);
  const statements = {
    insertDeletion: store.database.prepare(`
      INSERT INTO economy_save_deletions (
        user_id, save_epoch_before, save_epoch_after, deleted_at,
        request_key, asset_summary_json, auto_closed_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    deleteTutorialCompletion: store.database.prepare(
      'DELETE FROM economy_tutorial_completions WHERE user_id = ?',
    ),
  };
  statementsByStore.set(store, statements);
  return statements;
}

function isOpenOrder(order) {
  return Number(order?.remaining || 0) > 0
    && (order?.status === 'open' || order?.status === 'partial');
}

function isOpenAuction(auction) {
  return auction?.status === 'open';
}

function contractInvolvesUser(contract, userId) {
  return PARTICIPANT_ID_FIELDS.some((field) => Number(contract?.[field]) === Number(userId));
}

function blocker(type, message, targetTab) {
  return { type, message, targetTab };
}

function currentPlayer(store, user, now) {
  const cached = store.worldCache?.world?.players?.[String(user.id)];
  if (cached) return cached;
  return store.transaction(() => {
    const { world } = store.loadWorld(now);
    return ensurePlayer(world, user, now);
  }, { immediate: false });
}

export function getPlayerSaveCreatedAt(store, userId) {
  const player = store.worldCache?.world?.players?.[String(userId)];
  return safeNonNegativeInteger(player?.saveCreatedAt);
}

function assertExpectedSaveEpoch(actualValue, rawExpectedEpoch) {
  const actual = safeNonNegativeInteger(actualValue);
  if (rawExpectedEpoch === undefined || rawExpectedEpoch === null || rawExpectedEpoch === '') {
    if (actual === 0) return;
    throw httpError(
      '当前页面缺少新存档世代，请刷新后继续操作',
      409,
      'SAVE_EPOCH_MISMATCH',
    );
  }
  if (!/^\d+$/.test(String(rawExpectedEpoch))) {
    throw httpError('存档世代请求头无效', 400, 'INVALID_SAVE_EPOCH');
  }
  const expected = Number(rawExpectedEpoch);
  if (expected !== actual) {
    throw httpError(
      '当前页面使用的是旧存档，请刷新后继续操作',
      409,
      'SAVE_EPOCH_MISMATCH',
    );
  }
}

export function assertPlayerSaveEpoch(store, user, rawExpectedEpoch, now = Date.now()) {
  assertExpectedSaveEpoch(currentPlayer(store, user, now)?.saveEpoch, rawExpectedEpoch);
}

function preparePlayerSystems(world, player, now) {
  ensureWarehouse(player);
  ensureGemState(player);
  ensureBankWorld(world, now);
  ensurePlayerBankAccount(player, now);
  ensureWeeklyCashSettlementWorld(world, now);
  ensurePlayerWeeklyCashSettlement(player, now);
}

function analyzeDeletion(store, world, player, userId, now) {
  setupStatements(store);
  const blockers = [];
  const autoClose = {
    orders: 0,
    facilityListings: 0,
    auctions: 0,
    contracts: 0,
  };

  if (activeLoanLiability(player) > 0) {
    blockers.push(blocker(
      'active_bank_loan',
      '存在未结清的银行贷款，请先完成还款',
      'bank',
    ));
  }

  if (weeklySettlementLiability(player) > 0) {
    blockers.push(blocker(
      'weekly_cash_settlement',
      '存在未完成的周资金结算，请先完成结算',
      'bank',
    ));
  }

  for (const order of world.orders || []) {
    if (Number(order?.ownerId) === Number(userId) && isOpenOrder(order)) autoClose.orders += 1;
  }

  for (const listing of world.facilityListings || []) {
    if (Number(listing?.ownerId) === Number(userId)) autoClose.facilityListings += 1;
  }

  for (const auction of world.assetAuctions || []) {
    if (!isOpenAuction(auction)) continue;
    const isSeller = Number(auction?.sellerId) === Number(userId);
    const isHighestBidder = Number(auction?.highestBidderId) === Number(userId);
    if (isSeller) {
      if (auction.highestBidderId || Number(auction.bidCount || 0) > 0) {
        blockers.push(blocker(
          'auction_with_bid',
          `拍卖 ${String(auction.id)} 已有有效出价，不能删除存档`,
          'auction',
        ));
      } else {
        autoClose.auctions += 1;
      }
    } else if (isHighestBidder) {
      blockers.push(blocker(
        'auction_highest_bid',
        `你是拍卖 ${String(auction.id)} 的当前最高出价者`,
        'auction',
      ));
    }
  }

  for (const contract of world.productionContracts || []) {
    if (contract?.status === 'active' && contractInvolvesUser(contract, userId)) {
      blockers.push(blocker(
        'active_contract',
        `合同 ${String(contract.id)} 正在履约，请先结束合同`,
        'contracts',
      ));
      continue;
    }
    if (contract?.status === 'open' && Number(contract?.publisherId) === Number(userId)) {
      autoClose.contracts += 1;
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    autoClose,
    saveEpoch: safeNonNegativeInteger(player.saveEpoch),
    checkedAt: now,
  };
}

function loadPreparedWorld(store, user, now, expectedSaveEpoch, validateSaveEpoch = false) {
  const loaded = store.loadWorld(now);
  const player = ensurePlayer(loaded.world, user, now);
  if (validateSaveEpoch) assertExpectedSaveEpoch(player.saveEpoch, expectedSaveEpoch);
  preparePlayerSystems(loaded.world, player, now);
  store.processWorldIfDue(loaded.world, now, Number(user.id), {
    force: true,
    auditTrigger: 'save_deletion_preflight',
  });
  settlePlayerWeeklyCashOnLogin(loaded.world, player, now);
  return { ...loaded, player };
}

export function getPlayerSaveDeletionPreflight(store, user, now = Date.now()) {
  return store.transaction(() => {
    const { revision, stateJson, world, player } = loadPreparedWorld(store, user, now);
    const nextRevision = store.saveWorldIfChanged(revision, world, now, stateJson);
    return {
      ...analyzeDeletion(store, world, player, user.id, now),
      revision: nextRevision,
    };
  });
}

function requireSuccessful(result, description) {
  if (result?.ok) return;
  throw httpError(
    `${description}失败：${String(result?.message || '服务器拒绝操作')}`,
    409,
    'SAVE_DELETION_CLEANUP_FAILED',
  );
}

function closeOwnedResources(world, user, preflight, now) {
  for (const order of [...(world.orders || [])]) {
    if (Number(order?.ownerId) !== Number(user.id) || !isOpenOrder(order)) continue;
    requireSuccessful(
      applyFacilityGroupAction(world, user, 'cancelOrder', { orderId: order.id }, now),
      `取消订单 ${String(order.id)}`,
    );
  }

  for (const listing of [...(world.facilityListings || [])]) {
    if (Number(listing?.ownerId) !== Number(user.id)) continue;
    requireSuccessful(
      applyFacilityGroupAction(
        world,
        user,
        'cancelFacilityListing',
        { listingId: listing.id },
        now,
      ),
      `取消工厂挂牌 ${String(listing.id)}`,
    );
  }

  for (const auction of [...(world.assetAuctions || [])]) {
    if (
      !isOpenAuction(auction)
      || Number(auction?.sellerId) !== Number(user.id)
      || auction.highestBidderId
      || Number(auction.bidCount || 0) > 0
    ) continue;
    requireSuccessful(
      applyAssetAuctionAction(
        world,
        user,
        'cancelAuction',
        { auctionId: auction.id },
        now,
      ),
      `取消拍卖 ${String(auction.id)}`,
    );
  }

  for (const contract of [...(world.productionContracts || [])]) {
    if (contract?.status !== 'open' || Number(contract?.publisherId) !== Number(user.id)) continue;
    requireSuccessful(
      applyProductionContractAction(
        world,
        user,
        'cancelProductionContract',
        { contractId: contract.id },
        now,
      ),
      `取消合同 ${String(contract.id)}`,
    );
  }

  return { ...preflight.autoClose };
}

function inventoryQuantity(player) {
  return Object.values(player?.inventories || {}).reduce((sum, inventory) => (
    sum
      + Math.max(0, Number(inventory?.available || 0))
      + Math.max(0, Number(inventory?.frozen || 0))
  ), 0);
}

function facilityQuantity(player) {
  return (player?.facilityGroups || []).reduce(
    (sum, group) => sum + Math.max(0, Number(group?.count || 0)),
    0,
  );
}

function assetSummary(player) {
  return {
    credits: Math.max(0, Number(player?.credits || 0)),
    frozenCredits: Math.max(0, Number(player?.frozenCredits || 0)),
    bankDepositCredits: Math.max(0, Number(player?.bankAccount?.depositCredits || 0)),
    inventoryQuantity: inventoryQuantity(player),
    facilityQuantity: facilityQuantity(player),
    gemsPreserved: safeNonNegativeInteger(player?.gems),
  };
}

function permanentGemStats(player) {
  return Object.fromEntries(Object.entries(player?.stats || {}).filter(([key, value]) => (
    key.endsWith('GemsIssued')
      && Number.isFinite(Number(value))
      && Number(value) >= 0
  )));
}

function rebuildPlayer(world, user, previous, now) {
  const registeredAt = Math.max(0, Number(previous.registeredAt || now));
  const gems = safeNonNegativeInteger(previous.gems);
  const gemStats = permanentGemStats(previous);
  const saveEpochBefore = safeNonNegativeInteger(previous.saveEpoch);
  const saveEpochAfter = saveEpochBefore + 1;

  delete world.players[String(user.id)];
  const player = ensurePlayer(world, user, now);
  player.registeredAt = registeredAt;
  player.gems = gems;
  player.saveEpoch = saveEpochAfter;
  player.saveCreatedAt = now;
  player.saveResetCount = safeNonNegativeInteger(previous.saveResetCount) + 1;
  Object.assign(player.stats, gemStats);

  ensureWarehouse(player);
  ensureGemState(player);
  ensureBankWorld(world, now);
  ensurePlayerBankAccount(player, now);
  ensureWeeklyCashSettlementWorld(world, now);
  ensurePlayerWeeklyCashSettlement(player, now);
  migrateFacilityGroupWorld(world, now);
  migrateResearchWorld(world, now);

  world.orders = (world.orders || []).filter(
    (order) => Number(order?.ownerId) !== Number(user.id),
  );
  world.facilityListings = (world.facilityListings || []).filter(
    (listing) => Number(listing?.ownerId) !== Number(user.id),
  );

  return { player, saveEpochBefore, saveEpochAfter };
}

export function deletePlayerSave(
  store,
  user,
  {
    confirmation,
    requestKey,
    expectedSaveEpoch,
    method = 'POST',
    path = '/api/game/save-deletion',
  },
  now = Date.now(),
) {
  if (String(confirmation || '') !== SAVE_DELETION_CONFIRMATION) {
    throw httpError(
      `请输入“${SAVE_DELETION_CONFIRMATION}”确认操作`,
      400,
      'SAVE_DELETION_CONFIRMATION_REQUIRED',
    );
  }

  const statements = setupStatements(store);
  return store.transaction(() => {
    const cached = store.selectIdempotency.get(Number(user.id), String(requestKey));
    if (cached) {
      if (cached.request_method !== method || cached.request_path !== path) {
        throw httpError('幂等键已被其他操作使用', 409, 'IDEMPOTENCY_KEY_CONFLICT');
      }
      return JSON.parse(String(cached.response_json));
    }

    const { revision, world, player } = loadPreparedWorld(store, user, now, expectedSaveEpoch, true);
    const preflight = analyzeDeletion(store, world, player, user.id, now);
    if (!preflight.allowed) {
      throw httpError(
        preflight.blockers.map((entry) => entry.message).join('；'),
        409,
        'SAVE_DELETION_BLOCKED',
      );
    }

    const beforeAssets = assetSummary(player);
    const autoClosed = closeOwnedResources(world, user, preflight, now);
    const afterCleanup = analyzeDeletion(store, world, player, user.id, now);
    if (!afterCleanup.allowed) {
      throw httpError(
        afterCleanup.blockers.map((entry) => entry.message).join('；'),
        409,
        'SAVE_DELETION_BLOCKED',
      );
    }

    const { saveEpochBefore, saveEpochAfter } = rebuildPlayer(world, user, player, now);
    statements.deleteTutorialCompletion.run(Number(user.id));
    const nextRevision = store.saveWorld(revision, world, now);
    statements.insertDeletion.run(
      Number(user.id),
      saveEpochBefore,
      saveEpochAfter,
      now,
      String(requestKey),
      JSON.stringify(beforeAssets),
      JSON.stringify(autoClosed),
    );

    const response = {
      result: {
        ok: true,
        message: '存档已删除，已恢复为新玩家初始状态',
      },
      revision: nextRevision,
      saveEpoch: saveEpochAfter,
    };
    store.insertIdempotency.run(
      Number(user.id),
      String(requestKey),
      method,
      path,
      JSON.stringify(response),
      now,
    );
    store.cleanupExpiredIdempotency(now);
    return response;
  });
}
