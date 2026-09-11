import '@vitejs/plugin-react/preamble';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import { TransportPage } from '../../src/pages/TransportPage';
import { TransportRouteDraftContext } from '../../src/components/shell/TransportRouteDraftContext';
import { PlayerPageNavigationProvider } from '../../src/components/ui/PageNavigationContext';
import type { PlayerPageLocation } from '../../src/navigation/playerPageStack';
import type { OnlineAutoTradeAwareGameViewModel } from '../../src/auto-trade/useOnlineAutoTrade';
import { createTransportCyclePolicy } from '../../shared/transport-policy.js';
import '../../src/styles/globals.css';
import '../../src/styles/design-system.css';
import '../../src/styles/card-system.css';
import '../../src/styles/icon-system.css';
import '../../src/styles/form-controls.css';
import '../../src/styles/interaction-states.css';
import '../../src/styles/primary-surfaces.css';
import '../../src/styles/scrolling-page-sections.css';
import '../../src/styles/transport-page.css';
import '../../src/styles/product-artwork.css';

const now = Date.now();
const notices: string[] = [];
const noop = () => {};
type Mode = 'road' | 'rail' | 'air';
type Slot = { id: string; index: number; mode: Mode; experience: number; level: number; nextLevelExperience: number | null; speedBonusBps: number; occupied: boolean; routeId?: string };
interface State { slots: Slot[]; active: boolean; saveEpoch: number; }
interface Controls { patch: (patch: Partial<State>) => void; notices: string[]; }
declare global { interface Window { transportFleet: Controls; } }

const initialSlots: Slot[] = [
  { id: 'transport-slot-1', index: 1, mode: 'road', experience: 38, level: 6, nextLevelExperience: 54, speedBonusBps: 1500, occupied: true, routeId: 'route-1' },
  { id: 'transport-slot-2', index: 2, mode: 'rail', experience: 8, level: 3, nextLevelExperience: 15, speedBonusBps: 600, occupied: false },
  { id: 'transport-slot-3', index: 3, mode: 'air', experience: 0, level: 1, nextLevelExperience: 3, speedBonusBps: 0, occupied: false },
  { id: 'transport-slot-4', index: 4, mode: 'road', experience: 3, level: 2, nextLevelExperience: 8, speedBonusBps: 300, occupied: false },
  { id: 'transport-slot-5', index: 5, mode: 'rail', experience: 0, level: 1, nextLevelExperience: 3, speedBonusBps: 0, occupied: false },
];

function Harness() {
  const [state, setState] = useState<State>({ slots: initialSlots, active: true, saveEpoch: 1 });
  const [location, setLocation] = useState<PlayerPageLocation>({ type: 'tab', tab: 'transport' });
  useEffect(() => { window.transportFleet = { patch: (patch) => setState((s) => ({ ...s, ...patch })), notices }; }, []);
  const route = { id: 'route-1', name: '加利福尼亚—得克萨斯', sourceProvinceId: 'A', destinationProvinceId: 'B', mode: 'road' as const,
    vehicleCount: 1, createdAt: now, updatedAt: now };
  const slotState = useMemo(() => ({ version: 1, stage: 'C3', limit: 5,
    used: state.active ? 1 : 0,
    slots: state.slots.map((slot) => slot.id === 'transport-slot-1' ? { ...slot, occupied: state.active } : slot),
  }), [state]);
  const model = {
    user: { id: 8912 },
    game: { userId: 8912, saveEpoch: state.saveEpoch, credits: 10000, lastProcessedAt: now, defaultProvinceId: 'A',
      provinces: [{ id: 'A', name: '加利福尼亚', latitude: 30, longitude: -100 }, { id: 'B', name: '得克萨斯', latitude: 31, longitude: -100 }],
      products: [{ id: 'wheat', name: '小麦' }],
      provinceInventories: { A: { wheat: { available: 1000 }, 'industrial-fuel': { available: 10000 } }, B: { wheat: { available: 0 } } },
      provinceMarkets: { A: { wheat: { officialPrice: 1, nextPriceAt: now + 86400000 }, 'industrial-fuel': { officialPrice: 4, nextPriceAt: now + 86400000 } },
        B: { wheat: { officialPrice: 10, nextPriceAt: now + 86400000 } } },
      research: { unlockedComplexity: 'C3', completedTechnologyIds: [], completedAtByTechnologyId: {}, completedAt: null, active: null, transportSlots: slotState },
      transportRoutes: [route], transportShipments: state.active ? [{ id: 'trip-1', routeId: 'route-1', mode: 'road', status: 'in-transit', slotId: 'transport-slot-1', transportToolLevel: 6,
        policySnapshot: { ...createTransportCyclePolicy('road'), transportSlotId: 'transport-slot-1', transportToolLevel: 6, transportToolSpeedBonusBps: 1500 }, manifest: [{ productId: 'wheat', quantity: 150 }],
        sourceProvinceId: 'A', destinationProvinceId: 'B', currentLeg: { fromProvinceId: 'A', toProvinceId: 'B', departsAt: now, arrivesAt: now + 3600000 },
        departsAt: now, arrivesAt: now + 3600000, transportFee: 4, fuelPurchased: 2, createdAt: now }] : [],
    },
    showResult: async (result: { message: string }) => { notices.push(result.message); },
    refresh: async () => {},
    deleteTransportRoute: async () => ({ ok: true, message: '已删除' }),
    renameTransportRoute: async () => ({ ok: true, message: '已重命名' }),
    createTransportRoute: async () => ({ ok: true, message: '已创建' }),
  } as unknown as OnlineAutoTradeAwareGameViewModel;
  return <main style={{ width: '100%', maxWidth: 1000, margin: '0 auto' }}>
    <TransportRouteDraftContext.Provider value={{ draft: null, setDraft: noop, updateDraft: noop, closeDraft: noop,
      picking: false, beginPicking: noop, finishPicking: noop, cancelPicking: noop, pickProvince: noop, closeLoop: noop,
      resetStops: noop, highlightedRouteId: null, setHighlightedRouteId: noop }}>
      <PlayerPageNavigationProvider value={{ currentLocation: location, canGoBack: true, onBack: () => setLocation({ type: 'tab', tab: 'transport' }),
        onClose: noop, pushPage: setLocation, replacePage: setLocation }}>
        <TransportPage model={model} />
      </PlayerPageNavigationProvider>
    </TransportRouteDraftContext.Provider>
  </main>;
}

document.documentElement.dataset.appSurface = 'game';
createRoot(document.getElementById('root')!).render(<StrictMode><Harness /></StrictMode>);
