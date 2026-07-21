export const CURRENT_TUTORIAL_VERSION = 1;

const MIGRATION_SETTING_KEY = 'game_tutorial_completion_migration_version';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeVersion(value) {
  const version = Math.floor(Number(value));
  return Number.isInteger(version) && version >= 0 ? version : 0;
}

function normalizeStatus(row) {
  const status = {
    completedVersion: normalizeVersion(row?.completed_version),
  };
  if (row?.completed_at !== null && row?.completed_at !== undefined) {
    status.completedAt = Number(row.completed_at);
  }
  return status;
}

function completionResponse(tutorial) {
  return {
    result: { ok: true, message: '基础教程已完成' },
    tutorial,
  };
}

export function createTutorialStore(store, now = Date.now()) {
  const { database } = store;
  database.exec(`
    CREATE TABLE IF NOT EXISTS economy_tutorial_completions (
      user_id INTEGER PRIMARY KEY,
      completed_version INTEGER NOT NULL CHECK (completed_version >= 0),
      completed_at INTEGER NOT NULL
    ) STRICT;
  `);

  const selectStatus = database.prepare(`
    SELECT completed_version, completed_at
    FROM economy_tutorial_completions
    WHERE user_id = ?
  `);
  const upsertStatus = database.prepare(`
    INSERT INTO economy_tutorial_completions (user_id, completed_version, completed_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      completed_version = MAX(economy_tutorial_completions.completed_version, excluded.completed_version),
      completed_at = CASE
        WHEN excluded.completed_version > economy_tutorial_completions.completed_version
          THEN excluded.completed_at
        ELSE economy_tutorial_completions.completed_at
      END
  `);
  const selectMigration = database.prepare(`
    SELECT setting_value
    FROM economy_settings
    WHERE setting_key = ?
  `);
  const upsertMigration = database.prepare(`
    INSERT INTO economy_settings (setting_key, setting_value, updated_at, updated_by)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = excluded.updated_at,
      updated_by = 0
  `);
  const selectIdempotency = database.prepare(`
    SELECT request_method, request_path, response_json
    FROM economy_idempotency
    WHERE user_id = ? AND request_key = ?
  `);
  const insertIdempotency = database.prepare(`
    INSERT INTO economy_idempotency (
      user_id, request_key, request_method, request_path, response_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const deleteExpiredIdempotency = database.prepare(
    'DELETE FROM economy_idempotency WHERE created_at < ?',
  );

  store.transaction(() => {
    const migrationVersion = normalizeVersion(
      selectMigration.get(MIGRATION_SETTING_KEY)?.setting_value,
    );
    if (migrationVersion >= CURRENT_TUTORIAL_VERSION) return;

    const { world } = store.loadWorld(now);
    for (const player of Object.values(world.players || {})) {
      const userId = Number(player?.userId);
      if (!Number.isInteger(userId) || userId <= 0) continue;
      upsertStatus.run(userId, CURRENT_TUTORIAL_VERSION, now);
    }
    upsertMigration.run(
      MIGRATION_SETTING_KEY,
      String(CURRENT_TUTORIAL_VERSION),
      now,
    );
  });

  function getStatus(userId) {
    return normalizeStatus(selectStatus.get(Number(userId)));
  }

  function complete(userId, requestedVersion, requestContext = {}) {
    const normalizedUserId = Number(userId);
    const version = normalizeVersion(requestedVersion);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      const error = new Error('玩家账号无效');
      error.statusCode = 400;
      throw error;
    }
    if (version !== CURRENT_TUTORIAL_VERSION) {
      const error = new Error('教程版本无效');
      error.statusCode = 400;
      throw error;
    }

    const requestKey = String(requestContext.requestKey || '');
    const method = String(requestContext.method || 'POST');
    const path = String(requestContext.path || '/api/game/tutorial/complete');
    const completedAt = Number(requestContext.now || Date.now());
    const cached = selectIdempotency.get(normalizedUserId, requestKey);
    if (cached) {
      if (cached.request_method !== method || cached.request_path !== path) {
        const error = new Error('幂等键已被其他操作使用');
        error.statusCode = 409;
        throw error;
      }
      return JSON.parse(String(cached.response_json));
    }

    const existing = getStatus(normalizedUserId);
    if (existing.completedVersion >= version) return completionResponse(existing);

    return store.transaction(() => {
      upsertStatus.run(normalizedUserId, version, completedAt);
      const response = completionResponse(getStatus(normalizedUserId));
      insertIdempotency.run(
        normalizedUserId,
        requestKey,
        method,
        path,
        JSON.stringify(response),
        completedAt,
      );
      deleteExpiredIdempotency.run(completedAt - IDEMPOTENCY_TTL_MS);
      return response;
    });
  }

  return { getStatus, complete };
}
