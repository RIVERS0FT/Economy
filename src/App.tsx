import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, login, logout } from './api/auth';
import { economyConstants, useGameStore } from './store/gameStore';
import type { AuthUser, Factory, FactoryStatus, OrderStatus } from './types';

const tabs = [
  ['overview', '总览'],
  ['work', '工作'],
  ['factories', '工厂'],
  ['market', '统一市场'],
  ['orders', '订单与成交'],
  ['assets', '资产流水'],
  ['company', '企业'],
] as const;

type TabId = (typeof tabs)[number][0];

const factoryStatusNames: Record<FactoryStatus, string> = {
  constructing: '施工中',
  ready: '待启用',
  running: '生产中',
  paused: '已暂停',
  full: '成品已满',
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
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
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

function formatDuration(ms: number) {
  if (ms <= 0) return '已完成';
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}分${seconds.toString().padStart(2, '0')}秒` : `${seconds}秒`;
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
        <a className="brand-lockup" href="https://riversoft.top/" aria-label="返回 RIVERSOFT 主页">
          <img src="https://riversoft.top/1000002880.png" alt="RIVERSOFT" />
          <span>RIVERSOFT</span>
        </a>
        <p className="eyebrow">Shared account economy game</p>
        <h1>用主页账号进入<br />你的经济帝国</h1>
        <p>
          同一 RIVERSOFT 账号用于主页与 Economy。登录后可以经营工厂、参与统一订单簿，并追踪企业资产流水。
        </p>
        <div className="login-feature-grid">
          <span>点击工作发行启动货币</span>
          <span>工厂施工与周期生产</span>
          <span>商品限价订单簿</span>
          <span>工厂固定价产权交易</span>
        </div>
      </section>

      <section className="login-card panel">
        <p className="eyebrow">Account login</p>
        <h2>登录 Economy</h2>
        <p className="muted">请输入你在 riversoft.top 注册的邮箱和密码。</p>
        <form onSubmit={submit} className="login-form">
          <label>
            主页账号邮箱
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
            />
          </label>
          <label>
            密码
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
              placeholder="至少 8 位"
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={submitting}>{submitting ? '正在连接账号服务…' : '登录并进入企业'}</button>
        </form>
        <div className="login-links">
          <a href="https://riversoft.top/register">没有账号？前往主页注册</a>
          <a href="https://riversoft.top/login">在主页管理登录</a>
        </div>
        <small>账号认证由 RIVERSOFT 主页服务器处理，Economy 不保存你的密码。</small>
      </section>
    </main>
  );
}

function FactoryProgress({ factory, now }: { factory: Factory; now: number }) {
  let progress = 0;
  let detail = factoryStatusNames[factory.status];

  if (factory.status === 'constructing' && factory.constructionCompletesAt) {
    const remaining = factory.constructionCompletesAt - now;
    progress = Math.max(0, Math.min(100, 100 - (remaining / economyConstants.buildTimeMs) * 100));
    detail = `剩余 ${formatDuration(remaining)}`;
  } else if (factory.status === 'running' && factory.cycleStartedAt) {
    const elapsed = now - factory.cycleStartedAt;
    progress = Math.max(0, Math.min(100, (elapsed / factory.cycleMs) * 100));
    detail = `本周期 ${formatDuration(factory.cycleMs - elapsed)}`;
  } else if (factory.status === 'full') {
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
    buildFactory,
    startFactory,
    pauseFactory,
    collectFactory,
    listFactory,
    cancelFactoryListing,
    buyFactory,
    placeCommodityOrder,
    cancelOrder,
    renameCompany,
  } = useGameStore();
  const [tab, setTab] = useState<TabId>('overview');
  const [notice, setNotice] = useState('');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(7);
  const [listingPrices, setListingPrices] = useState<Record<string, number>>({});
  const [companyName, setCompanyName] = useState('');
  const now = Date.now();

  useEffect(() => {
    initialize(user);
  }, [initialize, user]);

  useEffect(() => {
    const timer = window.setInterval(process, 1_000);
    const handleStorage = (event: StorageEvent) => {
      if (event.key?.endsWith(`:${user.id}`)) reloadFromStorage(user.id);
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', handleStorage);
    };
  }, [process, reloadFromStorage, user.id]);

  useEffect(() => {
    if (game) setCompanyName(game.companyName);
  }, [game?.companyName]);

  const derived = useMemo(() => {
    if (!game) return null;
    const openOrders = game.orders.filter((order) => order.ownerId === game.userId && ['open', 'partial'].includes(order.status));
    const ownListings = game.factoryListings.filter((listing) => listing.ownerId === game.userId);
    const bids = game.orders
      .filter((order) => order.side === 'buy' && ['open', 'partial'].includes(order.status))
      .sort((a, b) => b.price - a.price || a.createdAt - b.createdAt);
    const asks = game.orders
      .filter((order) => order.side === 'sell' && ['open', 'partial'].includes(order.status))
      .sort((a, b) => a.price - b.price || a.createdAt - b.createdAt);
    const factoryValue = game.factories.reduce((sum, factory) => sum + factory.systemValue, 0);
    const totalAssets = game.credits + game.frozenCredits + (game.inventory + game.frozenInventory) * game.marketPrice + factoryValue;
    return { openOrders, ownListings, bids, asks, factoryValue, totalAssets };
  }, [game]);

  if (!game || !derived) {
    return <main className="loading-screen">正在恢复企业资产与市场状态…</main>;
  }

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
  const warehouseUsed = game.inventory + game.frozenInventory;

  return (
    <main className="app-shell">
      <header className="topbar panel">
        <div className="brand-lockup compact">
          <img src="https://riversoft.top/1000002880.png" alt="RIVERSOFT" />
          <div><span>RIVERSOFT</span><small>Economy / 经济模拟</small></div>
        </div>
        <div className="account-area">
          <span className="authority-badge">主页账号已连接</span>
          <div className="account-copy"><strong>{user.name || user.email}</strong><small>{game.companyName}</small></div>
          <button className="ghost-button" onClick={() => void signOut()}>退出</button>
        </div>
      </header>

      <section className="dashboard-head">
        <div>
          <p className="eyebrow">Unified economy market</p>
          <h1>{game.companyName}</h1>
          <p>工作获得启动资金，建造或收购工厂，并在统一市场与玩家及城市人口成交。</p>
        </div>
        <div className="server-status">
          <span className="status-dot" />
          <div><strong>账号服务器在线</strong><small>经济 MVP 当前使用账号隔离的浏览器预览状态</small></div>
        </div>
      </section>

      <nav className="main-nav panel" aria-label="游戏主导航">
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? 'nav-button active' : 'nav-button'} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {notice ? <div className="notice-toast">{notice}</div> : null}

      <section className="metric-grid">
        <article className="metric-card panel"><span>可用资金</span><strong>¤ {formatCurrency(game.credits)}</strong><small>冻结 ¤ {formatCurrency(game.frozenCredits)}</small></article>
        <article className="metric-card panel"><span>{game.commodityName}库存</span><strong>{game.inventory}</strong><small>冻结 {game.frozenInventory} · 仓库 {warehouseUsed}/{game.warehouseCapacity}</small></article>
        <article className="metric-card panel"><span>工厂产权</span><strong>{game.factories.length}/{game.factorySlots}</strong><small>系统估值 ¤ {formatCurrency(derived.factoryValue)}</small></article>
        <article className="metric-card panel"><span>企业总资产</span><strong>¤ {formatCurrency(derived.totalAssets)}</strong><small>按最近成交价估值</small></article>
      </section>

      {tab === 'overview' ? (
        <section className="content-grid overview-grid">
          <article className="panel section-card span-2">
            <div className="section-heading"><div><p className="eyebrow">Enterprise pulse</p><h2>企业运行总览</h2></div><button onClick={() => setTab('work')}>去工作</button></div>
            <div className="overview-actions">
              <div><span>工作冷却</span><strong>{workRemaining > 0 ? formatDuration(workRemaining) : '可以工作'}</strong></div>
              <div><span>当前市场价</span><strong>¤ {game.marketPrice}</strong></div>
              <div><span>未完成订单</span><strong>{derived.openOrders.length}/{economyConstants.maxOpenOrders}</strong></div>
              <div><span>人口需求周期</span><strong>{formatDuration(game.population.nextDemandAt - now)}</strong></div>
            </div>
          </article>

          <article className="panel section-card">
            <div className="section-heading"><div><p className="eyebrow">Population</p><h2>城市消费</h2></div></div>
            <div className="population-orb"><strong>{formatCurrency(game.population.population)}</strong><span>聚合人口</span></div>
            <dl className="detail-list">
              <div><dt>上期预算</dt><dd>¤ {game.population.lastBudget}</dd></div>
              <div><dt>目标数量</dt><dd>{game.population.lastQuantity}</dd></div>
              <div><dt>承受价格</dt><dd>¤ {game.population.lastPrice}</dd></div>
              <div><dt>需求满足率</dt><dd>{Math.round(game.population.satisfaction * 100)}%</dd></div>
            </dl>
          </article>

          <article className="panel section-card span-2">
            <div className="section-heading"><div><p className="eyebrow">Factories</p><h2>施工与生产</h2></div><button className="ghost-button" onClick={() => setTab('factories')}>管理工厂</button></div>
            {game.factories.length === 0 ? <div className="empty-state">尚未拥有工厂。自建需要 ¤ {economyConstants.buildCost}，也可以在统一市场收购现成工厂。</div> : (
              <div className="compact-factory-list">
                {game.factories.map((factory) => (
                  <div className="compact-factory" key={factory.id}>
                    <div><strong>{factory.name}</strong><span>{factoryStatusNames[factory.status]} · 内部成品 {factory.internalGoods}/{factory.internalCapacity}</span></div>
                    <FactoryProgress factory={factory} now={now} />
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="panel section-card">
            <div className="section-heading"><div><p className="eyebrow">Recent trades</p><h2>最近成交</h2></div></div>
            <div className="activity-list">
              {game.trades.slice(0, 5).map((trade) => <div key={trade.id}><span>{trade.description}</span><strong>{trade.side === 'buy' ? '-' : '+'}¤ {trade.total}</strong></div>)}
              {game.trades.length === 0 ? <p className="muted">暂无成交记录。</p> : null}
            </div>
          </article>
        </section>
      ) : null}

      {tab === 'work' ? (
        <section className="content-grid work-grid">
          <article className="panel work-console">
            <p className="eyebrow">Click work</p>
            <h2>点击工作</h2>
            <p>每次有效工作获得 1 货币。连续工作会将冷却提高到 3、5、8、12 秒；停止 5 分钟后恢复基础冷却。</p>
            <button className="work-button" disabled={workRemaining > 0} onClick={() => showResult(work())}>
              <span>{workRemaining > 0 ? formatDuration(workRemaining) : '工作'}</span>
              <small>{workRemaining > 0 ? '等待服务器冷却窗口' : '获得 ¤ 1'}</small>
            </button>
            <div className="work-stats">
              <div><span>连续工作档位</span><strong>{game.work.streak || 0}/4</strong></div>
              <div><span>累计有效工作</span><strong>{game.work.totalClicks}</strong></div>
              <div><span>工作发行货币</span><strong>¤ {game.stats.workIssued}</strong></div>
            </div>
          </article>
          <article className="panel section-card">
            <p className="eyebrow">Rules</p><h2>工作规则</h2>
            <ul className="rule-list">
              <li>冷却期间重复点击不会重复发放货币。</li>
              <li>刷新页面与多标签页会恢复同一账号的预览状态。</li>
              <li>点击只负责启动和兜底，工厂经营是长期收益来源。</li>
              <li>正式多人版本将由服务器确认每次点击和冷却。</li>
            </ul>
          </article>
        </section>
      ) : null}

      {tab === 'factories' ? (
        <section className="content-grid factory-grid">
          <article className="panel section-card build-card">
            <p className="eyebrow">Build factory</p><h2>自建基础工厂</h2>
            <dl className="detail-list">
              <div><dt>建造费用</dt><dd>¤ {economyConstants.buildCost}</dd></div>
              <div><dt>施工时间</dt><dd>5 分钟</dd></div>
              <div><dt>生产周期</dt><dd>30 秒</dd></div>
              <div><dt>周期产量</dt><dd>1 个{game.commodityName}</dd></div>
              <div><dt>运营费用</dt><dd>¤ 1 / 周期</dd></div>
              <div><dt>内部容量</dt><dd>20</dd></div>
            </dl>
            <button onClick={() => showResult(buildFactory())} disabled={game.factories.length >= game.factorySlots}>开始施工</button>
            <small className="muted">槽位 {game.factories.length}/{game.factorySlots} · 同时施工上限 1</small>
          </article>

          <div className="factory-list span-2">
            {game.factories.map((factory) => {
              const listingPrice = listingPrices[factory.id] ?? factory.systemValue;
              return (
                <article className="panel factory-card" key={factory.id}>
                  <div className="factory-card-head">
                    <div><span className={`status-chip status-${factory.status}`}>{factoryStatusNames[factory.status]}</span><h2>{factory.name}</h2><p>编号 {factory.id.slice(-8)} · 等级 {factory.level} · 估值 ¤ {factory.systemValue}</p></div>
                    <div className="factory-output"><strong>{factory.internalGoods}/{factory.internalCapacity}</strong><span>内部成品</span></div>
                  </div>
                  <FactoryProgress factory={factory} now={now} />
                  <div className="factory-specs">
                    <span>周期 {factory.cycleMs / 1000}s</span><span>产量 {factory.outputPerCycle}</span><span>费用 ¤ {factory.operatingCost}</span><span>累计 {factory.lifetimeOutput}</span>
                  </div>
                  <div className="factory-actions">
                    {factory.status === 'running' ? <button className="ghost-button" onClick={() => pauseFactory(factory.id)}>暂停</button> : null}
                    {['ready', 'paused', 'full', 'insufficient_funds'].includes(factory.status) ? <button onClick={() => startFactory(factory.id)}>启动生产</button> : null}
                    <button className="ghost-button" onClick={() => showResult(collectFactory(factory.id))}>领取成品</button>
                  </div>
                  {['ready', 'paused', 'full', 'insufficient_funds'].includes(factory.status) ? (
                    <div className="listing-control">
                      <input type="number" min={Math.ceil(factory.systemValue * 0.5)} max={factory.systemValue * 2} value={listingPrice} onChange={(event: ChangeEvent<HTMLInputElement>) => setListingPrices((current) => ({ ...current, [factory.id]: Number(event.target.value) }))} />
                      <button className="ghost-button" onClick={() => showResult(listFactory(factory.id, listingPrice))}>挂牌出售</button>
                    </div>
                  ) : null}
                  {factory.status === 'listed' && factory.listedOrderId ? <button className="danger-button" onClick={() => cancelFactoryListing(factory.listedOrderId!)}>撤销挂牌</button> : null}
                </article>
              );
            })}
            {game.factories.length === 0 ? <article className="panel empty-state tall">你还没有工厂。可以自建，也可以前往统一市场即时收购其他企业的现成工厂。</article> : null}
          </div>
        </section>
      ) : null}

      {tab === 'market' ? (
        <section className="content-grid market-grid">
          <article className="panel section-card order-entry">
            <p className="eyebrow">Limit order</p><h2>{game.commodityName}限价订单</h2>
            <div className="segmented">
              <button className={orderSide === 'buy' ? 'active' : ''} onClick={() => setOrderSide('buy')}>买入</button>
              <button className={orderSide === 'sell' ? 'active' : ''} onClick={() => setOrderSide('sell')}>卖出</button>
            </div>
            <label>数量<input type="number" min="1" value={orderQuantity} onChange={(event: ChangeEvent<HTMLInputElement>) => setOrderQuantity(Number(event.target.value))} /></label>
            <label>限价<input type="number" min="1" value={orderPrice} onChange={(event: ChangeEvent<HTMLInputElement>) => setOrderPrice(Number(event.target.value))} /></label>
            <div className="order-summary"><span>最大金额</span><strong>¤ {formatCurrency(orderQuantity * orderPrice)}</strong></div>
            <button onClick={() => showResult(placeCommodityOrder(orderSide, orderQuantity, orderPrice))}>提交{orderSide === 'buy' ? '买单' : '卖单'}</button>
            <small>价格优先，同价按确认时间优先；允许部分成交。</small>
          </article>

          <article className="panel section-card order-book span-2">
            <div className="section-heading"><div><p className="eyebrow">Order book</p><h2>统一商品订单簿</h2></div><div className="last-price"><span>最近成交</span><strong>¤ {game.marketPrice}</strong></div></div>
            <div className="book-columns">
              <div><h3>买单</h3>{derived.bids.slice(0, 8).map((order) => <div className="book-row bid" key={order.id}><span>¤ {order.price}</span><span>{order.remaining}/{order.quantity}</span><small>{order.ownerName}</small></div>)}</div>
              <div><h3>卖单</h3>{derived.asks.slice(0, 8).map((order) => <div className="book-row ask" key={order.id}><span>¤ {order.price}</span><span>{order.remaining}/{order.quantity}</span><small>{order.ownerName}</small></div>)}</div>
            </div>
          </article>

          <article className="panel section-card span-3">
            <div className="section-heading"><div><p className="eyebrow">Factory market</p><h2>工厂产权挂牌</h2></div><span className="muted">固定价即时交割 · 数量固定为 1</span></div>
            <div className="listing-grid">
              {game.factoryListings.map((listing) => (
                <article className="listing-card" key={listing.id}>
                  <div><span className={listing.ownerId === game.userId ? 'status-chip status-listed' : 'status-chip'}>{listing.ownerId === game.userId ? '我的挂牌' : '可收购'}</span><h3>{listing.factory.name}</h3><p>{listing.ownerName} · 等级 {listing.factory.level}</p></div>
                  <div className="listing-specs"><span>周期 {listing.factory.cycleMs / 1000}s</span><span>容量 {listing.factory.internalCapacity}</span><span>累计产量 {listing.factory.lifetimeOutput}</span><span>系统估值 ¤ {listing.factory.systemValue}</span></div>
                  <div className="listing-price"><strong>¤ {listing.price}</strong>{listing.ownerId === game.userId ? <button className="danger-button" onClick={() => cancelFactoryListing(listing.id)}>撤销</button> : <button onClick={() => showResult(buyFactory(listing.id))}>即时收购</button>}</div>
                </article>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {tab === 'orders' ? (
        <section className="content-grid orders-grid">
          <article className="panel section-card span-2">
            <div className="section-heading"><div><p className="eyebrow">Open orders</p><h2>当前订单</h2></div><span>{derived.openOrders.length}/{economyConstants.maxOpenOrders}</span></div>
            <div className="table-wrap"><table><thead><tr><th>类型</th><th>价格</th><th>剩余/原始</th><th>状态</th><th>时间</th><th /></tr></thead><tbody>
              {derived.openOrders.map((order) => <tr key={order.id}><td><span className={order.side === 'buy' ? 'side-buy' : 'side-sell'}>{order.side === 'buy' ? '买入' : '卖出'}</span></td><td>¤ {order.price}</td><td>{order.remaining}/{order.quantity}</td><td>{orderStatusNames[order.status]}</td><td>{formatTime(order.createdAt)}</td><td><button className="table-button" onClick={() => cancelOrder(order.id)}>撤单</button></td></tr>)}
              {derived.openOrders.length === 0 ? <tr><td colSpan={6} className="empty-cell">暂无未完成商品订单。</td></tr> : null}
            </tbody></table></div>
          </article>

          <article className="panel section-card">
            <p className="eyebrow">Frozen assets</p><h2>冻结资产</h2>
            <div className="frozen-cards"><div><span>买单冻结资金</span><strong>¤ {game.frozenCredits}</strong></div><div><span>卖单冻结库存</span><strong>{game.frozenInventory}</strong></div><div><span>工厂挂牌</span><strong>{derived.ownListings.length}</strong></div></div>
          </article>

          <article className="panel section-card span-3">
            <div className="section-heading"><div><p className="eyebrow">Trade history</p><h2>成交记录</h2></div></div>
            <div className="table-wrap"><table><thead><tr><th>资产</th><th>方向</th><th>数量</th><th>价格</th><th>总额</th><th>对手方</th><th>时间</th></tr></thead><tbody>
              {game.trades.map((trade) => <tr key={trade.id}><td>{trade.type === 'factory' ? trade.description : game.commodityName}</td><td><span className={trade.side === 'buy' ? 'side-buy' : 'side-sell'}>{trade.side === 'buy' ? '买入' : '卖出'}</span></td><td>{trade.quantity}</td><td>¤ {trade.price}</td><td>¤ {trade.total}</td><td>{trade.counterparty}</td><td>{formatTime(trade.createdAt)}</td></tr>)}
              {game.trades.length === 0 ? <tr><td colSpan={7} className="empty-cell">暂无成交记录。</td></tr> : null}
            </tbody></table></div>
          </article>
        </section>
      ) : null}

      {tab === 'assets' ? (
        <section className="content-grid assets-grid">
          <article className="panel section-card">
            <p className="eyebrow">Economy statistics</p><h2>货币发行与回收</h2>
            <div className="flow-stack"><div><span>点击工作发行</span><strong className="positive">+¤ {game.stats.workIssued}</strong></div><div><span>人口消费发行</span><strong className="positive">+¤ {game.stats.populationIssued}</strong></div><div><span>系统回收</span><strong className="negative">-¤ {game.stats.systemSinks}</strong></div><div><span>商品成交量</span><strong>{game.stats.commodityVolume}</strong></div><div><span>工厂成交额</span><strong>¤ {game.stats.factoryVolume}</strong></div></div>
          </article>
          <article className="panel section-card span-2">
            <div className="section-heading"><div><p className="eyebrow">Audit ledger</p><h2>资产流水</h2></div><span className="muted">所有资金、库存与产权变化均可追溯</span></div>
            <div className="ledger-list">{game.ledger.map((entry) => <div key={entry.id}><span className="ledger-time">{formatTime(entry.createdAt)}</span><div><strong>{entry.description}</strong><small>{entry.category}</small></div><span className={entry.amount > 0 ? 'positive' : entry.amount < 0 ? 'negative' : ''}>{entry.amount > 0 ? '+' : ''}{entry.amount ? `¤ ${entry.amount}` : '状态'}</span><small>余额 ¤ {entry.balanceAfter}</small></div>)}</div>
          </article>
        </section>
      ) : null}

      {tab === 'company' ? (
        <section className="content-grid company-grid">
          <article className="panel section-card">
            <p className="eyebrow">Shared account</p><h2>主页账号</h2>
            <div className="profile-card"><div className="profile-avatar">{(user.name || user.email).slice(0, 1).toUpperCase()}</div><div><strong>{user.name || '未设置昵称'}</strong><span>{user.email}</span><small>账号 ID {user.id} · {user.role || 'user'}</small></div></div>
            <a className="link-button" href="https://riversoft.top/profile">前往主页修改资料</a>
          </article>
          <article className="panel section-card">
            <p className="eyebrow">Company profile</p><h2>企业资料</h2>
            <label>企业名称<input value={companyName} maxLength={32} onChange={(event: ChangeEvent<HTMLInputElement>) => setCompanyName(event.target.value)} /></label>
            <button onClick={() => { renameCompany(companyName); setNotice('企业名称已更新'); }}>保存企业名称</button>
            <dl className="detail-list"><div><dt>工厂槽位</dt><dd>{game.factorySlots}</dd></div><div><dt>仓库容量</dt><dd>{game.warehouseCapacity}</dd></div><div><dt>基础商品</dt><dd>{game.commodityName}</dd></div></dl>
          </article>
          <article className="panel section-card danger-zone">
            <p className="eyebrow">Preview data</p><h2>重置经济预览</h2>
            <p>当前经济状态按账号保存在此浏览器中。重置不会影响你的主页账号。</p>
            <button className="danger-button" onClick={() => { if (window.confirm('确认重置当前账号的 Economy 预览状态？')) reset(user); }}>重置本地经济状态</button>
          </article>
        </section>
      ) : null}

      <footer className="site-footer">
        <span>Economy MVP · 依据网页端多人经济游戏设计实现</span>
        <a href="https://riversoft.top/">RIVERSOFT 主页</a>
      </footer>
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

  if (checking) return <main className="loading-screen">正在连接 RIVERSOFT 账号服务…</main>;
  if (!user) {
    return <><LoginPage onAuthenticated={setUser} />{authError ? <div className="auth-service-warning">{authError}。请确认服务器已启用 Economy 账号代理。</div> : null}</>;
  }
  return <GameApp user={user} onSignedOut={() => setUser(null)} />;
}

export default App;
