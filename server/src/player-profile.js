import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const PLAYER_AVATAR_SIZE = 64;
export const PLAYER_AVATAR_MAX_BYTES = 8 * 1024;

function result(ok, message) {
  return { ok, message };
}

function readUint24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

export function webpDimensions(buffer) {
  if (
    !Buffer.isBuffer(buffer)
    || buffer.length < 20
    || buffer.toString('ascii', 0, 4) !== 'RIFF'
    || buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) return null;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const chunkEnd = dataOffset + chunkSize;
    if (chunkEnd > buffer.length) return null;

    if (type === 'VP8X' && chunkSize >= 10) {
      return {
        width: readUint24LE(buffer, dataOffset + 4) + 1,
        height: readUint24LE(buffer, dataOffset + 7) + 1,
      };
    }
    if (type === 'VP8L' && chunkSize >= 5 && buffer[dataOffset] === 0x2f) {
      const bits = buffer.readUInt32LE(dataOffset + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    if (
      type === 'VP8 '
      && chunkSize >= 10
      && buffer[dataOffset + 3] === 0x9d
      && buffer[dataOffset + 4] === 0x01
      && buffer[dataOffset + 5] === 0x2a
    ) {
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    offset = chunkEnd + (chunkSize % 2);
  }
  return null;
}

export function validatePlayerAvatarData(value) {
  const text = String(value || '');
  const prefix = 'data:image/webp;base64,';
  if (!text.startsWith(prefix)) {
    const error = new Error('头像必须是浏览器生成的 WebP 缩略图');
    error.statusCode = 400;
    throw error;
  }

  const encoded = text.slice(prefix.length);
  if (!encoded || encoded.length > Math.ceil(PLAYER_AVATAR_MAX_BYTES * 4 / 3) + 8) {
    const error = new Error('头像文件过大');
    error.statusCode = 413;
    throw error;
  }

  const buffer = Buffer.from(encoded, 'base64');
  const normalizedInput = encoded.replace(/=+$/, '');
  const normalizedOutput = buffer.toString('base64').replace(/=+$/, '');
  if (buffer.length <= 0 || normalizedInput !== normalizedOutput) {
    const error = new Error('头像 Base64 数据无效');
    error.statusCode = 400;
    throw error;
  }
  if (buffer.length > PLAYER_AVATAR_MAX_BYTES) {
    const error = new Error('头像文件不能超过 8 KiB');
    error.statusCode = 413;
    throw error;
  }

  const dimensions = webpDimensions(buffer);
  if (dimensions?.width !== PLAYER_AVATAR_SIZE || dimensions?.height !== PLAYER_AVATAR_SIZE) {
    const error = new Error('头像必须是 64×64 WebP 图片');
    error.statusCode = 400;
    throw error;
  }
  return buffer;
}

function avatarDirectory() {
  return resolve(
    process.env.ECONOMY_AVATAR_DIR
      || join(tmpdir(), 'riversoft-economy-avatars'),
  );
}

function writePlayerAvatar(userId, buffer) {
  const directory = avatarDirectory();
  mkdirSync(directory, { recursive: true, mode: 0o755 });
  const target = join(directory, `${Number(userId)}.webp`);
  const temporary = join(directory, `.${Number(userId)}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, buffer, { mode: 0o644 });
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function normalizePlayerName(value) {
  const name = String(value || '').trim();
  return name.length >= 1 && name.length <= 32 ? name : null;
}

export function applyPlayerProfileAction(world, user, payload = {}) {
  const userId = Number(user.id);
  const player = world.players?.[String(userId)];
  if (!player) return result(false, '玩家不存在');

  const hasPlayerName = Object.hasOwn(payload, 'playerName');
  const hasAvatar = Object.hasOwn(payload, 'avatarData');
  if (!hasPlayerName && !hasAvatar) return result(false, '玩家资料参数无效');

  const nextName = hasPlayerName ? normalizePlayerName(payload.playerName) : null;
  if (hasPlayerName && !nextName) return result(false, '昵称长度需为 1 到 32 个字符');
  const avatarBuffer = hasAvatar ? validatePlayerAvatarData(payload.avatarData) : null;

  if (hasPlayerName) {
    player.playerName = nextName;
    for (const order of world.orders || []) {
      if (order.ownerType === 'player' && Number(order.ownerId) === userId) {
        order.ownerName = nextName;
      }
    }
  }
  if (avatarBuffer) writePlayerAvatar(userId, avatarBuffer);

  if (hasPlayerName && hasAvatar) return result(true, '玩家资料和头像已更新');
  if (hasAvatar) return result(true, '玩家头像已更新');
  return result(true, '玩家昵称已更新');
}
