import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);
}

function replaceOnce(path, search, replacement) {
  const source = read(path);
  if (!source.includes(search)) throw new Error(`${path} 缺少替换锚点: ${search.slice(0, 120)}`);
  write(path, source.replace(search, replacement));
}

function insertBefore(path, marker, content) {
  const source = read(path);
  if (!source.includes(marker)) throw new Error(`${path} 缺少插入锚点: ${marker}`);
  if (source.includes(content.trim())) return;
  write(path, source.replace(marker, `${content}${marker}`));
}

write('server/src/gem-shop.js', `import { randomUUID } from 'node:crypto';
import { ECONOMY_CONSTANTS } from './domain-core.js';
import { ensureGemState } from './invitations.js';

export const GEM_SHOP_CREDITS_PER_GEM = 10;
export const GEM_SHOP_MIN_EXCHANGE_GEMS = 1;
export const GEM_SHOP_MAX_EXCHANGE_GEMS = 100;

function normalizeExchangeAmount(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function createGemShopSummary(player, totals = {}, recentExchanges = []) {
  ensureGemState(player);
  return {
    gems: player.gems,
    credits: Number(player.credits || 0),
    creditsPerGem: GEM_SHOP_CREDITS_PER_GEM,
    minExchangeGems: GEM_SHOP_MIN_EXCHANGE_GEMS,
    maxExchangeGems: GEM_SHOP_MAX_EXCHANGE_GEMS,
    maxExchangeableGems: Math.min(player.gems, GEM_SHOP_MAX_EXCHANGE_GEMS),
    totalGemsSpent: Number(totals.total_gems_spent || 0),
    totalCreditsReceived: Number(totals.total_credits_received || 0),
    recentExchanges: recentExchanges.map((row) => ({
      gemsSpent: Number(row.gems_spent),
      creditsReceived: Number(row.credits_received),
      createdAt: Number(row.created_at),
    })),
  };
}

export function exchangeGems(player, rawAmount, now = Date.now()) {
  ensureGemState(player);
  const gems = normalizeExchangeAmount(rawAmount);
  if (gems === null || gems < GEM_SHOP_MIN_EXCHANGE_GEMS || gems > GEM_SHOP_MAX_EXCHANGE_GEMS) {
    return { ok: false, message: \`每次兑换宝石数量必须为 \${GEM_SHOP_MIN_EXCHANGE_GEMS}～\${GEM_SHOP_MAX_EXCHANGE_GEMS} 的整数\` };
  }
  if (player.gems < gems) return { ok: false, message: '宝石余额不足' };
  const creditsReceived = gems * GEM_SHOP_CREDITS_PER_GEM;
  if (!Number.isSafeInteger(creditsReceived) || !Number.isSafeInteger(Number(player.credits || 0) + creditsReceived)) {
    return { ok: false, message: '兑换金额超出安全范围' };
  }

  player.gems -= gems;
  player.credits = Number(player.credits || 0) + creditsReceived;
  player.ledger ||= [];
  player.ledger.unshift({
    id: \`ledger-\${randomUUID()}\`,
    category: 'gem_shop_exchange',
    amount: creditsReceived,
    balanceAfter: player.credits,
    createdAt: now,
    description: \`宝石商店兑换：消耗 \${gems} 宝石，获得 \${creditsReceived} 货币\`,
  });
  player.ledger = player.ledger.slice(0, ECONOMY_CONSTANTS.maxLedgerPerPlayer);

  return {
    ok: true,
    message: \`兑换成功：消耗 \${gems} 宝石，获得 ¤\${creditsReceived}\`,
    gemsSpent: gems,
    creditsReceived,
  };
}
`);

replaceOnce(
  'server/src/storage.js',
  "import { ensureGemState } from './invitations.js';",
  "import { ensureGemState } from './invitations.js';\nimport { createGemShopSummary, exchangeGems } from './gem-shop.js';",
);

replaceOnce(
  'server/src/storage.js',
  `      CREATE INDEX IF NOT EXISTS idx_economy_gift_redemptions_user
        ON economy_gift_redemptions(user_id, redeemed_at DESC);
`,
  `      CREATE INDEX IF NOT EXISTS idx_economy_gift_redemptions_user
        ON economy_gift_redemptions(user_id, redeemed_at DESC);
      CREATE TABLE IF NOT EXISTS economy_gem_shop_exchanges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        request_key TEXT NOT NULL UNIQUE,
        gems_spent INTEGER NOT NULL CHECK (gems_spent > 0),
        credits_received INTEGER NOT NULL CHECK (credits_received > 0),
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_gem_shop_exchanges_user
        ON economy_gem_shop_exchanges(user_id, created_at DESC);
`,
);

insertBefore(
  'server/src/storage.js',
  `  }

  close()`,
  `    this.insertGemShopExchange = this.database.prepare(\`
      INSERT INTO economy_gem_shop_exchanges (
        user_id, request_key, gems_spent, credits_received, created_at
      ) VALUES (?, ?, ?, ?, ?)
    \`);
    this.sumGemShopExchanges = this.database.prepare(\`
      SELECT COALESCE(SUM(gems_spent), 0) AS total_gems_spent,
             COALESCE(SUM(credits_received), 0) AS total_credits_received
      FROM economy_gem_shop_exchanges WHERE user_id = ?
    \`);
    this.listGemShopExchanges = this.database.prepare(\`
      SELECT gems_spent, credits_received, created_at
      FROM economy_gem_shop_exchanges
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    \`);
`,
);

insertBefore(
  'server/src/storage.js',
  `  apply(user, { action, payload, requestKey, method, path }, now = Date.now()) {`,
  `  getGemShopSummary(user, now = Date.now()) {
    return this.transaction(() => {
      const { world } = this.loadWorld(now);
      const player = ensurePlayer(world, user, now);
      ensureGemState(player);
      return createGemShopSummary(
        player,
        this.sumGemShopExchanges.get(Number(user.id)),
        this.listGemShopExchanges.all(Number(user.id)),
      );
    }, { immediate: false });
  }

`,
);

replaceOnce(
  'server/src/storage.js',
  `      } else if (action === 'redeemGift') {
        processFacilityGroupWorld(world, now);
        gameResult = this.redeemGiftInTransaction(world, user, payload, now);
      } else if (COLLECTIBLE_ACTIONS.has(action)) {`,
  `      } else if (action === 'redeemGift') {
        processFacilityGroupWorld(world, now);
        gameResult = this.redeemGiftInTransaction(world, user, payload, now);
      } else if (action === 'exchangeGems') {
        processFacilityGroupWorld(world, now);
        gameResult = exchangeGems(player, payload.gems, now);
        if (gameResult.ok) {
          this.insertGemShopExchange.run(
            Number(user.id),
            requestKey,
            gameResult.gemsSpent,
            gameResult.creditsReceived,
            now,
          );
        }
      } else if (COLLECTIBLE_ACTIONS.has(action)) {`,
);

replaceOnce(
  'server/src/app.js',
  `  if (method === 'POST' && path === '/api/game/gifts/redeem') return { action: 'redeemGift', category: 'general' };`,
  `  if (method === 'POST' && path === '/api/game/gifts/redeem') return { action: 'redeemGift', category: 'general' };
  if (method === 'POST' && path === '/api/game/gem-shop/exchange') return { action: 'exchangeGems', category: 'general' };`,
);

replaceOnce(
  'server/src/app.js',
  `    if (method === 'GET' && path === '/api/game/state') {`,
  `    if (method === 'GET' && path === '/api/game/gem-shop') {
      sendJson(response, 200, { gemShop: store.getGemShopSummary(user) });
      return;
    }

    if (method === 'GET' && path === '/api/game/state') {`,
);

replaceOnce(
  'src/api/game.ts',
  `export interface GameStatePollResponse { revision: number; unchanged: boolean; state?: EconomyState; }
`,
  `export interface GameStatePollResponse { revision: number; unchanged: boolean; state?: EconomyState; }
export interface GemShopExchangeRecord {
  gemsSpent: number;
  creditsReceived: number;
  createdAt: number;
}
export interface GemShopSummary {
  gems: number;
  credits: number;
  creditsPerGem: number;
  minExchangeGems: number;
  maxExchangeGems: number;
  maxExchangeableGems: number;
  totalGemsSpent: number;
  totalCreditsReceived: number;
  recentExchanges: GemShopExchangeRecord[];
}
`,
);

replaceOnce(
  'src/api/game.ts',
  `export async function getGameState(revision?: number | null, signal?: AbortSignal): Promise<GameStatePollResponse> {
  const suffix = Number.isInteger(revision) ? \`?revision=\${revision}\` : '';
  return request<GameStatePollResponse>(\`/state\${suffix}\`, { method: 'GET', signal });
}
`,
  `export async function getGameState(revision?: number | null, signal?: AbortSignal): Promise<GameStatePollResponse> {
  const suffix = Number.isInteger(revision) ? \`?revision=\${revision}\` : '';
  return request<GameStatePollResponse>(\`/state\${suffix}\`, { method: 'GET', signal });
}

export async function getGemShopSummary(): Promise<GemShopSummary> {
  const payload = await request<{ gemShop: GemShopSummary }>('/gem-shop', { method: 'GET' });
  return payload.gemShop;
}
`,
);

replaceOnce(
  'src/api/game.ts',
  `  redeemGift: (code: string) => postAction('/gifts/redeem', { code }),
  reset: () => postAction('/reset'),`,
  `  redeemGift: (code: string) => postAction('/gifts/redeem', { code }),
  exchangeGems: (gems: number) => postAction('/gem-shop/exchange', { gems }),
  reset: () => postAction('/reset'),`,
);

replaceOnce(
  'src/app/gameViewModel.ts',
  `  redeemGift: (code: string) => Promise<ActionResult>;
  reset: () => Promise<ActionResult>;`,
  `  redeemGift: (code: string) => Promise<ActionResult>;
  exchangeGems: (gems: number) => Promise<ActionResult>;
  reset: () => Promise<ActionResult>;`,
);

replaceOnce(
  'src/app/gameViewModel.ts',
  `    redeemGift: (code) => runAction('redeemGift', () => gameActions.redeemGift(code)),
    reset: () => runAction('resetPlayer', gameActions.reset),`,
  `    redeemGift: (code) => runAction('redeemGift', () => gameActions.redeemGift(code)),
    exchangeGems: (gems) => runAction('exchangeGems', () => gameActions.exchangeGems(gems)),
    reset: () => runAction('resetPlayer', gameActions.reset),`,
);

replaceOnce(
  'src/utils/localActivityStore.ts',
  `  | 'resetPlayer'
  | 'redeemGift';`,
  `  | 'resetPlayer'
  | 'redeemGift'
  | 'exchangeGems';`,
);
replaceOnce(
  'src/utils/localActivityStore.ts',
  `  resetPlayer: 'system',
  redeemGift: 'system',`,
  `  resetPlayer: 'system',
  redeemGift: 'system',
  exchangeGems: 'system',`,
);

replaceOnce(
  'src/config/navigation.ts',
  `  { id: 'leaderboard', label: '排行' },
  { id: 'settings', label: '设置' },`,
  `  { id: 'leaderboard', label: '排行' },
  { id: 'gem-shop', label: '宝石商店' },
  { id: 'settings', label: '设置' },`,
);

replaceOnce(
  'src/components/icons/GameIcons.tsx',
  `import type { PropsWithChildren, SVGProps } from 'react';`,
  `import type { PropsWithChildren, SVGProps } from 'react';
import { GemIcon } from './GemIcon';`,
);
replaceOnce(
  'src/components/icons/GameIcons.tsx',
  `export type NavigationIconName = 'home' | 'market' | 'production' | 'assets' | 'collections' | 'auction' | 'leaderboard' | 'settings';`,
  `export type NavigationIconName = 'home' | 'market' | 'production' | 'assets' | 'collections' | 'auction' | 'leaderboard' | 'gem-shop' | 'settings';`,
);
replaceOnce(
  'src/components/icons/GameIcons.tsx',
  `    case 'leaderboard': return <LeaderboardIcon {...props} />;
    case 'settings': return <SettingsIcon {...props} />;`,
  `    case 'leaderboard': return <LeaderboardIcon {...props} />;
    case 'gem-shop': return <GemIcon {...props} />;
    case 'settings': return <SettingsIcon {...props} />;`,
);

replaceOnce(
  'src/pages/PageRouter.tsx',
  `import { SettingsPage } from './SettingsPage';`,
  `import { GemShopPage } from './GemShopPage';
import { SettingsPage } from './SettingsPage';`,
);
replaceOnce(
  'src/pages/PageRouter.tsx',
  `    case 'leaderboard':
      return <LeaderboardPage model={model} />;
    case 'settings':`,
  `    case 'leaderboard':
      return <LeaderboardPage model={model} />;
    case 'gem-shop':
      return <GemShopPage model={model} />;
    case 'settings':`,
);

write('src/pages/GemShopPage.tsx', `import { useEffect, useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { getGemShopSummary, type GemShopSummary } from '../api/game';
import { CreditsIcon } from '../components/icons/GameIcons';
import { GemIcon } from '../components/icons/GemIcon';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { Button, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';

const QUICK_AMOUNTS = [1, 5, 10, 25];

export function GemShopPage({ model }: { model: LoadedGameViewModel }) {
  const [summary, setSummary] = useState<GemShopSummary | null>(null);
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setSummary(await getGemShopSummary());
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取宝石商店');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const creditsPreview = useMemo(
    () => amount * (summary?.creditsPerGem ?? 0),
    [amount, summary?.creditsPerGem],
  );
  const validAmount = Boolean(summary)
    && Number.isInteger(amount)
    && amount >= summary!.minExchangeGems
    && amount <= summary!.maxExchangeGems
    && amount <= model.game.gems;

  async function exchange() {
    if (!validAmount || exchanging) return;
    setExchanging(true);
    const result = await model.exchangeGems(amount);
    model.notify(result.message);
    if (result.ok) {
      setAmount(1);
      await load();
    }
    setExchanging(false);
  }

  return (
    <PageLayout title="宝石商店" description="使用宝石单向兑换普通货币。所有兑换由服务器即时结算且不可撤销。">
      <div className="gem-shop-grid">
        <Panel className="widget gem-shop-balance-card">
          <WidgetHeading title="当前余额" action={<StatusTag tone="info">固定汇率</StatusTag>} />
          <div className="gem-shop-balance-row">
            <div><GemIcon /><span>宝石</span><strong>{formatNumber(model.game.gems)}</strong></div>
            <div><CreditsIcon /><span>可用资金</span><strong><CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount></strong></div>
          </div>
          <p>{summary ? `1 宝石 = ${formatNumber(summary.creditsPerGem)} 货币` : loading ? '正在读取服务器汇率…' : '服务器汇率暂时不可用'}</p>
        </Panel>

        <Panel className="widget gem-shop-exchange-card">
          <WidgetHeading title="兑换货币" />
          {summary ? (
            <>
              <label>
                消耗宝石数量
                <input
                  type="number"
                  inputMode="numeric"
                  min={summary.minExchangeGems}
                  max={Math.min(summary.maxExchangeGems, Math.max(summary.maxExchangeableGems, 1))}
                  step={1}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  onKeyDown={(event) => { if (event.key === 'Enter') void exchange(); }}
                />
              </label>
              <div className="gem-shop-quick-row" aria-label="快捷兑换数量">
                {QUICK_AMOUNTS.map((value) => (
                  <Button key={value} variant="secondary" disabled={value > model.game.gems} onClick={() => setAmount(value)}>{value}</Button>
                ))}
                <Button variant="secondary" disabled={summary.maxExchangeableGems < 1} onClick={() => setAmount(summary.maxExchangeableGems)}>最大</Button>
              </div>
              <div className="gem-shop-preview">
                <span>预计获得</span>
                <strong><CurrencyAmount>{formatCurrency(creditsPreview)}</CurrencyAmount></strong>
              </div>
              <Button block disabled={!validAmount || exchanging} onClick={() => void exchange()}>
                {exchanging ? '兑换处理中…' : '确认兑换'}
              </Button>
              <small>单次可兑换 {formatNumber(summary.minExchangeGems)}～{formatNumber(summary.maxExchangeGems)} 宝石；宝石不能用货币买回。</small>
            </>
          ) : <p>{loading ? '正在加载宝石商店…' : error || '宝石商店暂时不可用'}</p>}
        </Panel>

        <Panel className="widget gem-shop-history-card">
          <WidgetHeading title="兑换记录" action={summary ? <StatusTag tone="neutral">最近 20 笔</StatusTag> : undefined} />
          {summary?.recentExchanges.length ? (
            <div className="gem-shop-history-list">
              {summary.recentExchanges.map((record) => (
                <div key={`${record.createdAt}-${record.gemsSpent}`}>
                  <span>消耗 {formatNumber(record.gemsSpent)} 宝石</span>
                  <strong><CurrencyAmount sign="+">{formatCurrency(record.creditsReceived)}</CurrencyAmount></strong>
                  <small>{formatDate(record.createdAt)}</small>
                </div>
              ))}
            </div>
          ) : <p>{loading ? '正在读取兑换记录…' : '尚无兑换记录'}</p>}
          {summary ? (
            <div className="gem-shop-total-row">
              <span>累计消耗 {formatNumber(summary.totalGemsSpent)} 宝石</span>
              <strong>累计获得 <CurrencyAmount>{formatCurrency(summary.totalCreditsReceived)}</CurrencyAmount></strong>
            </div>
          ) : null}
        </Panel>
      </div>
    </PageLayout>
  );
}
`);

write('src/styles/gem-shop.css', `.gem-shop-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-4);
}

.gem-shop-balance-card,
.gem-shop-history-card {
  grid-column: 1 / -1;
}

.gem-shop-balance-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.gem-shop-balance-row > div,
.gem-shop-preview,
.gem-shop-total-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-soft);
}

.gem-shop-balance-row svg { font-size: 1.35rem; }
.gem-shop-balance-row span { color: var(--text-secondary); }
.gem-shop-balance-row strong { margin-left: auto; font-size: var(--font-size-lg); }

.gem-shop-exchange-card { display: grid; gap: var(--space-3); align-content: start; }
.gem-shop-quick-row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.gem-shop-preview { justify-content: space-between; }
.gem-shop-preview strong { font-size: var(--font-size-xl); }

.gem-shop-history-list { display: grid; gap: var(--space-2); }
.gem-shop-history-list > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}
.gem-shop-history-list small { color: var(--text-secondary); }
.gem-shop-total-row { justify-content: space-between; margin-top: var(--space-3); }

@media (max-width: 720px) {
  .gem-shop-grid { grid-template-columns: 1fr; }
  .gem-shop-balance-card,
  .gem-shop-history-card { grid-column: auto; }
  .gem-shop-balance-row { grid-template-columns: 1fr; }
  .gem-shop-history-list > div { grid-template-columns: 1fr auto; }
  .gem-shop-history-list small { grid-column: 1 / -1; }
  .gem-shop-total-row { align-items: flex-start; flex-direction: column; }
}
`);

replaceOnce(
  'src/main.tsx',
  `import './styles/collectibles-auctions.css';`,
  `import './styles/collectibles-auctions.css';
import './styles/gem-shop.css';`,
);

write('server/test/gem-shop.test.js', `import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';
import {
  GEM_SHOP_CREDITS_PER_GEM,
  GEM_SHOP_MAX_EXCHANGE_GEMS,
} from '../src/gem-shop.js';

const user = { id: 1, email: 'shop@example.com', name: '宝石玩家', role: 'user' };

function setup() {
  const store = new EconomyStore(':memory:');
  const now = 1_700_000_000_000;
  const initial = store.getState(user, now);
  return { store, now, initial };
}

test('gem shop exchanges gems for credits atomically and records history', () => {
  const { store, now } = setup();
  try {
    const loaded = store.loadWorld(now + 1);
    loaded.world.players['1'].gems = 12;
    store.saveWorld(loaded.revision, loaded.world, now + 1);

    const response = store.apply(user, {
      action: 'exchangeGems', payload: { gems: 5 }, requestKey: 'gem-shop-exchange-0001',
      method: 'POST', path: '/api/game/gem-shop/exchange',
    }, now + 2);

    assert.equal(response.result.ok, true);
    assert.equal(response.result.gemsSpent, 5);
    assert.equal(response.result.creditsReceived, 5 * GEM_SHOP_CREDITS_PER_GEM);
    assert.equal(response.state.gems, 7);
    assert.equal(response.state.credits, 100 + 5 * GEM_SHOP_CREDITS_PER_GEM);

    const summary = store.getGemShopSummary(user, now + 3);
    assert.equal(summary.totalGemsSpent, 5);
    assert.equal(summary.totalCreditsReceived, 5 * GEM_SHOP_CREDITS_PER_GEM);
    assert.equal(summary.recentExchanges.length, 1);
    assert.equal(summary.recentExchanges[0].gemsSpent, 5);
  } finally {
    store.close();
  }
});

test('gem shop idempotency prevents duplicate deduction and issuance', () => {
  const { store, now } = setup();
  try {
    const loaded = store.loadWorld(now + 1);
    loaded.world.players['1'].gems = 10;
    store.saveWorld(loaded.revision, loaded.world, now + 1);
    const input = {
      action: 'exchangeGems', payload: { gems: 2 }, requestKey: 'gem-shop-exchange-0002',
      method: 'POST', path: '/api/game/gem-shop/exchange',
    };
    const first = store.apply(user, input, now + 2);
    const repeated = store.apply(user, input, now + 3);
    assert.deepEqual(repeated, first);
    const summary = store.getGemShopSummary(user, now + 4);
    assert.equal(summary.totalGemsSpent, 2);
    assert.equal(summary.recentExchanges.length, 1);
    assert.equal(repeated.state.gems, 8);
  } finally {
    store.close();
  }
});

test('gem shop rejects invalid quantities and insufficient balance without mutation', () => {
  const { store, now } = setup();
  try {
    const loaded = store.loadWorld(now + 1);
    loaded.world.players['1'].gems = 3;
    store.saveWorld(loaded.revision, loaded.world, now + 1);
    const invalidValues = [0, 1.5, GEM_SHOP_MAX_EXCHANGE_GEMS + 1, 4];
    invalidValues.forEach((gems, index) => {
      const response = store.apply(user, {
        action: 'exchangeGems', payload: { gems }, requestKey: `gem-shop-invalid-000${index}`,
        method: 'POST', path: '/api/game/gem-shop/exchange',
      }, now + 2 + index);
      assert.equal(response.result.ok, false);
      assert.equal(response.state.gems, 3);
      assert.equal(response.state.credits, 100);
    });
    assert.equal(store.getGemShopSummary(user, now + 10).recentExchanges.length, 0);
  } finally {
    store.close();
  }
});
`);

write('scripts/verify-gem-shop.mjs', `import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(\`缺少文件: \${path}\`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(\`\${path} 缺少: \${text}\`); };

[
  'server/src/gem-shop.js',
  'server/src/storage.js',
  'server/src/app.js',
  'server/test/gem-shop.test.js',
  'src/pages/GemShopPage.tsx',
  'src/styles/gem-shop.css',
  'src/config/navigation.ts',
  'src/pages/PageRouter.tsx',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'GEM_SHOP_CREDITS_PER_GEM = 10',
  'GEM_SHOP_MIN_EXCHANGE_GEMS = 1',
  'GEM_SHOP_MAX_EXCHANGE_GEMS = 100',
  'player.gems -= gems',
  'player.credits = Number(player.credits || 0) + creditsReceived',
  "category: 'gem_shop_exchange'",
]) requireText('server/src/gem-shop.js', text);
for (const text of [
  'CREATE TABLE IF NOT EXISTS economy_gem_shop_exchanges',
  'request_key TEXT NOT NULL UNIQUE',
  "action === 'exchangeGems'",
  'this.insertGemShopExchange.run',
  'getGemShopSummary',
]) requireText('server/src/storage.js', text);
for (const text of [
  "path === '/api/game/gem-shop'",
  "path === '/api/game/gem-shop/exchange'",
]) requireText('server/src/app.js', text);
for (const text of [
  "{ id: 'gem-shop', label: '宝石商店' }",
]) requireText('src/config/navigation.ts', text);
for (const text of [
  'title="宝石商店"',
  '1 宝石 =',
  '确认兑换',
  '宝石不能用货币买回',
  '兑换记录',
]) requireText('src/pages/GemShopPage.tsx', text);
for (const text of ['固定汇率', '单向兑换', '不可撤销']) requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text);
for (const text of ['宝石商店', '`gem-shop`', '`GemShopPage`']) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of ['/api/game/gem-shop', '/api/game/gem-shop/exchange', 'economy_gem_shop_exchanges']) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);

if (failures.length) {
  console.error(\`宝石商店验证失败:\n- \${failures.join('\n- ')}\`);
  process.exit(1);
}
console.log('宝石商店验证通过：独立页面、服务器固定汇率、原子兑换、幂等和记录规则均已锁定。');
`);

replaceOnce(
  'package.json',
  `node scripts/verify-gems-invitations-and-bans.mjs && node scripts/verify-page-content.mjs`,
  `node scripts/verify-gems-invitations-and-bans.mjs && node scripts/verify-gem-shop.mjs && node scripts/verify-page-content.mjs`,
);

replaceOnce(
  'scripts/verify-page-content.mjs',
  `  'src/pages/LeaderboardPage.tsx',
  'src/pages/SettingsPage.tsx',`,
  `  'src/pages/LeaderboardPage.tsx',
  'src/pages/GemShopPage.tsx',
  'src/pages/SettingsPage.tsx',`,
);
replaceOnce(
  'scripts/verify-page-content.mjs',
  `  "{ id: 'auction', label: '拍卖' }",
]) requireText('src/config/navigation.ts', text);`,
  `  "{ id: 'auction', label: '拍卖' }",
  "{ id: 'gem-shop', label: '宝石商店' }",
]) requireText('src/config/navigation.ts', text);`,
);
replaceOnce(
  'scripts/verify-page-content.mjs',
  `  '概览｜市场｜生产｜资产｜藏品｜拍卖｜排行｜设置',`,
  `  '概览｜市场｜生产｜资产｜藏品｜拍卖｜排行｜宝石商店｜设置',`,
);
replaceOnce(
  'scripts/verify-page-content.mjs',
  `  '| 设置 | \`settings\` | \`SettingsPage\` | 资料、偏好、邀请、礼品、退出和重置 |',`,
  `  '| 宝石商店 | \`gem-shop\` | \`GemShopPage\` | 宝石单向兑换普通货币 |',
  '| 设置 | \`settings\` | \`SettingsPage\` | 资料、偏好、邀请、礼品、退出和重置 |',`,
);
replaceOnce(
  'scripts/verify-page-content.mjs',
  `console.log('页面内容、八页导航、主页 SVG Logo、登录注册、高增长记录窗口化、邀请、藏品拍卖、全局紧凑数字、生产公式和仓库职责验证通过。');`,
  `console.log('页面内容、九页导航、主页 SVG Logo、登录注册、高增长记录窗口化、邀请、宝石商店、藏品拍卖、全局紧凑数字、生产公式和仓库职责验证通过。');`,
);

replaceOnce(
  'README.md',
  `→ 邀请新玩家获得独立宝石
→ 调整产业链、库存、资金与收藏`,
  `→ 邀请新玩家获得独立宝石
→ 在宝石商店按固定汇率兑换普通货币
→ 调整产业链、库存、资金与收藏`,
);
replaceOnce(
  'README.md',
  `- 宝石是独立于普通货币的整数资产，不参与市场、生产、总资产或排行榜。每名玩家拥有永久 8 位邀请码和专属分享链接；新玩家通过分享链接首次建档，或注册后 24 小时内在设置页填写邀请码时，邀请人立即获得 10 宝石，被邀请人不获得宝石。`,
  `- 宝石是独立于普通货币的整数资产，不参与市场、生产、总资产或排行榜。每名玩家拥有永久 8 位邀请码和专属分享链接；新玩家通过分享链接首次建档，或注册后 24 小时内在设置页填写邀请码时，邀请人立即获得 10 宝石，被邀请人不获得宝石。宝石可在独立“宝石商店”按服务器固定汇率 1 宝石兑换 10 普通货币，单次 1～100 宝石，只允许单向兑换且不可撤销。`,
);
replaceOnce(
  'README.md',
  `概览｜市场｜生产｜资产｜藏品｜拍卖｜排行｜设置`,
  `概览｜市场｜生产｜资产｜藏品｜拍卖｜排行｜宝石商店｜设置`,
);
replaceOnce(
  'README.md',
  `- 排行：服务器总资产排行榜。
- 设置：玩家资料、偏好、宝石、分享链接、邀请码、礼品兑换、退出与重置。`,
  `- 排行：服务器总资产排行榜。
- 宝石商店：按服务器固定汇率将宝石单向兑换为普通货币，并查看最近兑换记录。
- 设置：玩家资料、偏好、宝石、分享链接、邀请码、礼品兑换、退出与重置。`,
);

replaceOnce(
  'docs/README.md',
  `| \`PRODUCT_AND_GAMEPLAY_DESIGN.md\` | 产品定位、核心循环、工作冷却、普通货币与宝石、邀请奖励、货币来源回收、需求与排行榜目标 |`,
  `| \`PRODUCT_AND_GAMEPLAY_DESIGN.md\` | 产品定位、核心循环、工作冷却、普通货币与宝石、邀请奖励、宝石商店兑换、货币来源回收、需求与排行榜目标 |`,
);
replaceOnce(
  'docs/README.md',
  `| \`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md\` | 八个正式页面、登录注册入口、宝石、分享链接、邀请码、封禁提示、藏品与拍卖、资产导航、模块唯一归属和页面防回退规则 |`,
  `| \`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md\` | 九个正式页面、登录注册入口、独立宝石商店、分享链接、邀请码、封禁提示、藏品与拍卖、资产导航、模块唯一归属和页面防回退规则 |`,
);
insertBefore(
  'docs/README.md',
  `
`,
  ``,
);
const docsIndex = read('docs/README.md');
if (!docsIndex.includes('18. 宝石商店')) {
  write('docs/README.md', `${docsIndex.trimEnd()}\n18. 宝石商店固定汇率、单向兑换、兑换幂等与独立页面属于产品、页面和服务器权威规则；必须同步更新对应文档、测试和 \`scripts/verify-gem-shop.mjs\`。\n`);
}

replaceOnce(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  `宝石是独立邀请奖励资产，不进入经营总资产和排行榜。`,
  `宝石是独立邀请奖励资产，不直接进入经营总资产和排行榜；玩家可以在独立宝石商店按服务器固定汇率单向兑换普通货币。`,
);
replaceOnce(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  `3. 礼品兑换。`,
  `3. 礼品兑换。
4. 宝石商店兑换。`,
);
replaceOnce(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  `宝石不参与商品或工厂订单，不折算为普通货币，不计入总资产、周变化或排行榜。`,
  `宝石不参与商品或工厂订单，宝石余额本身不计入总资产、周变化或排行榜。宝石只能通过独立宝石商店按固定汇率单向兑换普通货币，不允许普通货币反向购买宝石。`,
);
insertBefore(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  `## 9. 容量与降级原则`,
  `### 8.4 宝石商店兑换

宝石商店是独立一级页面。服务器固定汇率为 **1 宝石 = 10 普通货币**，单次只能兑换 1～100 个整数宝石。兑换必须先校验宝石余额，再在同一个 SQLite 事务中扣除宝石、增加可用普通货币、写入普通货币账本、记录兑换历史并保存世界状态。

兑换只允许宝石换普通货币，不提供普通货币购买宝石、撤销、退款或客户端自定义汇率。每次写操作必须使用幂等键；相同请求重试不得重复扣除宝石或重复发行货币。兑换获得的普通货币属于新的系统货币发行，但宝石余额本身仍不计入总资产。

`,
);

replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `概览｜市场｜生产｜资产｜藏品｜拍卖｜排行｜设置`,
  `概览｜市场｜生产｜资产｜藏品｜拍卖｜排行｜宝石商店｜设置`,
);
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `| 排行 | \`leaderboard\` | \`LeaderboardPage\` | 服务器总资产排名 |
| 设置 | \`settings\` | \`SettingsPage\` | 资料、偏好、邀请、礼品、退出和重置 |`,
  `| 排行 | \`leaderboard\` | \`LeaderboardPage\` | 服务器总资产排名 |
| 宝石商店 | \`gem-shop\` | \`GemShopPage\` | 宝石单向兑换普通货币 |
| 设置 | \`settings\` | \`SettingsPage\` | 资料、偏好、邀请、礼品、退出和重置 |`,
);
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `移动底部导航允许横向滚动，八个页面不得通过隐藏导航项、缩写中文名称或创建二级菜单规避空间限制。`,
  `移动底部导航允许横向滚动，九个页面不得通过隐藏导航项、缩写中文名称或创建二级菜单规避空间限制。`,
);
insertBefore(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `## 10. 设置`,
  `## 10. 宝石商店

页面主标题固定为“宝石商店”，作为独立一级页面使用路由 ID \`gem-shop\`。页面必须展示当前宝石、可用资金、服务器固定汇率、整数兑换数量、快捷数量、预计获得货币、确认按钮、累计兑换和最近 20 笔记录。

汇率固定显示为 1 宝石兑换 10 普通货币；单次输入范围 1～100，不能超过当前宝石余额。客户端只计算展示预览，实际扣除、发行、幂等与记录全部等待服务器响应。页面必须明确说明兑换单向且不可撤销，不得提供普通货币购买宝石或将宝石商店塞回设置页。

`,
);
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `## 11. 商品与工厂目录扩展规则`,
  `## 12. 商品与工厂目录扩展规则`,
);
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `## 12. 模块唯一归属`,
  `## 13. 模块唯一归属`,
);
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `## 13. 防回退`,
  `## 14. 防回退`,
);
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `| 总资产排名 | 排行 |
| 资料、偏好、邀请、礼品、退出和重置 | 设置 |`,
  `| 总资产排名 | 排行 |
| 宝石兑换、固定汇率与兑换记录 | 宝石商店 |
| 资料、偏好、邀请、礼品、退出和重置 | 设置 |`,
);
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `- 隐藏移动端的藏品或拍卖导航;`,
  `- 隐藏移动端的藏品、拍卖或宝石商店导航;`,
);
insertBefore(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `- 从管理员页面移除同 IP 封禁复核和手动解禁入口。`,
  `- 把宝石商店合并进设置页、允许普通货币购买宝石、由客户端决定实际汇率或允许撤销兑换；
`,
);

replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  `服务器保存并判定可用与冻结资金、宝石余额与流水、商品库存`,
  `服务器保存并判定可用与冻结资金、宝石余额与流水、宝石商店兑换记录、商品库存`,
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  `\`server/src/invitations.js\` 是宝石邀请、邀请码、邀请关系、注册 IP 封禁与解禁审计的唯一业务模块。`,
  `\`server/src/invitations.js\` 是宝石邀请、邀请码、邀请关系、注册 IP 封禁与解禁审计的唯一业务模块。\n\n\`server/src/gem-shop.js\` 是宝石兑换普通货币的唯一规则模块，固定定义 1 宝石兑换 10 普通货币和单次 1～100 宝石边界；\`storage.js\` 只负责在同一事务中保存世界与 \`economy_gem_shop_exchanges\` 记录，不得另设客户端汇率。`,
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  `- 邀请码、邀请关系、宝石流水、封禁事件和审计属于 SQLite 业务表，不写入世界 JSON。`,
  `- 邀请码、邀请关系、宝石流水、宝石商店兑换记录、封禁事件和审计属于 SQLite 业务表，不写入世界 JSON。`,
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  `- \`economy_invite_codes\`、\`economy_invitation_relations\`、\`economy_gem_ledger\`、\`economy_ip_ban_incidents\`、\`economy_ip_ban_members\`、\`economy_account_bans\` 与 \`economy_ban_audit\` 是邀请、宝石和封禁的权威业务表。`,
  `- \`economy_invite_codes\`、\`economy_invitation_relations\`、\`economy_gem_ledger\`、\`economy_gem_shop_exchanges\`、\`economy_ip_ban_incidents\`、\`economy_ip_ban_members\`、\`economy_account_bans\` 与 \`economy_ban_audit\` 是邀请、宝石兑换和封禁的权威业务表。`,
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  `| GET | \`/api/game/invitations\` | 获取宝石余额、邀请码、分享链接和邀请统计 |
| POST | \`/api/game/invitations/claim\` | 注册后 24 小时内手动填写邀请码 |`,
  `| GET | \`/api/game/invitations\` | 获取宝石余额、邀请码、分享链接和邀请统计 |
| POST | \`/api/game/invitations/claim\` | 注册后 24 小时内手动填写邀请码 |
| GET | \`/api/game/gem-shop\` | 获取服务器汇率、兑换边界、累计与最近记录 |
| POST | \`/api/game/gem-shop/exchange\` | 原子扣除宝石并增加普通货币 |`,
);
insertBefore(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  `## 7. 容量与客户端交付`,
  `### 6.1 宝石商店事务

宝石商店固定使用 1 宝石兑换 10 普通货币，单次接受 1～100 的整数宝石。\`POST /api/game/gem-shop/exchange\` 必须先通过封禁检查和普通写操作限流，并要求 \`Idempotency-Key\`。在一个 \`BEGIN IMMEDIATE\` 事务中完成宝石余额校验、扣除宝石、增加可用资金、普通货币账本写入、\`economy_gem_shop_exchanges\` 插入、世界修订号更新和幂等响应保存；任一步失败全部回滚。

\`GET /api/game/gem-shop\` 只返回服务器固定汇率、当前余额、累计值和最近 20 笔兑换。客户端预览不得成为结算依据。相同幂等键重试返回第一次响应，不重复扣除或发行；不同路径复用幂等键继续返回冲突。

`,
);

console.log('Gem shop source, tests, verification and authoritative documents updated.');
