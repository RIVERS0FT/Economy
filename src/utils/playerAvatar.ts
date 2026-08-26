export const PLAYER_AVATAR_SIZE = 64;
export const PLAYER_AVATAR_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const PLAYER_AVATAR_MAX_UPLOAD_BYTES = 8 * 1024;
export const PLAYER_AVATAR_UPDATED_EVENT = 'economy-player-avatar-updated';

export interface PlayerAvatarUpdatedDetail {
  userId: number;
}

const ACCEPTED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const WEBP_QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42];

export function playerAvatarUrl(userId: number) {
  const normalized = Math.max(1, Math.floor(Number(userId) || 0));
  return `/economy-avatars/${normalized}.webp`;
}

export function announcePlayerAvatarUpdated(userId: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PlayerAvatarUpdatedDetail>(PLAYER_AVATAR_UPDATED_EVENT, {
    detail: { userId: Number(userId) },
  }));
}

function loadSourceImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('无法读取头像图片'));
    };
    image.src = url;
  });
}

function encodeWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/webp') {
        reject(new Error('当前浏览器无法生成 WebP 头像'));
        return;
      }
      resolve(blob);
    }, 'image/webp', quality);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('无法读取压缩后的头像'));
    reader.readAsDataURL(blob);
  });
}

export async function preparePlayerAvatar(file: File) {
  if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
    throw new Error('头像只支持 JPEG、PNG 或 WebP 图片');
  }
  if (file.size <= 0 || file.size > PLAYER_AVATAR_MAX_SOURCE_BYTES) {
    throw new Error('头像原图不能超过 12 MiB');
  }

  const image = await loadSourceImage(file);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('头像图片尺寸无效');

  const canvas = document.createElement('canvas');
  canvas.width = PLAYER_AVATAR_SIZE;
  canvas.height = PLAYER_AVATAR_SIZE;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('当前浏览器无法处理头像图片');

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    PLAYER_AVATAR_SIZE,
    PLAYER_AVATAR_SIZE,
  );

  let encoded: Blob | null = null;
  for (const quality of WEBP_QUALITY_STEPS) {
    const candidate = await encodeWebp(canvas, quality);
    if (candidate.size <= PLAYER_AVATAR_MAX_UPLOAD_BYTES) {
      encoded = candidate;
      break;
    }
  }
  if (!encoded) throw new Error('头像压缩后仍超过 8 KiB，请选择更简单的图片');

  const dataUrl = await blobToDataUrl(encoded);
  if (!dataUrl.startsWith('data:image/webp;base64,')) {
    throw new Error('头像编码结果无效');
  }
  return dataUrl;
}
