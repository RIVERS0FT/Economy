import { createHash, randomBytes } from 'node:crypto';

export const MAX_GIFT_CODE_BATCH_SIZE = 50_000;

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

export function configureGiftCodeAdminStore(store) {
  store.listGiftCodesStatement = store.database.prepare(`
    SELECT id, reward_credits, max_redemptions, redeemed_count, starts_at, expires_at,
           enabled, created_by, created_at, note
    FROM economy_gift_codes ORDER BY id DESC
  `);
  store.listGiftRedemptionsStatement = store.database.prepare(`
    SELECT user_id, reward_credits, redeemed_at
    FROM economy_gift_redemptions WHERE gift_code_id = ?
    ORDER BY redeemed_at DESC
  `);
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
