import { createHash, randomBytes } from 'node:crypto';

export const MAX_GIFT_CODE_BATCH_SIZE = 50_000;
export const DEFAULT_ADMIN_PAGE_SIZE = 100;
export const MAX_ADMIN_PAGE_SIZE = 200;

function normalizeGiftCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function hashGiftCode(value) {
  return createHash('sha256').update(normalizeGiftCode(value)).digest('hex');
}

function generateGiftCode() {
  const token = randomBytes(6).toString('hex').toUpperCase();
  return `RIVER-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}`;
}

function readGiftCodeSettings(payload, now) {
  const rewardCredits = Number(payload.rewardCredits);
  const maxRedemptions = Number(payload.maxRedemptions);
  const startsAt = payload.startsAt === undefined || payload.startsAt === null || payload.startsAt === ''
    ? now
    : Number(payload.startsAt);
  const expiresAt = payload.expiresAt === null || payload.expiresAt === undefined || payload.expiresAt === ''
    ? null
    : Number(payload.expiresAt);
  const note = String(payload.note || '').trim().slice(0, 240);

  if (!Number.isInteger(rewardCredits) || rewardCredits < 1 || rewardCredits > 1_000_000) {
    throw Object.assign(new Error('奖励金额无效'), { statusCode: 400 });
  }
  if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 1_000_000) {
    throw Object.assign(new Error('最大兑换次数无效'), { statusCode: 400 });
  }
  if (!Number.isFinite(startsAt) || (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= startsAt))) {
    throw Object.assign(new Error('礼品码有效期无效'), { statusCode: 400 });
  }

  return { rewardCredits, maxRedemptions, startsAt, expiresAt, note };
}

function pageSize(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_ADMIN_PAGE_SIZE;
  return Math.min(parsed, MAX_ADMIN_PAGE_SIZE);
}

function giftCodeCursor(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw Object.assign(new Error('礼品码分页游标无效'), { statusCode: 400 });
  }
  return parsed;
}

function redemptionCursor(value) {
  if (value === undefined || value === null || value === '') return null;
  const match = String(value).match(/^(\d+):(\d+)$/);
  if (!match) throw Object.assign(new Error('兑换记录分页游标无效'), { statusCode: 400 });
  return { redeemedAt: Number(match[1]), userId: Number(match[2]) };
}

export function configureGiftCodeAdminStore(store) {
  store.listGiftCodesPageStatement = store.database.prepare(`
    SELECT id, reward_credits, max_redemptions, redeemed_count, starts_at, expires_at,
           enabled, created_by, created_at, note
    FROM economy_gift_codes
    WHERE (? IS NULL OR id < ?)
    ORDER BY id DESC
    LIMIT ?
  `);
  store.countGiftCodesStatement = store.database.prepare(`
    SELECT COUNT(*) AS total FROM economy_gift_codes
  `);
  store.listGiftRedemptionsPageStatement = store.database.prepare(`
    SELECT user_id, reward_credits, redeemed_at
    FROM economy_gift_redemptions
    WHERE gift_code_id = ?
      AND (
        ? IS NULL
        OR redeemed_at < ?
        OR (redeemed_at = ? AND user_id < ?)
      )
    ORDER BY redeemed_at DESC, user_id DESC
    LIMIT ?
  `);
  store.countGiftRedemptionsStatement = store.database.prepare(`
    SELECT COUNT(*) AS total
    FROM economy_gift_redemptions
    WHERE gift_code_id = ?
  `);
}

export function listGiftCodePage(store, user, options = {}) {
  store.requireAdmin(user);
  const limit = pageSize(options.limit);
  const cursor = giftCodeCursor(options.cursor);
  const rows = store.listGiftCodesPageStatement.all(cursor, cursor, limit + 1);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => ({ ...row, enabled: Boolean(row.enabled) }));
  return {
    items,
    total: Number(store.countGiftCodesStatement.get().total || 0),
    nextCursor: hasMore && items.length > 0 ? String(items.at(-1).id) : null,
  };
}

export function listGiftRedemptionPage(store, user, giftCodeId, options = {}) {
  store.requireAdmin(user);
  const limit = pageSize(options.limit);
  const cursor = redemptionCursor(options.cursor);
  const rows = store.listGiftRedemptionsPageStatement.all(
    Number(giftCodeId),
    cursor?.redeemedAt ?? null,
    cursor?.redeemedAt ?? null,
    cursor?.redeemedAt ?? null,
    cursor?.userId ?? null,
    limit + 1,
  );
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    total: Number(store.countGiftRedemptionsStatement.get(Number(giftCodeId)).total || 0),
    nextCursor: hasMore && last ? `${Number(last.redeemed_at)}:${Number(last.user_id)}` : null,
  };
}

export function createGiftCodeBatch(store, user, payload, requestMeta, now = Date.now()) {
  return store.adminMutation(user, requestMeta, () => {
    const count = Number(payload.count);
    if (!Number.isInteger(count) || count < 1 || count > MAX_GIFT_CODE_BATCH_SIZE) {
      throw Object.assign(new Error(`生成数量必须为 1～${MAX_GIFT_CODE_BATCH_SIZE}`), { statusCode: 400 });
    }

    const settings = readGiftCodeSettings(payload, now);
    const codes = [];
    const generated = new Set();
    const attemptLimit = count * 2 + 100;
    let attempts = 0;

    while (codes.length < count && attempts < attemptLimit) {
      attempts += 1;
      const code = generateGiftCode();
      if (generated.has(code)) continue;
      generated.add(code);

      try {
        store.insertGiftCode.run(
          hashGiftCode(code),
          settings.rewardCredits,
          settings.maxRedemptions,
          settings.startsAt,
          settings.expiresAt,
          Number(user.id),
          now,
          settings.note,
        );
        codes.push(code);
      } catch (error) {
        if (String(error?.message || '').includes('UNIQUE')) continue;
        throw error;
      }
    }

    if (codes.length !== count) {
      throw Object.assign(new Error('无法生成足够数量的唯一礼品码，请重试'), { statusCode: 503 });
    }

    return {
      createdCount: codes.length,
      codes,
      ...settings,
    };
  }, now);
}
