import '@vitejs/plugin-react/preamble';
import { StrictMode, useEffect, useState } from 'react';
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
const writes: Array<{ routeId: string; quantity: number; expectedVehicleCount: number }> = [];
const notices: string[] = [];
const noop = () => {};
interface State { count: number; credits: number; active: boolean; saveEpoch: number; }
interface Controls { patch: (patch: Partial<State>) => void; writes: typeof writes; notices: string[]; }
declare global { interface Window { transportFleet: Controls; } }

function Harness() {
  const [state, setState] = useState<State>({ count: 1, credits: 10000, active: true, saveEpoch: 1 });
  const [location, setLocation] = useState<PlayerPageLocation>({ type: 'transport-route', routeId: 'route-1' });
  useEffect(() => { window.transportFleet = { patch: (patch) => setState((s) => ({ ...s, ...patch })), writes, notices }; }, []);
  const route = { id: 'route-1', name: '加利福尼亚—得克萨斯', sourceProvinceId: 'A', destinationProvinceId: 'B', mode: 'road' as const,
    vehicleCount: state.count, createdAt: now, updatedAt: now };
  const model = {
    user: { id: 8912 },
    game: { userId: 8912, saveEpoch: state.saveEpoch, credits: state.credits, lastProcessedAt: now, defaultProvinceId: 'A',
      provinces: [{ id: 'A', name: '加利福尼亚', latitude: 30, longitude: -100 }, { id: 'B', name: '得克萨斯', latitude: 31, longitude: -100 }],
      products: [{ id: 'wheat', name: '小麦' }],
      provinceInventories: { A: { wheat: { available: 1000 }, 'industrial-fuel': { available: 10000 } }, B: { wheat: { available: 0 } } },
      provinceMarkets: { A: { wheat: { officialPrice: 1, nextPriceAt: now + 86400000 }, 'industrial-fuel': { officialPrice: 4, nextPriceAt: now + 86400000 } },
        B: { wheat: { officialPrice: 10, nextPriceAt: now + 86400000 } } },
      transportRoutes: [route], transportShipments: state.active ? [{ id: 'trip-1', routeId: 'route-1', mode: 'road', status: 'in-transit',
        policySnapshot: createTransportCyclePolicy('road'), manifest: [{ productId: 'wheat', quantity: 150 }],
        sourceProvinceId: 'A', destinationProvinceId: 'B', currentLeg: { fromProvinceId: 'A', toProvinceId: 'B', departsAt: now, arrivesAt: now + 3600000 },
        departsAt: now, arrivesAt: now + 3600000, transportFee: 4, fuelPurchased: 2, createdAt: now }] : [],
    },
    // Mock only the network boundary. The production page, controls, planner,
    // frozen form basis, pending lifecycle and notification path run unchanged.
    expandTransportRoute: async (routeId: string, quantity: number, expectedVehicleCount: number) => {
      const body = { routeId, quantity, expectedVehicleCount };
      writes.push(body);
      const response = await fetch('/fleet-write', { method: 'POST', body: JSON.stringify(body) });
      const result = await response.json();
      if (result.ok) setState((s) => ({ ...s, count: result.count, credits: result.credits }));
      return result;
    },
    showResult: async (result: { message: string }) => { notices.push(result.message); },
    deleteTransportRoute: async () => ({ ok: true, message: '已删除' }),
    renameTransportRoute: async () => ({ ok: true, message: '已重命名' }),
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
