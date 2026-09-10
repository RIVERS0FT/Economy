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
const noop = () => {};
interface State { active: boolean; saveEpoch: number; deletionPending: boolean; }
declare global { interface Window { transportBusinessFixture: { patch: (patch: Partial<State>) => void; notices: string[] }; } }
const notices: string[] = [];

function Harness() {
  const [state, setState] = useState<State>({ active: false, saveEpoch: 1, deletionPending: false });
  const [location, setLocation] = useState<PlayerPageLocation>({ type: 'transport-route', routeId: 'business-route' });
  useEffect(() => { window.transportBusinessFixture = { patch: (patch) => setState((value) => ({ ...value, ...patch })), notices }; }, []);
  const task = { id: 'freight-one', kind: 'freight', status: 'active', sourceProvinceId: 'A', destinationProvinceId: 'B',
    productId: 'wheat', quantity: 200, deliveredQuantity: 50, inTransitQuantity: state.active ? 150 : 0,
    reservedQuantity: state.active ? 0 : 150, reward: 20, paid: 5, spent: 3, deadlineAt: now + 3600000, createdAt: now, updatedAt: now };
  const route = { id: 'business-route', name: '加利福尼亚—得克萨斯', sourceProvinceId: 'A', destinationProvinceId: 'B',
    mode: 'road', vehicleCount: 1, setupCost: 80, createdAt: now, updatedAt: now, deletionPending: state.deletionPending,
    transportBusiness: { tasks: [task], reservedFuel: 2, dailyRewardBudget: 10000, committedReward: 20,
      offers: [{ id: 'offer-two', sourceProvinceId: 'B', destinationProvinceId: 'A', productId: 'wheat', quantity: 800, reward: 80, deadlineAt: now + 3600000 }],
      dispatch: state.active ? null : { ready: true, maintenanceRequired: false, reason: '可启动任务运输', vehicleCount: 1,
        transportedQuantity: 150, transportFee: 3, fuelRequired: 2, fingerprint: 'preview' },
    } };
  const model = { user: { id: 8981 },
    game: { userId: 8981, saveEpoch: state.saveEpoch, credits: 10000, lastProcessedAt: now, defaultProvinceId: 'A',
      provinces: [{ id: 'A', name: '加利福尼亚', latitude: 30, longitude: -100 }, { id: 'B', name: '得克萨斯', latitude: 31, longitude: -100 }],
      products: [{ id: 'wheat', name: '小麦' }],
      facilityTypes: [{ id: 'mill', defaultRecipeId: 'mill-wheat', recipes: [{ id: 'mill-wheat', inputs: [{ productId: 'wheat', quantity: 2 }] }] }],
      provinceFacilityGroups: { B: [{ facilityTypeId: 'mill', activeRecipeId: 'mill-wheat', enabled: true, count: 1 }], A: [] },
      provinceInventories: { A: { wheat: { available: 1000 }, 'industrial-fuel': { available: 10000 } }, B: { wheat: { available: 0 } } },
      provinceMarkets: { A: { wheat: { officialPrice: 1, nextPriceAt: now + 86400000 }, 'industrial-fuel': { officialPrice: 4, nextPriceAt: now + 86400000 } },
        B: { wheat: { officialPrice: 10, nextPriceAt: now + 86400000 } } },
      transportRoutes: [route], transportShipments: state.active ? [{ id: 'task-trip', routeId: route.id, mode: 'road', status: 'in-transit', taskTrip: true,
        policySnapshot: createTransportCyclePolicy('road'), manifest: [{ productId: 'wheat', quantity: 150, destinationProvinceId: 'B' }],
        sourceProvinceId: 'A', destinationProvinceId: 'B', departsAt: now, arrivesAt: now + 3600000,
        transportFee: 3, fuelPurchased: 2, freightIncome: 5, deliveredQuantity: 50, createdAt: now }] : [],
    },
    refresh: async () => {},
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
