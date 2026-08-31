import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  applyPlayerProfileAction,
  PLAYER_AVATAR_MAX_BYTES,
  validatePlayerAvatarData,
  webpDimensions,
} from '../src/player-profile.js';

function vp8xWebp(width = 64, height = 64) {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8X', 12, 'ascii');
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

function dataUrl(buffer) {
  return `data:image/webp;base64,${buffer.toString('base64')}`;
}

test('player avatar validator only accepts a small 64px WebP thumbnail', () => {
  const avatar = vp8xWebp();
  assert.deepEqual(webpDimensions(avatar), { width: 64, height: 64 });
  assert.deepEqual(validatePlayerAvatarData(dataUrl(avatar)), avatar);
  assert.throws(
    () => validatePlayerAvatarData(dataUrl(vp8xWebp(32, 64))),
    /64×64/,
  );
  const oversized = Buffer.concat([avatar, Buffer.alloc(PLAYER_AVATAR_MAX_BYTES + 1)]);
  assert.throws(() => validatePlayerAvatarData(dataUrl(oversized)), /过大|8 KiB/);
});

test('profile action atomically replaces the stored thumbnail without mutating related business entities', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-avatar-test-'));
  const previousDirectory = process.env.ECONOMY_AVATAR_DIR;
  process.env.ECONOMY_AVATAR_DIR = directory;
  try {
    const world = {
      players: {
        7: { userId: 7, playerName: '旧玩家' },
      },
      orders: [
        { ownerType: 'player', ownerId: 7 },
        { ownerType: 'population', ownerId: 7, ownerName: '居民' },
      ],
    };
    const beforeOrders = structuredClone(world.orders);
    const avatar = vp8xWebp();
    const response = applyPlayerProfileAction(
      world,
      { id: 7 },
      { playerName: '新玩家', avatarData: dataUrl(avatar) },
    );

    assert.equal(response.ok, true);
    assert.equal(world.players[7].playerName, '新玩家');
    assert.deepEqual(world.orders, beforeOrders);
    assert.deepEqual(readFileSync(join(directory, '7.webp')), avatar);
  } finally {
    if (previousDirectory === undefined) delete process.env.ECONOMY_AVATAR_DIR;
    else process.env.ECONOMY_AVATAR_DIR = previousDirectory;
    rmSync(directory, { recursive: true, force: true });
  }
});
