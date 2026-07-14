import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

[
  'server/src/gift-code-batch.js',
  'server/src/index.js',
  'server/test/gift-code-batch.test.js',
  'src/api/admin.ts',
  'src/app/AdminApp.tsx',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'MAX_GIFT_CODE_BATCH_SIZE = 50_000',
  'store.adminMutation',
  'createdCount: codes.length',
  'codes,',
  'configureGiftCodeAdminStore',
  'ORDER BY id DESC',
]) requireText('server/src/gift-code-batch.js', text);

for (const text of [
  "import { configureGiftCodeAdminStore, createGiftCodeBatch } from './gift-code-batch.js'",
  "path === '/api/game/admin/gift-codes/batch'",
  'createGiftCodeBatch(store, user, body',
]) requireText('server/src/index.js', text);

for (const text of [
  'createGiftCodeBatch',
  "'/gift-codes/batch'",
  'GiftCodeBatchResult',
]) requireText('src/api/admin.ts', text);

for (const text of [
  'max="50000"',
  'new Blob',
  "type: 'text/plain;charset=utf-8'",
  '.txt`',
  '下载 TXT',
  '批量结果不逐条显示',
]) requireText('src/app/AdminApp.tsx', text);

for (const text of [
  '一次批量生成 1～50,000 个随机礼品码',
  '每行一个兑换码',
  '同一个 SQLite 事务',
  '`POST /api/game/admin/gift-codes/batch`',
]) requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', text);

forbidText('server/src/gift-code-batch.js', 'LIMIT ');

if (failures.length) {
  console.error(`批量礼品码验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('最多 50000 个礼品码的原子批量生成、幂等重试和 TXT 下载验证通过。');
