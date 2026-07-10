import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, login, logout } from './api/auth';
import { economyConstants, useGameStore } from './store/gameStore';
import type { AuthUser, FacilityStatus, OrderStatus, ProductionFacility } from './types';

const navigation = [
  ['home', '主页面', '⌂'],
  ['market', '市场', '↕'],
  ['production', '生产', '⚙'],
  ['assets', '资产', '◫'],
  ['leaderboard', '排行榜', '♛'],
  ['records', '订单与记录', '≡'],
  ['settings', '设置', '⚙'],
] as const;

type TabId = (typeof navigation)[number][0];

const facilityStatusNames: Record<FacilityStatus, string> = {
  constructing: '施工中',
  ready: '待启用',
  running: '生产中',
  paused: '已暂停',
  full: '商品已满',
  insufficient_funds: '资金不足',
  listed: '挂牌中',
};

const orderStatusNames: Record<OrderStatus, string> = {
  open: '等待成交',
  partial: '部分成交',
  filled: '全部成交',
  cancelled: '已取消',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value);
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

function formatDuration(ms: number) {
  if (ms <= 0) return '已完成';
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}分${seconds.toString().padStart(2, '0')}秒` : `${seconds}秒`;
}

function PriceSparkline({ values }: { values: number[] }) {
  const width = 720;
  const height = 220;
  const padding = 18;
  const safeValues = values.length > 1 ? values : [7, 7];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = Math.max(1, max - min);
  const points = safeValues
    .map((value, index) => {
      const x = padding + (index / (safeValues.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="price-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="近期成交价格曲线">
      <defs>
        <linearGradient id="priceFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={padding} x2={width - padding} y1={height / 2} y2={height / 2} className="chart-gridline" />
      <polygon points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`} fill="url(#priceFill)" />
      <polyline points={points} fill="none" className="chart-line" />
    </svg>
  );
}

function LoginPage({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const user = await login(email, password);
      onAuthenticated(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="brand-lockup" aria-label="金融帝国">
          <span>金融帝国</span>
        </div>
        <h1>从一枚货币开始，建立你的财富策略。</h1>
      </section>

      <section className="login-card panel">
        <p className="eyebrow">Account login</p>
        <h2>登录金融帝国</h2>
        <p className="muted">使用已注册账号进入市场。</p>
        <form onSubmit={submit} className="login-form">
          <label>
            账号邮箱
            <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
          </label>
          <label>
            密码
            <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={submitting}>{submitting ? '正在连接账号服务…' : '登录并进入市场'}</button>
        </form>
        <div className="login-links">
          <a href="https://riversoft.top/register">没有账号？注册账号</a>
          <a href="https://riversoft.top/login">管理账号登录</a>
        </div>
        <small>账号认证由统一账号服务处理，金融帝国不保存你的密码。</small>
      </section>
    </main>
  );
}

function FacilityProgress({ facility, now }: { facility: ProductionFacility; now: number }) {
  let progress = 0;
  let detail = facilityStatusNames[facility.status];

  if (facility.status === 'constructing' && facility.constructionCompletesAt) {
    const remaining = facility.constructionCompletesAt - now;
    progress = Math.max(0, Math.min(100, 100 - (remaining / economyConstants.buildTimeMs) * 100));
    detail = `施工剩余 ${formatDuration(remaining)}`;
  } else if (facility.status === 'running' && facility.cycleStartedAt) {
    const elapsed = now - facility.cycleStartedAt;
    progress = Math.max(0, Math.min(100, (elapsed / facility.cycleMs) * 100));
    detail = `本周期 ${formatDuration(facility.cycleMs - elapsed)}`;
  } else if (facility.status === 'full') {
    progress = 100;
  }

  return (
    <div className="progress-wrap">
      <div className="progress-meta"><span>{detail}</span><span>{Math.round(progress)}%</span></div>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
    </div>
  );
}

function GameApp({ user, onSignedOut }: { user: AuthUser; onSignedOut: () => void }) {
  const {
    game,
    initialize,
    reloadFromStorage,
    process,
    reset,
    work,
    buildFacility,
    startFacility,
    pauseFacility,
    collectFacility,
    listFacility,
    cancelFacilityListing,
    buyFacility,
    placeCommodityOrder,
    cancelOrder,
    renamePlayer,
  } = useGameStore();
  const [tab, setTab] = useState<TabId>('home');
  const [notice, setNotice] = useState('');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(7);
  const [listingPrices, setListingPrices] = useState<Record<string, number>>({});
  const [playerName, setPlayerName] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [compactNumbers, setCompactNumbers] = useState(false);
  const [refreshRate, setRefreshRate] = useState('1');
  const now = Date.now();

  useEffect(() => {
    initialize(user);
  }, [initialize, user]);

  useEffect(() => {
    const interval = Math.max(1, Number(refreshRate)) * 1_000;
    const timer = window.setInterval(process, interval);
    const handleStorage = (event: StorageEvent) => {
      if (event.key?.endsWith(`:${user.id}`)) reloadFromStorage(user.id);
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', handleStorage);
    };
  }, [process, refreshRate, reloadFromStorage, user.id]);

  useEffect(() => {
    if (game) setPlayerName(game.playerName);
  }, [game?.playerName]);

  const derived = useMemo(() => {
    if (!game) return null;
    const ownOpenOrders = game.orders.filter((order) => order.ownerId === game.userId && ['open', 'partial'].includes(order.status));
    const ownListings = game.facilityListings.filter((listing) => listing.ownerId === game.userId);
    const bids = game.orders
      .filter((order) => order.side === 'buy' && ['open', 'partial'].includes(order.status))
      .sort((a, b) => b.price - a.price || a.createdAt - b.createdAt);
    const asks = game.orders
      .filter((order) => order.side === 'sell' && ['open', 'partial'].includes(order.status))
      .sort((a, b) => a.price - b.price || a.createdAt - b.createdAt);
    const facilityValue = game.facilities.reduce((sum, facility) => sum + facility.systemValue + facility.internalGoods * game.marketPrice, 0);
    const commodityValue = (game.inventory + game.frozenInventory) * game.marketPrice;
    const cashValue = game.credits + game.frozenCredits;
    const totalAssets = cashValue + commodityValue + facilityValue;
    const currentRank = game.leaderboard.find((entry) => entry.isCurrentPlayer);
    const previousRank = currentRank && currentRank.rank > 1 ? game.leaderboard[currentRank.rank - 2] : null;
    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const spread = bestBid && bestAsk ? bestAsk - bestBid : 0;
    const pendingGoods = game.facilities.reduce((sum, facility) => sum + facility.internalGoods, 0);
    const runningFacilities = game.facilities.filter((facility) => facility.status === 'running').length;
    const constructingFacilities = game.facilities.filter((facility) => facility.status === 'constructing').length;
    const buyTrades = game.trades.filter((trade) => trade.type === 'commodity' && trade.side === 'buy');
    const boughtQuantity = buyTrades.reduce((sum, trade) => sum + trade.quantity, 0);
    const averageCost = boughtQuantity ? buyTrades.reduce((sum, trade) => sum + trade.total, 0) / boughtQuantity : 0;
    const history = game.marketPriceHistory.map((point) => point.price);
    const marketTrend = history.length > 1 ? history[history.length - 1] - history[0] : 0;
    return {
      ownOpenOrders,
      ownListings,
      bids,
      asks,
      facilityValue,
      commodityValue,
      cashValue,
      totalAssets,
      currentRank,
      previousRank,
      bestBid,
      bestAsk,
      spread,
      pendingGoods,
      runningFacilities,
      constructingFacilities,
      averageCost,
      history,
      marketTrend,
    };
  }, [game]);

  if (!game || !derived) return <main className="loading-screen">正在恢复玩家资产与市场状态…</main>;

  function showResult(result: { ok: boolean; message: string }) {
    setNotice(result.message);
    window.setTimeout(() => setNotice(''), 3_000);
  }

  async function signOut() {
    try {
      await logout();
    } finally {
      onSignedOut();
    }
  }

  const workRemaining = Math.max(0, game.work.cooldownUntil - now);
  const inventoryUsed = game.inventory + game.frozenInventory;
  const cashShare = derived.totalAssets ? Math.round((derived.cashValue / derived.totalAssets) * 100) : 0;
  const commodityShare = derived.totalAssets ? Math.round((derived.commodityValue / derived.totalAssets) * 100) : 0;
  const facilityShare = Math.max(0, 100 - cashShare - commodityShare);
  const cashEnd = cashShare * 3.6;
  const commodityEnd = (cashShare + commodityShare) * 3.6;
  const allocationStyle = {
    background: `conic-gradient(var(--green) 0deg ${cashEnd}deg, var(--gold) ${cashEnd}deg ${commodityEnd}deg, var(--blue) ${commodityEnd}deg 360deg)`,
  };
  const avatarText = (game.playerName || user.email).slice(0, 1).toUpperCase();

  return (
    <main className="game-shell">
      <aside className="sidebar panel">
        <div className="sidebar-brand">
          <span className="player-avatar" aria-hidden="true">金</span>
          <div><strong>金融帝国</strong><span>市场交易版</span></div>
        </div>

        <div className="player-mini-card">
          <div className="player-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : avatarText}</div>
          <div><strong>{game.playerName}</strong><span>排名 #{derived.currentRank?.rank ?? '--'} · 玩家</span></div>
        </div>

        <nav className="sidebar-nav" aria-label="游戏主导航">
          {navigation.map(([id, label, icon]) => (
            <button key={id} className={tab === id ? 'sidebar-nav-button active' : 'sidebar-nav-button'} onClick={() => setTab(id)}>
              <span aria-hidden="true">{icon}</span><strong>{label}</strong>
              {id === 'records' && derived.ownOpenOrders.length ? <small>{derived.ownOpenOrders.length}</small> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="connection-state"><span className="status-dot" /><div><strong>市场在线</strong><small>本地多人规则预览</small></div></div>
          <button className="ghost-button sidebar-logout" onClick={() => void signOut()}>退出登录</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="asset-bar panel">
          <div className="asset-bar-item"><span>可用资金</span><strong>¤ {formatCurrency(game.credits)}</strong><small>冻结 ¤ {formatCurrency(game.frozenCredits)}</small></div>
          <div className="asset-bar-item primary"><span>总资产</span><strong>¤ {formatCurrency(derived.totalAssets)}</strong><small className={(derived.currentRank?.weeklyChange ?? 0) >= 0 ? 'positive' : 'negative'}>本周 {(derived.currentRank?.weeklyChange ?? 0) >= 0 ? '+' : ''}¤ {formatCurrency(derived.currentRank?.weeklyChange ?? 0)}</small></div>
          <div className="asset-bar-item"><span>排行榜</span><strong>第 {derived.currentRank?.rank ?? '--'} 名</strong><small>{derived.previousRank ? `距上一名 ¤ ${formatCurrency(derived.previousRank.totalAssets - derived.totalAssets)}` : '当前位于榜首'}</small></div>
          <div className="asset-bar-item"><span>{game.commodityName}</span><strong>{game.inventory}</strong><small>冻结 {game.frozenInventory} · 容量 {inventoryUsed}/{game.inventoryCapacity}</small></div>
          <div className="asset-bar-item market-ticker"><span>最近成交</span><strong>¤ {game.marketPrice}</strong><small className={derived.marketTrend >= 0 ? 'positive' : 'negative'}>{derived.marketTrend >= 0 ? '▲' : '▼'} {Math.abs(derived.marketTrend)}</small></div>
        </header>

        {notice ? <div className="notice-toast">{notice}</div> : null}

        <div className="page-scroll">
          {tab === 'home' ? (
            <section className="page-content">
              <div className="page-heading">
                <div><p className="eyebrow">Player command center</p><h1>早上好，{game.playerName}</h1><p>观察市场、管理生产，并持续提高你的总资产排名。</p></div>
                <div className="page-heading-actions"><span>未完成订单 {derived.ownOpenOrders.length}/{economyConstants.maxOpenOrders}</span><button onClick={() => setTab('market')}>进入市场</button></div>
              </div>

              <div className="home-grid">
                <article className="panel widget work-widget">
                  <div className="widget-heading"><div><p className="eyebrow">Basic work</p><h2>基础工作</h2></div><span className="widget-badge">兜底收入</span></div>
                  <p>每次有效工作获得 ¤1。连续工作会提高冷却，停止 5 分钟后恢复基础档位。</p>
                  <button className="work-compact-button" disabled={workRemaining > 0} onClick={() => showResult(work())}>
                    <strong>{workRemaining > 0 ? formatDuration(workRemaining) : '开始工作'}</strong>
                    <span>{workRemaining > 0 ? '等待冷却结束' : '获得 ¤ 1'}</span>
                  </button>
                  <div className="mini-stat-row"><span>连续档位 <strong>{game.work.streak || 0}/4</strong></span><span>累计工作 <strong>{game.work.totalClicks}</strong></span></div>
                </article>

                <article className="panel widget market-summary span-2">
                  <div className="widget-heading"><div><p className="eyebrow">Market pulse</p><h2>{game.commodityName}市场</h2></div><button className="text-button" onClick={() => setTab('market')}>查看完整盘口 →</button></div>
                  <div className="market-quote-grid">
                    <div><span>最近成交</span><strong>¤ {game.marketPrice}</strong></div>
                    <div><span>最高买价</span><strong className="positive">¤ {derived.bestBid || '--'}</strong></div>
                    <div><span>最低卖价</span><strong className="negative">¤ {derived.bestAsk || '--'}</strong></div>
                    <div><span>买卖价差</span><strong>¤ {derived.spread}</strong></div>
                  </div>
                  <PriceSparkline values={derived.history.slice(-24)} />
                </article>

                <article className="panel widget production-summary">
                  <div className="widget-heading"><div><p className="eyebrow">Production</p><h2>生产摘要</h2></div><button className="text-button" onClick={() => setTab('production')}>管理</button></div>
                  <div className="summary-stack">
                    <div><span>运行中的设施</span><strong>{derived.runningFacilities}</strong></div>
                    <div><span>施工中的设施</span><strong>{derived.constructingFacilities}</strong></div>
                    <div><span>待领取商品</span><strong>{derived.pendingGoods}</strong></div>
                    <div><span>本小时预计产量</span><strong>{game.facilities.reduce((sum, facility) => sum + Math.floor(3_600_000 / facility.cycleMs) * facility.outputPerCycle, 0)}</strong></div>
                  </div>
                </article>

                <article className="panel widget wealth-summary">
                  <div className="widget-heading"><div><p className="eyebrow">Wealth</p><h2>财富变化</h2></div><span className="rank-chip">#{derived.currentRank?.rank ?? '--'}</span></div>
                  <div className="wealth-total"><span>当前总资产</span><strong>¤ {formatCurrency(derived.totalAssets)}</strong></div>
                  <div className="summary-stack compact"><div><span>现金资产</span><strong>¤ {formatCurrency(derived.cashValue)}</strong></div><div><span>商品估值</span><strong>¤ {formatCurrency(derived.commodityValue)}</strong></div><div><span>设施估值</span><strong>¤ {formatCurrency(derived.facilityValue)}</strong></div></div>
                </article>

                <article className="panel widget recent-activity span-2">
                  <div className="widget-heading"><div><p className="eyebrow">Recent activity</p><h2>最近成交与提醒</h2></div><button className="text-button" onClick={() => setTab('records')}>全部记录</button></div>
                  <div className="activity-list">
                    {game.trades.slice(0, 6).map((trade) => <div key={trade.id}><span><strong>{trade.description}</strong><small>{trade.counterparty} · {formatTime(trade.createdAt)}</small></span><strong className={trade.side === 'sell' ? 'positive' : 'negative'}>{trade.side === 'sell' ? '+' : '-'}¤ {formatCurrency(trade.total)}</strong></div>)}
                    {game.trades.length === 0 ? <div className="empty-state">暂无成交。进入市场提交你的第一笔订单。</div> : null}
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {tab === 'market' ? (
            <section className="page-content">
              <div className="page-heading"><div><p className="eyebrow">Unified market</p><h1>市场</h1><p>通过订单簿判断价格，与玩家和人口需求进行商品交易，或收购生产设施。</p></div></div>
              <div className="market-stat-strip panel">
                <div><span>买一价</span><strong className="positive">¤ {derived.bestBid || '--'}</strong></div><div><span>卖一价</span><strong className="negative">¤ {derived.bestAsk || '--'}</strong></div><div><span>价差</span><strong>¤ {derived.spread}</strong></div><div><span>玩家持仓</span><strong>{game.inventory}</strong></div><div><span>平均成本</span><strong>{derived.averageCost ? `¤ ${derived.averageCost.toFixed(1)}` : '--'}</strong></div>
              </div>

              <div className="market-grid">
                <article className="panel widget order-entry">
                  <p className="eyebrow">Limit order</p><h2>{game.commodityName}限价订单</h2>
                  <div className="segmented"><button className={orderSide === 'buy' ? 'active' : ''} onClick={() => setOrderSide('buy')}>买入</button><button className={orderSide === 'sell' ? 'active sell-active' : ''} onClick={() => setOrderSide('sell')}>卖出</button></div>
                  <label>数量<input type="number" min="1" value={orderQuantity} onChange={(event) => setOrderQuantity(Number(event.target.value))} /></label>
                  <label>限价<input type="number" min="1" value={orderPrice} onChange={(event) => setOrderPrice(Number(event.target.value))} /></label>
                  <div className="order-summary"><span>订单总额</span><strong>¤ {formatCurrency(orderQuantity * orderPrice)}</strong></div>
                  <div className="order-capacity"><span>可用资金 ¤ {formatCurrency(game.credits)}</span><span>可用库存 {game.inventory}</span></div>
                  <button onClick={() => showResult(placeCommodityOrder(orderSide, orderQuantity, orderPrice))}>提交{orderSide === 'buy' ? '买单' : '卖单'}</button>
                  <small>价格优先、同价时间优先，允许部分成交和撤销未成交部分。</small>
                </article>

                <article className="panel widget order-book">
                  <div className="widget-heading"><div><p className="eyebrow">Order book</p><h2>商品订单簿</h2></div><div className="last-price"><span>最近成交</span><strong>¤ {game.marketPrice}</strong></div></div>
                  <div className="book-columns">
                    <div><h3>买盘</h3>{derived.bids.slice(0, 10).map((order) => <div className="book-row bid" key={order.id}><span>¤ {order.price}</span><span>{order.remaining}</span><small>{order.ownerName}</small></div>)}</div>
                    <div><h3>卖盘</h3>{derived.asks.slice(0, 10).map((order) => <div className="book-row ask" key={order.id}><span>¤ {order.price}</span><span>{order.remaining}</span><small>{order.ownerName}</small></div>)}</div>
                  </div>
                </article>

                <article className="panel widget market-chart-card">
                  <div className="widget-heading"><div><p className="eyebrow">Price history</p><h2>近期成交曲线</h2></div><span className={derived.marketTrend >= 0 ? 'positive' : 'negative'}>{derived.marketTrend >= 0 ? '+' : ''}{derived.marketTrend}</span></div>
                  <PriceSparkline values={derived.history} />
                  <div className="chart-footer"><span>成交样本 {game.marketPriceHistory.length}</span><span>人口需求满足率 {Math.round(game.demand.satisfaction * 100)}%</span></div>
                </article>

                <article className="panel widget span-3">
                  <div className="widget-heading"><div><p className="eyebrow">Facility listings</p><h2>生产设施挂牌</h2></div><span className="muted">固定价格 · 即时产权交割</span></div>
                  <div className="listing-grid">
                    {game.facilityListings.map((listing) => (
                      <article className="listing-card" key={listing.id}>
                        <div><span className={listing.ownerId === game.userId ? 'status-chip status-listed' : 'status-chip'}>{listing.ownerId === game.userId ? '我的挂牌' : '可收购'}</span><h3>{listing.facility.name}</h3><p>{listing.ownerName} · 等级 {listing.facility.level}</p></div>
                        <div className="listing-specs"><span>周期 {listing.facility.cycleMs / 1000}s</span><span>产量 {listing.facility.outputPerCycle}</span><span>运营费 ¤ {listing.facility.operatingCost}</span><span>容量 {listing.facility.internalCapacity}</span><span>累计产量 {listing.facility.lifetimeOutput}</span><span>参考估值 ¤ {listing.facility.systemValue}</span></div>
                        <div className="listing-price"><strong>¤ {formatCurrency(listing.price)}</strong>{listing.ownerId === game.userId ? <button className="danger-button" onClick={() => cancelFacilityListing(listing.id)}>撤销</button> : <button onClick={() => showResult(buyFacility(listing.id))}>立即收购</button>}</div>
                      </article>
                    ))}
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {tab === 'production' ? (
            <section className="page-content">
              <div className="page-heading"><div><p className="eyebrow">Production assets</p><h1>生产</h1><p>建造、运行、暂停、领取或挂牌你的生产设施。</p></div><div className="page-heading-actions"><span>设施槽位 {game.facilities.length}/{game.facilitySlots}</span></div></div>
              <div className="production-grid">
                <article className="panel widget build-card">
                  <p className="eyebrow">Build facility</p><h2>建造基础生产设施</h2>
                  <dl className="detail-list"><div><dt>建造费用</dt><dd>¤ {economyConstants.buildCost}</dd></div><div><dt>施工时间</dt><dd>5 分钟</dd></div><div><dt>生产周期</dt><dd>30 秒</dd></div><div><dt>周期产量</dt><dd>1 个{game.commodityName}</dd></div><div><dt>运营费用</dt><dd>¤ 1 / 周期</dd></div><div><dt>内部容量</dt><dd>20</dd></div></dl>
                  <button onClick={() => showResult(buildFacility())} disabled={game.facilities.length >= game.facilitySlots}>开始施工</button>
                  <small className="muted">建造费由系统回收，施工期间持续占用设施槽位。</small>
                </article>

                <div className="facility-list">
                  {game.facilities.map((facility) => {
                    const listingPrice = listingPrices[facility.id] ?? facility.systemValue;
                    const hourlyOutput = Math.floor(3_600_000 / facility.cycleMs) * facility.outputPerCycle;
                    const hourlyCost = Math.floor(3_600_000 / facility.cycleMs) * facility.operatingCost;
                    const estimatedProfit = hourlyOutput * game.marketPrice - hourlyCost;
                    const payback = estimatedProfit > 0 ? Math.ceil(facility.systemValue / estimatedProfit) : null;
                    return (
                      <article className="panel facility-card" key={facility.id}>
                        <div className="facility-card-head"><div><span className={`status-chip status-${facility.status}`}>{facilityStatusNames[facility.status]}</span><h2>{facility.name}</h2><p>编号 {facility.id.slice(-8)} · 等级 {facility.level}</p></div><div className="facility-output"><strong>{facility.internalGoods}/{facility.internalCapacity}</strong><span>内部商品</span></div></div>
                        <FacilityProgress facility={facility} now={now} />
                        <div className="facility-specs"><span>周期 <strong>{facility.cycleMs / 1000}s</strong></span><span>周期产量 <strong>{facility.outputPerCycle}</strong></span><span>运营费 <strong>¤ {facility.operatingCost}</strong></span><span>累计产量 <strong>{facility.lifetimeOutput}</strong></span><span>参考估值 <strong>¤ {facility.systemValue}</strong></span><span>预计回本 <strong>{payback ? `${payback} 小时` : '--'}</strong></span></div>
                        <div className="facility-actions">
                          {facility.status === 'running' ? <button className="ghost-button" onClick={() => pauseFacility(facility.id)}>暂停生产</button> : null}
                          {['ready', 'paused', 'full', 'insufficient_funds'].includes(facility.status) ? <button onClick={() => startFacility(facility.id)}>启动生产</button> : null}
                          <button className="ghost-button" onClick={() => showResult(collectFacility(facility.id))}>领取商品</button>
                        </div>
                        {['ready', 'paused', 'full', 'insufficient_funds'].includes(facility.status) ? <div className="listing-control"><input type="number" min={Math.ceil(facility.systemValue * 0.5)} max={facility.systemValue * 2} value={listingPrice} onChange={(event: ChangeEvent<HTMLInputElement>) => setListingPrices((current) => ({ ...current, [facility.id]: Number(event.target.value) }))} /><button className="ghost-button" onClick={() => showResult(listFacility(facility.id, listingPrice))}>挂牌出售</button></div> : null}
                        {facility.status === 'listed' && facility.listedOrderId ? <button className="danger-button full-button" onClick={() => cancelFacilityListing(facility.listedOrderId!)}>撤销设施挂牌</button> : null}
                      </article>
                    );
                  })}
                  {game.facilities.length === 0 ? <article className="panel empty-state tall">尚未拥有生产设施。建造一座新设施，或前往市场收购其他玩家的现成资产。</article> : null}
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'assets' ? (
            <section className="page-content">
              <div className="page-heading"><div><p className="eyebrow">Portfolio</p><h1>资产</h1><p>查看财富构成、系统估值和经济资金流。</p></div></div>
              <div className="asset-overview-grid">
                <article className="panel widget allocation-card">
                  <div className="widget-heading"><div><p className="eyebrow">Allocation</p><h2>资产配置</h2></div><strong>¤ {formatCurrency(derived.totalAssets)}</strong></div>
                  <div className="allocation-visual" style={allocationStyle}><div><strong>{cashShare}%</strong><span>现金占比</span></div></div>
                  <div className="allocation-legend"><span><i className="cash-dot" />现金 <strong>{cashShare}%</strong></span><span><i className="commodity-dot" />商品 <strong>{commodityShare}%</strong></span><span><i className="facility-dot" />设施 <strong>{facilityShare}%</strong></span></div>
                </article>

                <article className="panel widget asset-breakdown span-2">
                  <div className="widget-heading"><div><p className="eyebrow">Valuation</p><h2>资产估值明细</h2></div><span className="muted">使用市场参考价和设施系统估值</span></div>
                  <div className="asset-card-grid"><div><span>可用现金</span><strong>¤ {formatCurrency(game.credits)}</strong><small>立即可用于建造和交易</small></div><div><span>冻结资金</span><strong>¤ {formatCurrency(game.frozenCredits)}</strong><small>用于未成交买单</small></div><div><span>商品库存估值</span><strong>¤ {formatCurrency(derived.commodityValue)}</strong><small>{game.inventory + game.frozenInventory} × 参考价 ¤ {game.marketPrice}</small></div><div><span>生产设施估值</span><strong>¤ {formatCurrency(derived.facilityValue)}</strong><small>{game.facilities.length} 座设施及内部商品</small></div></div>
                </article>

                <article className="panel widget">
                  <p className="eyebrow">Economy flow</p><h2>货币发行与回收</h2>
                  <div className="flow-stack"><div><span>工作发行</span><strong className="positive">+¤ {game.stats.workIssued}</strong></div><div><span>人口发行</span><strong className="positive">+¤ {game.stats.populationIssued}</strong></div><div><span>系统回收</span><strong className="negative">-¤ {game.stats.systemSinks}</strong></div><div><span>当前净变化</span><strong>¤ {formatCurrency(game.stats.workIssued + game.stats.populationIssued - game.stats.systemSinks)}</strong></div></div>
                </article>

                <article className="panel widget span-2">
                  <div className="widget-heading"><div><p className="eyebrow">Asset activity</p><h2>最近资产变化</h2></div><button className="text-button" onClick={() => setTab('records')}>完整流水</button></div>
                  <div className="ledger-list compact-ledger">{game.ledger.slice(0, 8).map((entry) => <div key={entry.id}><span className="ledger-time">{formatTime(entry.createdAt)}</span><div><strong>{entry.description}</strong><small>{entry.category}</small></div><span className={entry.amount > 0 ? 'positive' : entry.amount < 0 ? 'negative' : ''}>{entry.amount > 0 ? '+' : ''}{entry.amount ? `¤ ${entry.amount}` : '状态'}</span></div>)}</div>
                </article>
              </div>
            </section>
          ) : null}

          {tab === 'leaderboard' ? (
            <section className="page-content">
              <div className="page-heading"><div><p className="eyebrow">Wealth competition</p><h1>总资产排行榜</h1><p>排行榜按服务器计算的总资产从高到低排序，挂牌溢价不计入估值。</p></div><div className="page-heading-actions"><span>更新于 {formatTime(game.lastProcessedAt)}</span></div></div>
              <div className="rank-summary-grid"><article className="panel rank-summary primary"><span>我的排名</span><strong>#{derived.currentRank?.rank ?? '--'}</strong><small>总资产 ¤ {formatCurrency(derived.totalAssets)}</small></article><article className="panel rank-summary"><span>与上一名差距</span><strong>{derived.previousRank ? `¤ ${formatCurrency(derived.previousRank.totalAssets - derived.totalAssets)}` : '榜首'}</strong><small>{derived.previousRank?.playerName ?? '保持领先'}</small></article><article className="panel rank-summary"><span>本周资产变化</span><strong className={(derived.currentRank?.weeklyChange ?? 0) >= 0 ? 'positive' : 'negative'}>{(derived.currentRank?.weeklyChange ?? 0) >= 0 ? '+' : ''}¤ {formatCurrency(derived.currentRank?.weeklyChange ?? 0)}</strong><small>基于当前预览周期</small></article></div>
              <article className="panel leaderboard-card">
                <div className="table-wrap"><table className="leaderboard-table"><thead><tr><th>排名</th><th>玩家</th><th>总资产</th><th>现金资产</th><th>生产设施</th><th>本周变化</th><th>更新时间</th></tr></thead><tbody>{game.leaderboard.map((entry) => <tr key={`${entry.playerName}-${entry.rank}`} className={entry.isCurrentPlayer ? 'current-player-row' : ''}><td><span className={`rank-number rank-${entry.rank}`}>{entry.rank}</span></td><td><strong>{entry.playerName}</strong>{entry.isCurrentPlayer ? <small className="you-label">你</small> : null}</td><td><strong>¤ {formatCurrency(entry.totalAssets)}</strong></td><td>¤ {formatCurrency(entry.cashAssets)}</td><td>{entry.facilityCount}</td><td className={entry.weeklyChange >= 0 ? 'positive' : 'negative'}>{entry.weeklyChange >= 0 ? '+' : ''}¤ {formatCurrency(entry.weeklyChange)}</td><td>{formatTime(entry.updatedAt)}</td></tr>)}</tbody></table></div>
              </article>
            </section>
          ) : null}

          {tab === 'records' ? (
            <section className="page-content">
              <div className="page-heading"><div><p className="eyebrow">Orders and records</p><h1>订单与记录</h1><p>统一查看当前订单、历史成交和资金资产流水。</p></div></div>
              <div className="records-grid">
                <article className="panel widget span-2">
                  <div className="widget-heading"><div><p className="eyebrow">Open orders</p><h2>当前商品订单</h2></div><span>{derived.ownOpenOrders.length}/{economyConstants.maxOpenOrders}</span></div>
                  <div className="table-wrap"><table><thead><tr><th>方向</th><th>限价</th><th>剩余/原始</th><th>状态</th><th>提交时间</th><th /></tr></thead><tbody>{derived.ownOpenOrders.map((order) => <tr key={order.id}><td><span className={order.side === 'buy' ? 'side-buy' : 'side-sell'}>{order.side === 'buy' ? '买入' : '卖出'}</span></td><td>¤ {order.price}</td><td>{order.remaining}/{order.quantity}</td><td>{orderStatusNames[order.status]}</td><td>{formatTime(order.createdAt)}</td><td><button className="table-button" onClick={() => cancelOrder(order.id)}>撤单</button></td></tr>)}{derived.ownOpenOrders.length === 0 ? <tr><td colSpan={6} className="empty-cell">暂无未完成商品订单。</td></tr> : null}</tbody></table></div>
                </article>
                <article className="panel widget"><p className="eyebrow">Frozen assets</p><h2>冻结资产</h2><div className="frozen-cards"><div><span>买单冻结资金</span><strong>¤ {game.frozenCredits}</strong></div><div><span>卖单冻结库存</span><strong>{game.frozenInventory}</strong></div><div><span>设施挂牌</span><strong>{derived.ownListings.length}</strong></div></div></article>
                <article className="panel widget span-3"><div className="widget-heading"><div><p className="eyebrow">Trade history</p><h2>成交记录</h2></div><span>{game.trades.length} 笔</span></div><div className="table-wrap"><table><thead><tr><th>资产</th><th>方向</th><th>数量</th><th>价格</th><th>总额</th><th>对手方</th><th>时间</th></tr></thead><tbody>{game.trades.map((trade) => <tr key={trade.id}><td>{trade.type === 'facility' ? trade.description : game.commodityName}</td><td><span className={trade.side === 'buy' ? 'side-buy' : 'side-sell'}>{trade.side === 'buy' ? '买入' : '卖出'}</span></td><td>{trade.quantity}</td><td>¤ {trade.price}</td><td>¤ {trade.total}</td><td>{trade.counterparty}</td><td>{formatTime(trade.createdAt)}</td></tr>)}{game.trades.length === 0 ? <tr><td colSpan={7} className="empty-cell">暂无成交记录。</td></tr> : null}</tbody></table></div></article>
                <article className="panel widget span-3"><div className="widget-heading"><div><p className="eyebrow">Audit ledger</p><h2>资产流水</h2></div><span className="muted">资金、库存与产权变化均可追溯</span></div><div className="ledger-list">{game.ledger.map((entry) => <div key={entry.id}><span className="ledger-time">{formatTime(entry.createdAt)}</span><div><strong>{entry.description}</strong><small>{entry.category}</small></div><span className={entry.amount > 0 ? 'positive' : entry.amount < 0 ? 'negative' : ''}>{entry.amount > 0 ? '+' : ''}{entry.amount ? `¤ ${entry.amount}` : '状态'}</span><small>余额 ¤ {entry.balanceAfter}</small></div>)}</div></article>
              </div>
            </section>
          ) : null}

          {tab === 'settings' ? (
            <section className="page-content">
              <div className="page-heading"><div><p className="eyebrow">Preferences</p><h1>设置</h1><p>管理玩家资料、显示偏好和本地预览数据。</p></div></div>
              <div className="settings-grid">
                <article className="panel widget">
                  <p className="eyebrow">Player profile</p><h2>玩家资料</h2>
                  <div className="profile-card"><div className="profile-avatar">{avatarText}</div><div><strong>{game.playerName}</strong><span>{user.email}</span><small>注册于 {formatDate(game.registeredAt)}</small></div></div>
                  <label>玩家昵称<input value={playerName} maxLength={32} onChange={(event: ChangeEvent<HTMLInputElement>) => setPlayerName(event.target.value)} /></label>
                  <button onClick={() => { renamePlayer(playerName); setNotice('玩家昵称已更新'); }}>保存玩家昵称</button>
                  <a className="link-button" href="https://riversoft.top/profile">前往主页修改账号资料</a>
                </article>

                <article className="panel widget">
                  <p className="eyebrow">Game settings</p><h2>游戏设置</h2>
                  <div className="setting-row"><div><strong>界面音效</strong><span>订单成交与生产完成提示</span></div><input className="toggle-input" type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} /></div>
                  <div className="setting-row"><div><strong>紧凑数字</strong><span>使用 K / M 缩写显示大额资产</span></div><input className="toggle-input" type="checkbox" checked={compactNumbers} onChange={(event) => setCompactNumbers(event.target.checked)} /></div>
                  <label>市场刷新频率<select value={refreshRate} onChange={(event) => setRefreshRate(event.target.value)}><option value="1">每 1 秒</option><option value="3">每 3 秒</option><option value="5">每 5 秒</option></select></label>
                  <label>画面性能<select defaultValue="balanced"><option value="quality">高质量</option><option value="balanced">平衡</option><option value="performance">高性能</option></select></label>
                </article>

                <article className="panel widget account-summary">
                  <p className="eyebrow">Account status</p><h2>账号与资产</h2>
                  <dl className="detail-list"><div><dt>账号 ID</dt><dd>{user.id}</dd></div><div><dt>账号角色</dt><dd>{user.role || 'user'}</dd></div><div><dt>设施槽位</dt><dd>{game.facilitySlots}</dd></div><div><dt>库存容量</dt><dd>{game.inventoryCapacity}</dd></div><div><dt>当前排名</dt><dd>#{derived.currentRank?.rank ?? '--'}</dd></div></dl>
                  <button className="ghost-button" onClick={() => void signOut()}>退出登录</button>
                </article>

                <article className="panel widget danger-zone span-3">
                  <div><p className="eyebrow">Preview data</p><h2>重置本地经济状态</h2><p>当前版本使用浏览器本地数据预览多人经济规则。重置不会影响你的主页账号。</p></div>
                  <button className="danger-button" onClick={() => { if (window.confirm('确认重置当前账号的金融帝国预览状态？')) reset(user); }}>重置经济状态</button>
                </article>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch((reason) => setAuthError(reason instanceof Error ? reason.message : '账号服务不可用'))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <main className="loading-screen">正在连接统一账号服务…</main>;
  if (!user) return <><LoginPage onAuthenticated={setUser} />{authError ? <div className="auth-service-warning">{authError}。请确认服务器已启用金融帝国账号代理。</div> : null}</>;
  return <GameApp user={user} onSignedOut={() => setUser(null)} />;
}

export default App;
