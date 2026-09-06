import { useOperationNotifications } from '../../src/hooks/useOperationNotifications';
import { GameShell } from '../../src/components/shell/GameShell';
import { useRef, useState } from 'react';
import type { LoadedGameViewModel } from '../../src/app/gameViewModel';
import type { GameActionResult } from '../../src/api/game';
import type { OrderSide } from '../../src/types';
import { MarketPage } from '../../src/pages/MarketPage';
import { publishCommodityWriteProgress } from '../../src/api/commodityWriteProgress';

/** A transport fixture supplies receipts, not an alternative economic implementation. */
export function TradeConfirmationHarness({ base }: { base: LoadedGameViewModel }) {
  const notifications = useOperationNotifications(base.user.id);
  const [side, setSide] = useState<OrderSide>('buy');
  const [resources, setResources] = useState({ credits: 10_000, available: 100 });
  const feedbackFails = useRef(false);
  const calls = useRef<unknown[][]>([]);
  const resolver = useRef<((result: GameActionResult) => void) | null>(null);
  const model: LoadedGameViewModel = {
    ...base,
    ...notifications,
    selectedProvinceId: '110000', marketAssetKind: 'commodity', marketAssetId: 'machinery',
    marketViewMode: 'detail', orderSide: side, selectOrderSide: setSide, orderQuantity: 2,
    game: { ...base.game, credits: resources.credits,
      markets: { ...base.game.markets, machinery: { ...base.game.markets.machinery, officialPrice: 5 } },
      inventories: { ...base.game.inventories, machinery: { available: resources.available, frozen: 0, inTransit: 0 } },
    },
    placeAssetOrder: (...args) => {
      calls.current.push(args);
      return new Promise<GameActionResult>((resolve) => { resolver.current = resolve; });
    },
    showResult: (result) => { if (feedbackFails.current) throw new Error('fixture notification failed'); return notifications.showResult(result); },
  };
  Object.assign(window, {
    __tradeFixture: {
      calls: () => calls.current,
      failFeedback: () => { feedbackFails.current = true; },
      resolve: (result: GameActionResult) => { resolver.current?.(result); resolver.current = null; },
      resources: setResources,
      confirming: () => publishCommodityWriteProgress(JSON.stringify({ provinceId: '110000', assetKind: 'commodity', assetId: 'machinery', side, quantity: 2 }), 'confirming'),
    },
  });
  return <GameShell model={model}><MarketPage model={model} /></GameShell>;
}
