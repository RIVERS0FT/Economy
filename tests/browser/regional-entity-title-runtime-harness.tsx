import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import { RegionalEntityPageTitle } from '../../src/components/ui/RegionalEntityPageTitle';
import {
  PlayerPageNavigationProvider,
  type PlayerPageNavigationValue,
} from '../../src/components/ui/PageNavigationContext';
import type { PlayerPageLocation } from '../../src/navigation/playerPageStack';
import '../../src/styles/design-system.css';
import '../../src/styles/regional-entity-page-title.css';
import '../../src/styles/interaction-states.css';

const params = new URLSearchParams(window.location.search);
const requestedKind = params.get('kind');
const kind = requestedKind === 'facility' || requestedKind === 'commercial'
  ? requestedKind
  : 'product';
const initialLocation: PlayerPageLocation = kind === 'facility'
  ? {
      type: 'regional-facility',
      host: 'buildings',
      provinceId: 'US-CA',
      facilityTypeId: 'farm',
    }
  : kind === 'commercial'
    ? {
        type: 'regional-commercial',
        provinceId: 'US-CA',
        commercialTypeId: 'convenience-store',
      }
    : {
        type: 'regional-product',
        host: 'market',
        provinceId: 'US-CA',
        productId: 'wheat',
      };

function RuntimeHarness() {
  const [currentLocation, setCurrentLocation] = useState<PlayerPageLocation>(initialLocation);
  const [lastAction, setLastAction] = useState('');
  const navigation = useMemo<PlayerPageNavigationValue>(() => ({
    canGoBack: true,
    currentLocation,
    onBack: () => setLastAction('back'),
    onClose: () => setLastAction('close'),
    pushPage: (location) => {
      setLastAction('push');
      setCurrentLocation(location);
    },
    replacePage: (location) => {
      setLastAction('replace');
      setCurrentLocation(location);
    },
  }), [currentLocation]);

  const entityName = kind === 'facility'
    ? '农场'
    : kind === 'commercial'
      ? '便利店'
      : '小麦';

  return (
    <PlayerPageNavigationProvider value={navigation}>
      <main>
        <h1>
          <RegionalEntityPageTitle
            entityName={entityName}
            regionName="加利福尼亚"
          />
        </h1>
        <output data-testid="last-action">{lastAction}</output>
        <output data-testid="current-location">{JSON.stringify(currentLocation)}</output>
      </main>
    </PlayerPageNavigationProvider>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('missing runtime root');
createRoot(root).render(<RuntimeHarness />);
