import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const root = process.cwd();
const sourceDirectory = resolve(root, 'src/assets/product-icons');
const outputDirectory = resolve(sourceDirectory, 'generated/128');
const sourceSize = 1024;
const targetSize = 128;
const bytesPerPixel = 4;

const productIds = [
  'wheat',
  'rice',
  'cotton',
  'sugarcane',
  'fruit',
  'timber',
  'ore',
  'copper-ore',
  'crude-oil',
  'meat',
  'eggs',
  'milk',
  'fish',
  'wool',
  'flour',
  'sugar',
  'lumber',
  'steel',
  'copper',
  'plastic',
  'textile',
  'pulp',
  'food',
  'beverage',
  'prepared-meal',
  'paper',
  'furniture',
  'clothing',
  'machinery',
  'electronics',
  'appliance',
];

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = new Uint32Array(256);
for (let value = 0; value < crcTable.length; value += 1) {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  crcTable[value] = crc >>> 0;
}

function crc32(buffers) {
  let crc = 0xffffffff;
  for (const buffer of buffers) {
    for (const byte of buffer) {
      crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.allocUnsafe(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32([typeBuffer, data]), 8 + data.length);
  return chunk;
}

function parsePng(filePath) {
  const image = readFileSync(filePath);
  if (image.length < 33 || !image.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${filePath} 不是有效 PNG`);
  }

  let offset = 8;
  let header = null;
  const compressedParts = [];
  let reachedEnd = false;

  while (offset + 12 <= image.length) {
    const length = image.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > image.length) throw new Error(`${filePath} PNG 区块越界`);

    const typeBuffer = image.subarray(typeStart, dataStart);
    const type = typeBuffer.toString('ascii');
    const data = image.subarray(dataStart, dataEnd);
    const expectedCrc = image.readUInt32BE(dataEnd);
    const actualCrc = crc32([typeBuffer, data]);
    if (expectedCrc !== actualCrc) throw new Error(`${filePath} PNG ${type} 区块 CRC 无效`);

    if (type === 'IHDR') {
      if (length !== 13) throw new Error(`${filePath} PNG IHDR 长度无效`);
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compressionMethod: data[10],
        filterMethod: data[11],
        interlaceMethod: data[12],
      };
    } else if (type === 'IDAT') {
      compressedParts.push(data);
    } else if (type === 'IEND') {
      reachedEnd = true;
      break;
    }

    offset = chunkEnd;
  }

  if (!header || compressedParts.length === 0 || !reachedEnd) {
    throw new Error(`${filePath} PNG 结构不完整`);
  }
  if (header.width !== sourceSize || header.height !== sourceSize) {
    throw new Error(`${filePath} 必须为 ${sourceSize}×${sourceSize}`);
  }
  if (
    header.bitDepth !== 8
    || header.colorType !== 6
    || header.compressionMethod !== 0
    || header.filterMethod !== 0
    || header.interlaceMethod !== 0
  ) {
    throw new Error(`${filePath} 必须为 8-bit、RGBA、非隔行 PNG`);
  }

  const rowBytes = header.width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(compressedParts));
  const expectedLength = (rowBytes + 1) * header.height;
  if (inflated.length !== expectedLength) {
    throw new Error(`${filePath} PNG 解压长度无效`);
  }

  const pixels = Buffer.allocUnsafe(rowBytes * header.height);
  let inputOffset = 0;
  let outputOffset = 0;

  for (let y = 0; y < header.height; y += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;

    for (let byteIndex = 0; byteIndex < rowBytes; byteIndex += 1) {
      const encoded = inflated[inputOffset + byteIndex];
      const left = byteIndex >= bytesPerPixel ? pixels[outputOffset + byteIndex - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[outputOffset - rowBytes + byteIndex] : 0;
      const upperLeft = y > 0 && byteIndex >= bytesPerPixel
        ? pixels[outputOffset - rowBytes + byteIndex - bytesPerPixel]
        : 0;

      let predictor = 0;
      if (filterType === 1) {
        predictor = left;
      } else if (filterType === 2) {
        predictor = up;
      } else if (filterType === 3) {
        predictor = Math.floor((left + up) / 2);
      } else if (filterType === 4) {
        const estimate = left + up - upperLeft;
        const leftDistance = Math.abs(estimate - left);
        const upDistance = Math.abs(estimate - up);
        const upperLeftDistance = Math.abs(estimate - upperLeft);
        predictor = leftDistance <= upDistance && leftDistance <= upperLeftDistance
          ? left
          : upDistance <= upperLeftDistance
            ? up
            : upperLeft;
      } else if (filterType !== 0) {
        throw new Error(`${filePath} 使用不支持的 PNG 过滤器 ${filterType}`);
      }

      pixels[outputOffset + byteIndex] = (encoded + predictor) & 0xff;
    }

    inputOffset += rowBytes;
    outputOffset += rowBytes;
  }

  return { width: header.width, height: header.height, pixels };
}

function downsampleWithPremultipliedAlpha({ width, height, pixels }) {
  if (width % targetSize !== 0 || height % targetSize !== 0) {
    throw new Error(`源图片尺寸必须能整除 ${targetSize}`);
  }

  const scaleX = width / targetSize;
  const scaleY = height / targetSize;
  const sampleCount = scaleX * scaleY;
  const output = Buffer.alloc(targetSize * targetSize * bytesPerPixel);

  for (let targetY = 0; targetY < targetSize; targetY += 1) {
    for (let targetX = 0; targetX < targetSize; targetX += 1) {
      let alphaSum = 0;
      let redAlphaSum = 0;
      let greenAlphaSum = 0;
      let blueAlphaSum = 0;

      for (let offsetY = 0; offsetY < scaleY; offsetY += 1) {
        const sourceY = targetY * scaleY + offsetY;
        for (let offsetX = 0; offsetX < scaleX; offsetX += 1) {
          const sourceX = targetX * scaleX + offsetX;
          const sourceIndex = (sourceY * width + sourceX) * bytesPerPixel;
          const alpha = pixels[sourceIndex + 3];
          alphaSum += alpha;
          redAlphaSum += pixels[sourceIndex] * alpha;
          greenAlphaSum += pixels[sourceIndex + 1] * alpha;
          blueAlphaSum += pixels[sourceIndex + 2] * alpha;
        }
      }

      const targetIndex = (targetY * targetSize + targetX) * bytesPerPixel;
      output[targetIndex + 3] = Math.round(alphaSum / sampleCount);
      if (alphaSum > 0) {
        output[targetIndex] = Math.round(redAlphaSum / alphaSum);
        output[targetIndex + 1] = Math.round(greenAlphaSum / alphaSum);
        output[targetIndex + 2] = Math.round(blueAlphaSum / alphaSum);
      } else {
        output[targetIndex] = 0;
        output[targetIndex + 1] = 0;
        output[targetIndex + 2] = 0;
      }
    }
  }

  return output;
}

function encodePng(pixels) {
  const rowBytes = targetSize * bytesPerPixel;
  const scanlines = Buffer.alloc((rowBytes + 1) * targetSize);

  for (let y = 0; y < targetSize; y += 1) {
    const scanlineOffset = y * (rowBytes + 1);
    scanlines[scanlineOffset] = 0;
    pixels.copy(scanlines, scanlineOffset + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(targetSize, 0);
  header.writeUInt32BE(targetSize, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    pngSignature,
    createChunk('IHDR', header),
    createChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outputDirectory, { recursive: true });
const expectedFiles = new Set(productIds.map((productId) => `${productId}.png`));
for (const entry of readdirSync(outputDirectory, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.png') && !expectedFiles.has(entry.name)) {
    rmSync(join(outputDirectory, entry.name));
  }
}

let changedCount = 0;
let totalBytes = 0;
for (const productId of productIds) {
  const sourcePath = join(sourceDirectory, `${productId}.png`);
  const outputPath = join(outputDirectory, `${productId}.png`);
  const thumbnail = encodePng(downsampleWithPremultipliedAlpha(parsePng(sourcePath)));
  totalBytes += thumbnail.length;

  if (!existsSync(outputPath) || !readFileSync(outputPath).equals(thumbnail)) {
    writeFileSync(outputPath, thumbnail);
    changedCount += 1;
  }
}

console.log(
  `商品运行时缩略图生成完成：${productIds.length} 种 ${targetSize}×${targetSize} RGBA PNG，`
  + `总计 ${(totalBytes / 1024).toFixed(1)} KiB，更新 ${changedCount} 个文件。`,
);
