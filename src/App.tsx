import { useMemo, useState } from 'react';
import type { Inventory, ResourceId, TradeOffer } from './types';
import { resources, resourceNames, useGameStore } from './store/gameStore';
import { isSoundEnabled, playSfx, setSoundEnabled } from './utils/audio';

function formatItems(items: Partial<Inventory>) {
  const text = resources
    .filter((resource) => (items[resource] ?? 0) > 0)
    .map((resource) => `${resourceNames[resource]}×${items[resource]}`)
    .join('、');
  return text || '无资源';
}

function formatOffer(offer: TradeOffer) {
  return `给 ${formatItems(offer.giveItems)} + ${offer.giveCredits} 信用点，换 ${formatItems(offer.receiveItems)} + ${offer.receiveCredits} 信用点`;
}

function App() {
  const {
    state,
    createNewGame,
    buyResource,
    proposeTrade,
    acceptTrade,
    rejectTrade,
    completeContract,
    advanceRound,
    saveGame,
    loadGame,
  } = useGameStore();

  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const human = state.players.find((player) => player.isHuman) ?? state.players[0];
  const aiPlayers = state.players.filter((player) => !player.isHuman);
  const [targetId, setTargetId] = useState(aiPlayers[0]?.id ?? '');
  const [buyAmount, setBuyAmount] = useState(1);
  const [giveResource, setGiveResource] = useState<ResourceId>('grain');
  const [receiveResource, setReceiveResource] = useState<ResourceId>('ore');
  const [giveQty, setGiveQty] = useState(1);
  const [receiveQty, setReceiveQty] = useState(1);
  const [giveCredits, setGiveCredits] = useState(0);
  const [receiveCredits, setReceiveCredits] = useState(0);

  const pendingToHuman = useMemo(
    () => state.tradeOffers.filter((offer) => offer.status === 'pending' && offer.toPlayerId === human.id),
    [state.tradeOffers, human.id],
  );
  const pendingFromHuman = useMemo(
    () => state.tradeOffers.filter((offer) => offer.status === 'pending' && offer.fromPlayerId === human.id),
    [state.tradeOffers, human.id],
  );
  const winner = state.players.find((player) => player.id === state.winnerId);

  function toggleSound() {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) playSfx('click');
  }

  function submitTrade() {
    const giveItems: Partial<Inventory> = giveQty > 0 ? { [giveResource]: giveQty } : {};
    const receiveItems: Partial<Inventory> = receiveQty > 0 ? { [receiveResource]: receiveQty } : {};

    proposeTrade({
      fromPlayerId: human.id,
      toPlayerId: targetId,
      giveCredits,
      receiveCredits,
      giveItems,
      receiveItems,
      message: '玩家发起的资源交易。',
    });
  }

  return (
    <main className="app-shell">
      <header className="hero panel">
        <div>
          <p className="eyebrow">Economy Arena / 经济竞技场</p>
          <h1>回合制经济策略游戏</h1>
          <p className="subtitle">经营资源、观察市场、向 AI 商人报价，完成合同并率先达到 {state.targetReputation} 声望。</p>
        </div>
        <div className="hero-actions">
          <button onClick={advanceRound} disabled={state.phase === 'finished'}>结束回合</button>
          <button onClick={() => void saveGame()}>保存</button>
          <button onClick={() => void loadGame()}>读取</button>
          <button onClick={createNewGame}>新游戏</button>
          <button className="ghost-button" onClick={toggleSound}>{soundOn ? '音效开' : '音效关'}</button>
        </div>
      </header>

      {winner ? (
        <section className="winner-banner panel">
          🏆 胜者：<strong>{winner.name}</strong>，声望 {winner.reputation}，信用点 {winner.credits}
        </section>
      ) : null}

      <section className="status-grid">
        <div className="stat-card panel"><span>回合</span><strong>{state.round} / {state.maxRounds}</strong></div>
        <div className="stat-card panel"><span>阶段</span><strong>{state.phase}</strong></div>
        <div className="stat-card panel"><span>你的信用点</span><strong>{human.credits}</strong></div>
        <div className="stat-card panel"><span>你的声望</span><strong>{human.reputation}</strong></div>
      </section>

      <section className="game-grid">
        <aside className="panel player-panel">
          <div className="panel-heading">
            <p className="eyebrow">Players</p>
            <h2>玩家资产</h2>
          </div>
          <div className="player-list">
            {state.players.map((player) => (
              <article className={player.isHuman ? 'player-card active' : 'player-card'} key={player.id}>
                <div className="player-head">
                  <strong>{player.name}</strong>
                  <span>{player.strategy}</span>
                </div>
                <div className="mini-stats">
                  <span>💳 {player.credits}</span>
                  <span>⭐ {player.reputation}</span>
                  <span>📜 {player.contractsCompleted}</span>
                </div>
                <div className="inventory-row">
                  {resources.map((resource) => (
                    <span key={resource}>{resourceNames[resource]} {player.inventory[resource]}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section className="panel market-panel">
          <div className="panel-heading">
            <p className="eyebrow">Market</p>
            <h2>市场买入</h2>
          </div>
          <label className="inline-control">
            数量
            <input type="number" min="1" value={buyAmount} onChange={(event) => setBuyAmount(Number(event.target.value))} />
          </label>
          <div className="market-list">
            {state.market.map((item) => (
              <article className="market-card" key={item.id}>
                <div>
                  <strong>{item.icon} {item.name}</strong>
                  <span className={item.trend > 0 ? 'trend up' : item.trend < 0 ? 'trend down' : 'trend'}>
                    {item.trend > 0 ? `+${item.trend}` : item.trend}
                  </span>
                </div>
                <p>{item.price} 信用点 / 份</p>
                <button onClick={() => buyResource(item.id, buyAmount)}>买入</button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel trade-panel">
          <div className="panel-heading">
            <p className="eyebrow">Trade</p>
            <h2>游戏内交易</h2>
          </div>

          <div className="trade-form">
            <label>
              交易对象
              <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                {aiPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
              </select>
            </label>
            <div className="form-grid">
              <label>
                我给资源
                <select value={giveResource} onChange={(event) => setGiveResource(event.target.value as ResourceId)}>
                  {resources.map((resource) => <option key={resource} value={resource}>{resourceNames[resource]}</option>)}
                </select>
              </label>
              <label>
                数量
                <input type="number" min="0" value={giveQty} onChange={(event) => setGiveQty(Number(event.target.value))} />
              </label>
              <label>
                我给信用点
                <input type="number" min="0" value={giveCredits} onChange={(event) => setGiveCredits(Number(event.target.value))} />
              </label>
            </div>
            <div className="form-grid">
              <label>
                想要资源
                <select value={receiveResource} onChange={(event) => setReceiveResource(event.target.value as ResourceId)}>
                  {resources.map((resource) => <option key={resource} value={resource}>{resourceNames[resource]}</option>)}
                </select>
              </label>
              <label>
                数量
                <input type="number" min="0" value={receiveQty} onChange={(event) => setReceiveQty(Number(event.target.value))} />
              </label>
              <label>
                想要信用点
                <input type="number" min="0" value={receiveCredits} onChange={(event) => setReceiveCredits(Number(event.target.value))} />
              </label>
            </div>
            <button className="wide-button" onClick={submitTrade} disabled={!targetId || state.phase === 'finished'}>发起交易</button>
          </div>

          <div className="offer-zone">
            <h3>待你处理</h3>
            {pendingToHuman.length === 0 ? <p className="muted">暂无 AI 报价。</p> : null}
            {pendingToHuman.map((offer) => {
              const from = state.players.find((player) => player.id === offer.fromPlayerId);
              return (
                <article className="offer-card" key={offer.id}>
                  <strong>{from?.name ?? '未知商人'}</strong>
                  <p>{offer.message || formatOffer(offer)}</p>
                  <small>{formatOffer(offer)}</small>
                  <div>
                    <button onClick={() => acceptTrade(offer.id)}>接受</button>
                    <button className="ghost-button" onClick={() => rejectTrade(offer.id)}>拒绝</button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="offer-zone">
            <h3>等待 AI 回复</h3>
            {pendingFromHuman.length === 0 ? <p className="muted">暂无待回复报价；结束回合后 AI 会评估。</p> : null}
            {pendingFromHuman.map((offer) => {
              const to = state.players.find((player) => player.id === offer.toPlayerId);
              return <p className="pending-line" key={offer.id}>{to?.name}：{formatOffer(offer)}</p>;
            })}
          </div>
        </section>

        <section className="panel contract-panel">
          <div className="panel-heading">
            <p className="eyebrow">Contracts</p>
            <h2>合同目标</h2>
          </div>
          <div className="contract-list">
            {state.contracts.map((contract) => (
              <article className="contract-card" key={contract.id}>
                <div>
                  <strong>{contract.title}</strong>
                  <p>{contract.description}</p>
                  <small>需求：{formatItems(contract.requirements)} · 奖励：{contract.rewardCredits} 信用点 / {contract.rewardReputation} 声望</small>
                </div>
                <button onClick={() => completeContract(contract.id)} disabled={state.phase === 'finished'}>交付</button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel log-panel">
          <div className="panel-heading">
            <p className="eyebrow">Log</p>
            <h2>事件日志</h2>
          </div>
          <div className="log-list">
            {state.log.map((entry) => (
              <p className={`log-entry ${entry.tone}`} key={entry.id}><span>R{entry.round}</span>{entry.text}</p>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
