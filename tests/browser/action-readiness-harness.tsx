import '@vitejs/plugin-react/preamble';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import { gameActions } from '../../src/api/game';
import type { LoadedGameViewModel } from '../../src/app/gameViewModel';
import { BuildingsPage } from '../../src/pages/BuildingsPage';
import { GemShopPage } from '../../src/pages/GemShopPage';
import '../../src/styles/globals.css';
import '../../src/styles/card-system.css';
import '../../src/styles/icon-system.css';
import '../../src/styles/design-system.css';
import '../../src/styles/interaction-states.css';
import '../../src/styles/primary-surfaces.css';
import '../../src/styles/form-controls.css';

interface HarnessState {
  userId: number;
  saveEpoch: number;
  provinceId: string;
  typeId: string;
  quantity: number;
  credits: number;
  timber: number;
  price: number;
  noise: number;
  visible: boolean;
  part: 'build' | 'cards';
  holdNotice: boolean;
}

interface HarnessControls {
  patch: (patch: Partial<HarnessState>) => void;
  writes: Array<{ kind: string; body: unknown }>;
  notices: string[];
}

declare global {
  interface Window { actionReadiness: HarnessControls; }
}

const writes: HarnessControls['writes'] = [];
const notices: string[] = [];
async function write(kind: string, body: unknown = {}) {
  writes.push({ kind, body });
  const response = await fetch(`/readiness-write/${kind}`, { method: 'POST', body: JSON.stringify(body) });
  if (!response.ok) throw new Error('测试写请求失败');
  return response.json() as Promise<{ ok: boolean; message: string }>;
}
// Mock only the action boundary; the rendered page and quote GET API are real.
gameActions.rejectGemShopQuote = async () => ({ result: await write('reject'), revision: 2 });

function Harness() {
  const [state, setState] = useState<HarnessState>({
    userId: 901, saveEpoch: 0, provinceId: '110000', typeId: 'farm', quantity: 1,
    credits: 467_000_000, timber: 0, price: 10, noise: 0, visible: true, part: 'build', holdNotice: false,
  });
  useEffect(() => {
    window.actionReadiness = { patch: (patch) => setState((current) => ({ ...current, ...patch })), writes, notices };
  }, []);
  const output = { productId: 'wheat', quantity: 4 };
  const common = { category: 'raw', complexity: 'C1', inputs: [], output, cycleMs: 120_000, operatingCost: 1 };
  // Recreate partition objects on each model update to exercise reference churn.
  const model = {
    user: { id: state.userId },
    game: {
      userId: state.userId, saveEpoch: state.saveEpoch, lastProcessedAt: Date.UTC(2026, 8, 8),
      credits: state.credits, gems: 1_300,
      facilityTypes: [
        { ...common, id: 'farm', name: '农场', buildCost: 50, buildInputs: [] },
        { ...common, id: 'ranch', name: '牧场', buildCost: 120, buildInputs: [{ productId: 'timber', quantity: 2 }] },
      ],
      facilityGroups: [], provinceFacilityGroups: {},
      products: [{ id: 'wheat', name: '小麦', category: 'raw' }, { id: 'timber', name: '木材', category: 'raw' }],
      inventories: { timber: { available: state.timber, frozen: 0 }, wheat: { available: state.noise, frozen: 0 } },
      markets: { timber: { officialPrice: state.price }, wheat: { officialPrice: 2 + state.noise } },
      provinces: [{ id: '110000', name: '得克萨斯' }, { id: '120000', name: '加利福尼亚' }],
    },
    selectedProvinceId: state.provinceId,
    selectedProvince: { id: state.provinceId, name: '得克萨斯' },
    selectedFacilityTypeId: state.typeId,
    setSelectedFacilityTypeId: (typeId: string) => setState((current) => ({ ...current, typeId })),
    buildFacility: (facilityTypeId: string, quantity: number, procurement?: unknown) => write('build', {
      provinceId: state.provinceId, facilityTypeId, quantity, procurement,
    }),
    exchangeGems: (gems: number) => write('exchange', { gems }),
    redeemGift: (code: string) => write('gift', { code }),
    notify: (message: string) => { notices.push(message); },
    showResult: async (value: { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>) => {
      const result = await value;
      notices.push(result.message);
      if (state.holdNotice) await new Promise<void>(() => {});
    },
  } as unknown as LoadedGameViewModel;
  const shop = new URLSearchParams(location.search).get('mode') === 'shop';
  return <main data-harness-noise={state.noise}>
    {state.visible ? shop ? <GemShopPage model={model} /> : <BuildingsPage model={model} embedded renderPart={state.part}
      constructionDraft={{ typeId: state.typeId, quantity: state.quantity,
        setTypeId: (typeId) => setState((current) => ({ ...current, typeId })),
        setQuantity: (quantity) => setState((current) => ({ ...current, quantity })),
      }} /> : null}
  </main>;
}

document.documentElement.dataset.appSurface = 'game';
createRoot(document.getElementById('root')!).render(<StrictMode><Harness /></StrictMode>);
