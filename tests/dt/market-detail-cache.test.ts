import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n?/g, '\n');

test('market detail delivery keeps a bounded SWR cache, one in-flight request, and one trailing refresh', () => {
  const api = read('src/api/game.ts');
  for (const token of [
    'const marketDetailCache = new Map<string, MarketDetail>();',
    'const marketDetailInflight = new Map<string, Promise<MarketDetail>>();',
    'const marketDetailRefreshGeneration = new Map<string, number>();',
    'while (marketDetailCache.size > 32)',
    'export function peekMarketDetail(',
    'export function prefetchMarketDetail(',
    'const inflight = marketDetailInflight.get(key);',
    'if (inflight) return inflight;',
    'const firstGeneration = marketDetailRefreshGeneration.get(key) ?? 0;',
    'if ((marketDetailRefreshGeneration.get(key) ?? 0) !== firstGeneration)',
    'detail = await fetchMarketDetailOnce(provinceId, assetKind, assetId, epoch);',
    'void signal;',
  ]) assert.ok(api.includes(token), `市场详情缓存缺少: ${token}`);

  assert.equal(
    api.split('detail = await fetchMarketDetailOnce(provinceId, assetKind, assetId, epoch);').length - 1,
    2,
    '市场详情刷新必须只保留一次初始请求和最多一次尾随刷新调用点',
  );
});

test('market page reuses cached detail, prefetches catalog rows, and refreshes on today volume changes', () => {
  const page = read('src/pages/MarketPage.tsx');
  const row = read('src/components/market/MarketCommodityRow.tsx');
  for (const token of [
    'peekMarketDetail(model.selectedProvinceId, activeAssetKind, assetId)',
    'const marketDetailPending = Boolean(marketDetailLoading && !selectedMarketDetail);',
    'selectedProductMarket?.todayBuyQuantity',
    'selectedProductMarket?.todaySellQuantity',
    'onPrefetch={() => prefetchMarketDetail(model.selectedProvinceId, entry.kind, entry.id)}',
  ]) assert.ok(page.includes(token), `市场详情页面缺少: ${token}`);
  for (const token of ['onPointerEnter={onPrefetch}', 'onPointerDown={onPrefetch}', 'onFocus={onPrefetch}']) {
    assert.ok(row.includes(token), `市场目录预取入口缺少: ${token}`);
  }
});
