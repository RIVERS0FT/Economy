import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';

test('diagnose production gameViewModel offset 14557', () => {
  const assetsDir = join(process.cwd(), 'dist', 'assets');
  const filename = readdirSync(assetsDir).find((name) => /^gameViewModel-.*\.js$/.test(name));
  if (!filename) throw new Error('未找到生产 gameViewModel chunk');
  const source = readFileSync(join(assetsDir, filename), 'utf8');
  const offset = 14557;
  console.log(`ECONOMY_GAME_VIEWMODEL_OFFSET filename=${filename} length=${source.length}`);
  console.log(source.slice(Math.max(0, offset - 500), Math.min(source.length, offset + 500)));
});
