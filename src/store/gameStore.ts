import { create } from 'zustand';
import type { Contract, GameLogEntry, GameState, Inventory, Player, ResourceId, TradeOffer } from '../types';
import { loadGameState, saveGameState } from '../utils/tauri';
import { playSfx } from '../utils/audio';

const resources: ResourceId[] = ['grain', 'ore', 'textile', 'energy'];

const resourceNames: Record<ResourceId, string> = {
  grain: '粮食',
  ore: '矿石',
  textile: '织物',
  energy: '能源',
};

const icons: Record<ResourceId, string> = {
  grain: '🌾',
  ore: '⛏️',
  textile: '🧵',
  energy: '⚡',
};

function emptyInventory(): Inventory {
  return { grain: 0, ore: 0, textile: 0, energy: 0 };
}

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeItems(items: Partial<Inventory>) {
  return resources.reduce<Partial<Inventory>>((acc, resource) => {
    const amount = Math.max(0, Math.floor(items[resource] ?? 0));
    if (amount > 0) acc[resource] = amount;
    return acc;
  }, {});
}

function addLog(state: GameState, text: string, tone: GameLogEntry['tone'] = 'info'): GameState {
  return {
    ...state,
    log: [{ id: id('log'), round: state.round, text, tone }, ...state.log].slice(0, 80),
  };
}

function addItems(inventory: Inventory, items: Partial<Inventory>, sign = 1): Inventory {
  const next = { ...inventory };
  resources.forEach((resource) => {
    next[resource] = Math.max(0, next[resource] + (items[resource] ?? 0) * sign);
  });
  return next;
}

function hasEnough(player: Player, items: Partial<Inventory>, credits = 0) {
  return player.credits >= credits && resources.every((resource) => player.inventory[resource] >= (items[resource] ?? 0));
}

function marketPrice(state: GameState, resource: ResourceId) {
  return state.market.find((item) => item.id === resource)?.price ?? 10;
}

function itemValue(state: GameState, items: Partial<Inventory>) {
  return resources.reduce((sum, resource) => sum + (items[resource] ?? 0) * marketPrice(state, resource), 0);
}

function describeItems(items: Partial<Inventory>) {
  const text = resources
    .filter((resource) => (items[resource] ?? 0) > 0)
    .map((resource) => `${resourceNames[resource]}×${items[resource]}`)
    .join('、');
  return text || '无资源';
}

function createContracts(): Contract[] {
  return [
    {
      id: 'contract-food-grid',
      title: '城市粮网',
      description: '为新城区建立稳定粮食配送。',
      requirements: { grain: 4, energy: 1 },
      rewardCredits: 32,
      rewardReputation: 3,
    },
    {
      id: 'contract-rail-core',
      title: '铁轨核心',
      description: '为运输联盟交付矿石与能源。',
      requirements: { ore: 3, energy: 2 },
      rewardCredits: 38,
      rewardReputation: 4,
    },
    {
      id: 'contract-market-fair',
      title: '市集节庆',
      description: '筹备一场提升声望的物资展销会。',
      requirements: { grain: 2, textile: 3 },
      rewardCredits: 30,
      rewardReputation: 3,
    },
    {
      id: 'contract-power-loom',
      title: '动力织机',
      description: '升级工坊，需要织物与能源。',
      requirements: { textile: 2, energy: 3 },
      rewardCredits: 42,
      rewardReputation: 4,
    },
  ];
}

function createPlayer(index: number, isHuman = false): Player {
  const strategies: Player['strategy'][] = ['balanced', 'aggressive', 'collector', 'merchant'];
  return {
    id: isHuman ? 'player-human' : `player-ai-${index}`,
    name: isHuman ? '你' : ['红杉商会', '蓝港财团', '金穗联盟', '黑曜工坊'][index - 1] ?? `AI 商人 ${index}`,
    isHuman,
    credits: isHuman ? 72 : 64 + index * 5,
    reputation: 0,
    inventory: {
      grain: isHuman ? 2 : index % 2 === 0 ? 1 : 3,
      ore: isHuman ? 1 : index % 2 === 0 ? 3 : 1,
      textile: isHuman ? 2 : 2,
      energy: isHuman ? 1 : index === 3 ? 3 : 1,
    },
    contractsCompleted: 0,
    strategy: isHuman ? 'balanced' : strategies[index % strategies.length],
  };
}

function createInitialState(aiPlayers = 3): GameState {
  const players = [createPlayer(0, true), ...Array.from({ length: aiPlayers }, (_, index) => createPlayer(index + 1))];

  return {
    round: 1,
    maxRounds: 10,
    targetReputation: 16,
    phase: 'planning',
    players,
    market: [
      { id: 'grain', name: '粮食', icon: icons.grain, price: 6, trend: 0 },
      { id: 'ore', name: '矿石', icon: icons.ore, price: 12, trend: 0 },
      { id: 'textile', name: '织物', icon: icons.textile, price: 9, trend: 0 },
      { id: 'energy', name: '能源', icon: icons.energy, price: 14, trend: 0 },
    ],
    contracts: createContracts(),
    tradeOffers: [],
    log: [
      {
        id: id('log'),
        round: 1,
        text: '经济竞技场开局：观察价格、积累资源，并向其他玩家发起交易。',
        tone: 'info',
      },
    ],
  };
}

function produceFor(player: Player): Player {
  const productionByStrategy: Record<Player['strategy'], Partial<Inventory>> = {
    balanced: { grain: 1, textile: 1, energy: 1 },
    aggressive: { ore: 2, energy: 1 },
    collector: { grain: 1, ore: 1, textile: 1, energy: 1 },
    merchant: { grain: 2, textile: 1 },
  };

  return {
    ...player,
    credits: player.credits + (player.strategy === 'merchant' ? 8 : 5),
    inventory: addItems(player.inventory, productionByStrategy[player.strategy]),
  };
}

function updateMarket(state: GameState): GameState {
  return {
    ...state,
    market: state.market.map((item) => {
      const trend = Math.floor(Math.random() * 9) - 4;
      return { ...item, trend, price: clamp(item.price + trend, 4, 22) };
    }),
  };
}

function evaluateAiTrade(state: GameState, ai: Player, offer: TradeOffer) {
  const valueToAi = offer.giveCredits + itemValue(state, offer.giveItems);
  const costToAi = offer.receiveCredits + itemValue(state, offer.receiveItems);
  const thresholdByStrategy: Record<Player['strategy'], number> = {
    balanced: 0.96,
    aggressive: 1.05,
    collector: 0.9,
    merchant: 0.88,
  };
  const scarcityBonus = resources.some((resource) => (ai.inventory[resource] ?? 0) <= 1 && (offer.giveItems[resource] ?? 0) > 0) ? 4 : 0;
  return valueToAi + scarcityBonus >= costToAi * thresholdByStrategy[ai.strategy];
}

function applyTrade(state: GameState, offer: TradeOffer): GameState | null {
  const from = state.players.find((player) => player.id === offer.fromPlayerId);
  const to = state.players.find((player) => player.id === offer.toPlayerId);
  if (!from || !to) return null;
  if (!hasEnough(from, offer.giveItems, offer.giveCredits)) return null;
  if (!hasEnough(to, offer.receiveItems, offer.receiveCredits)) return null;

  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id === from.id) {
        return {
          ...player,
          credits: player.credits - offer.giveCredits + offer.receiveCredits,
          inventory: addItems(addItems(player.inventory, offer.giveItems, -1), offer.receiveItems),
        };
      }

      if (player.id === to.id) {
        return {
          ...player,
          credits: player.credits - offer.receiveCredits + offer.giveCredits,
          inventory: addItems(addItems(player.inventory, offer.receiveItems, -1), offer.giveItems),
        };
      }

      return player;
    }),
  };
}

function resolveAiTrades(state: GameState): GameState {
  let next = state;

  state.tradeOffers.forEach((offer) => {
    if (offer.status !== 'pending') return;
    const target = next.players.find((player) => player.id === offer.toPlayerId);
    if (!target || target.isHuman) return;

    const accepted = evaluateAiTrade(next, target, offer);
    if (accepted) {
      const traded = applyTrade(next, offer);
      if (traded) {
        next = {
          ...traded,
          tradeOffers: traded.tradeOffers.map((item) => (item.id === offer.id ? { ...item, status: 'accepted' } : item)),
        };
        next = addLog(next, `${target.name} 接受交易：给出 ${describeItems(offer.receiveItems)}，获得 ${describeItems(offer.giveItems)}。`, 'success');
        return;
      }
    }

    next = {
      ...next,
      tradeOffers: next.tradeOffers.map((item) => (item.id === offer.id ? { ...item, status: 'rejected' } : item)),
    };
    next = addLog(next, `${target.name} 拒绝了一笔交易。`, 'warning');
  });

  return next;
}

function createAiOffers(state: GameState): TradeOffer[] {
  const human = state.players.find((player) => player.isHuman);
  if (!human) return [];

  return state.players
    .filter((player) => !player.isHuman)
    .flatMap((player) => {
      const surplus = resources.find((resource) => player.inventory[resource] >= 4);
      if (!surplus) return [];
      const price = marketPrice(state, surplus) + (player.strategy === 'merchant' ? 2 : 1);
      if (human.credits < price) return [];

      return [
        {
          id: id('trade'),
          fromPlayerId: player.id,
          toPlayerId: human.id,
          giveCredits: 0,
          receiveCredits: price,
          giveItems: { [surplus]: 1 },
          receiveItems: {},
          message: `${player.name} 愿意出售 1 份${resourceNames[surplus]}，报价 ${price} 信用点。`,
          round: state.round,
          status: 'pending' as const,
        },
      ];
    });
}

function determineWinner(state: GameState): string | undefined {
  const reputationWinner = state.players.find((player) => player.reputation >= state.targetReputation);
  if (reputationWinner) return reputationWinner.id;
  if (state.round <= state.maxRounds) return undefined;

  return [...state.players].sort((a, b) => b.reputation - a.reputation || b.credits - a.credits)[0]?.id;
}

interface GameStore {
  state: GameState;
  createNewGame: () => void;
  buyResource: (resource: ResourceId, quantity: number) => void;
  proposeTrade: (offer: Omit<TradeOffer, 'id' | 'round' | 'status'>) => void;
  acceptTrade: (offerId: string) => void;
  rejectTrade: (offerId: string) => void;
  completeContract: (contractId: string) => void;
  advanceRound: () => void;
  saveGame: () => Promise<void>;
  loadGame: () => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(),

  createNewGame: () => {
    playSfx('round');
    set({ state: createInitialState() });
  },

  buyResource: (resource, quantity) => {
    const amount = Math.max(1, Math.floor(quantity));
    const current = get().state;
    const human = current.players.find((player) => player.isHuman);
    if (!human) return;

    const total = marketPrice(current, resource) * amount;
    if (human.credits < total) {
      set({ state: addLog(current, `信用点不足，无法购买 ${amount} 份${resourceNames[resource]}。`, 'warning') });
      playSfx('reject');
      return;
    }

    let next: GameState = {
      ...current,
      players: current.players.map((player) =>
        player.id === human.id
          ? {
              ...player,
              credits: player.credits - total,
              inventory: addItems(player.inventory, { [resource]: amount }),
            }
          : player,
      ),
    };
    next = addLog(next, `你以 ${total} 信用点买入 ${amount} 份${resourceNames[resource]}。`, 'success');
    set({ state: next });
    playSfx('click');
  },

  proposeTrade: (offerInput) => {
    const current = get().state;
    const offer: TradeOffer = {
      ...offerInput,
      id: id('trade'),
      round: current.round,
      status: 'pending',
      giveItems: normalizeItems(offerInput.giveItems),
      receiveItems: normalizeItems(offerInput.receiveItems),
      giveCredits: Math.max(0, Math.floor(offerInput.giveCredits)),
      receiveCredits: Math.max(0, Math.floor(offerInput.receiveCredits)),
    };

    const from = current.players.find((player) => player.id === offer.fromPlayerId);
    if (!from || !hasEnough(from, offer.giveItems, offer.giveCredits)) {
      set({ state: addLog(current, '交易发起失败：你承诺的资源或信用点不足。', 'warning') });
      playSfx('reject');
      return;
    }

    set({
      state: addLog(
        { ...current, tradeOffers: [offer, ...current.tradeOffers], phase: 'trade' },
        `你发出交易：给 ${describeItems(offer.giveItems)} + ${offer.giveCredits} 信用点，换 ${describeItems(offer.receiveItems)} + ${offer.receiveCredits} 信用点。`,
        'trade',
      ),
    });
    playSfx('trade');
  },

  acceptTrade: (offerId) => {
    const current = get().state;
    const offer = current.tradeOffers.find((item) => item.id === offerId);
    if (!offer || offer.status !== 'pending') return;

    const traded = applyTrade(current, offer);
    if (!traded) {
      set({
        state: addLog(
          { ...current, tradeOffers: current.tradeOffers.map((item) => (item.id === offerId ? { ...item, status: 'rejected' } : item)) },
          '交易无法履行，已自动拒绝。',
          'warning',
        ),
      });
      playSfx('reject');
      return;
    }

    const from = current.players.find((player) => player.id === offer.fromPlayerId);
    set({
      state: addLog(
        { ...traded, tradeOffers: traded.tradeOffers.map((item) => (item.id === offerId ? { ...item, status: 'accepted' } : item)) },
        `你接受了 ${from?.name ?? '对方'} 的交易。`,
        'success',
      ),
    });
    playSfx('accept');
  },

  rejectTrade: (offerId) => {
    const current = get().state;
    set({
      state: addLog(
        { ...current, tradeOffers: current.tradeOffers.map((offer) => (offer.id === offerId ? { ...offer, status: 'rejected' } : offer)) },
        '你拒绝了一笔交易。',
        'warning',
      ),
    });
    playSfx('reject');
  },

  completeContract: (contractId) => {
    const current = get().state;
    const contract = current.contracts.find((item) => item.id === contractId);
    const human = current.players.find((player) => player.isHuman);
    if (!contract || !human) return;

    if (!hasEnough(human, contract.requirements)) {
      set({ state: addLog(current, `资源不足，暂时无法完成「${contract.title}」。`, 'warning') });
      playSfx('reject');
      return;
    }

    let next: GameState = {
      ...current,
      phase: 'contract',
      players: current.players.map((player) =>
        player.id === human.id
          ? {
              ...player,
              credits: player.credits + contract.rewardCredits,
              reputation: player.reputation + contract.rewardReputation,
              contractsCompleted: player.contractsCompleted + 1,
              inventory: addItems(player.inventory, contract.requirements, -1),
            }
          : player,
      ),
    };

    next = addLog(next, `完成合同「${contract.title}」，获得 ${contract.rewardCredits} 信用点与 ${contract.rewardReputation} 声望。`, 'success');
    const winnerId = determineWinner(next);
    if (winnerId) {
      next = addLog({ ...next, phase: 'finished', winnerId }, '比赛结束：已有玩家达成胜利条件。', 'success');
      playSfx('win');
    } else {
      playSfx('accept');
    }

    set({ state: next });
  },

  advanceRound: () => {
    const current = get().state;
    if (current.phase === 'finished') return;

    let next = resolveAiTrades(current);
    next = updateMarket({ ...next, players: next.players.map(produceFor) });
    const aiOffers = createAiOffers(next);
    next = {
      ...next,
      round: next.round + 1,
      phase: 'planning',
      tradeOffers: [...aiOffers, ...next.tradeOffers],
    };
    next = addLog(next, `第 ${next.round} 回合开始：市场价格刷新，所有玩家获得生产收益。`, 'info');
    if (aiOffers.length > 0) {
      next = addLog(next, `AI 商人向你发来了 ${aiOffers.length} 笔新报价。`, 'trade');
    }

    const winnerId = determineWinner(next);
    if (winnerId) {
      const winner = next.players.find((player) => player.id === winnerId);
      next = addLog({ ...next, phase: 'finished', winnerId }, `比赛结束，胜者是 ${winner?.name ?? '未知玩家'}。`, 'success');
      playSfx('win');
    } else {
      playSfx('round');
    }

    set({ state: next });
  },

  saveGame: async () => {
    await saveGameState(JSON.stringify(get().state));
    set({ state: addLog(get().state, '游戏已保存。', 'success') });
  },

  loadGame: async () => {
    const stateJson = await loadGameState();
    set({ state: JSON.parse(stateJson) as GameState });
    playSfx('accept');
  },
}));

export { resources, resourceNames };
