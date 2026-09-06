import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import {
  getMarketDetail,
  peekMarketDetail,
  prefetchMarketDetail,
  resetGameStateDelivery,
} from '../../src/api/game.ts';
import type { MarketDetail } from '../../src/types.ts';

const PROVINCE_ID = '110000';
const ASSET_ID = 'wheat';
const originalFetch = globalThis.fetch;

function detail(revision: string, todayBuyQuantity = 0): MarketDetail {
  return {
    provinceId: PROVINCE_ID,
    assetKind: 'commodity',
    assetId: ASSET_ID,
    revision,
    market: {
      productId: ASSET_ID,
      provinceId: PROVINCE_ID,
      lastPrice: 1.26,
      officialPrice: 1.26,
      todayBuyQuantity,
      priceHistory: [],
      dailyHistory: [{
        dateKey: '2026-09-06',
        price: 1.26,
        buyVolume: todayBuyQuantity,
        sellVolume: 0,
        neutralVolume: 0,
        volume: todayBuyQuantity,
      }],
    },
    orderBook: { bids: [], asks: [] },
  } as unknown as MarketDetail;
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetGameStateDelivery();
});

test('market detail prefetch warms the synchronous cache and later refresh survives caller abort', async () => {
  resetGameStateDelivery();
  const urls: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    urls.push(url);
    if (urls.length === 1) {
      return jsonResponse({
        revision: 1,
        serverNow: 1,
        marketDetailRevision: 'r1',
        unchanged: false,
        marketDetail: detail('r1', 10),
      });
    }
    assert.match(url, /revision=r1/);
    return jsonResponse({
      revision: 1,
      serverNow: 2,
      marketDetailRevision: 'r1',
      unchanged: true,
    });
  }) as typeof fetch;

  prefetchMarketDetail(PROVINCE_ID, 'commodity', ASSET_ID);
  for (let attempt = 0; attempt < 20 && !peekMarketDetail(PROVINCE_ID, 'commodity', ASSET_ID); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(peekMarketDetail(PROVINCE_ID, 'commodity', ASSET_ID)?.revision, 'r1');

  const controller = new AbortController();
  const refresh = getMarketDetail(PROVINCE_ID, 'commodity', ASSET_ID, controller.signal);
  controller.abort();
  assert.equal((await refresh).revision, 'r1');
  assert.equal(urls.length, 2);
});

test('market detail refresh deduplicates an in-flight request and performs at most one trailing refresh', async () => {
  resetGameStateDelivery();
  let releaseFirst: ((response: Response) => void) | undefined;
  const urls: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    urls.push(url);
    if (urls.length === 1) {
      return new Promise<Response>((resolve) => { releaseFirst = resolve; });
    }
    assert.match(url, /revision=r1/);
    return jsonResponse({
      revision: 2,
      serverNow: 2,
      marketDetailRevision: 'r2',
      unchanged: false,
      marketDetail: detail('r2', 25),
    });
  }) as typeof fetch;

  const first = getMarketDetail(PROVINCE_ID, 'commodity', ASSET_ID);
  const second = getMarketDetail(PROVINCE_ID, 'commodity', ASSET_ID);
  assert.equal(urls.length, 1);
  releaseFirst?.(jsonResponse({
    revision: 1,
    serverNow: 1,
    marketDetailRevision: 'r1',
    unchanged: false,
    marketDetail: detail('r1', 10),
  }));

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.revision, 'r2');
  assert.equal(secondResult.revision, 'r2');
  assert.equal(peekMarketDetail(PROVINCE_ID, 'commodity', ASSET_ID)?.market.todayBuyQuantity, 25);
  assert.equal(urls.length, 2);
});
