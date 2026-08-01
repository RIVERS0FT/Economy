import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import { PriceSparkline } from '../../src/components/charts/PriceSparkline';
import type { MarketHistoryBucket } from '../../src/utils/marketHistory';
import { MARKET_BUCKET_COUNT, MARKET_BUCKET_MS, MARKET_WINDOW_MS } from '../../src/utils/marketHistory';
import '../../src/styles/globals.css';
import '../../src/styles/charts.css';
import '../../src/styles/design-system.css';
import '../../src/styles/interaction-states.css';

const windowEnd = Date.UTC(2026, 6, 18, 16, 0, 0);
const windowStart = windowEnd - MARKET_WINDOW_MS;

function buildBuckets(dataRevision: number): MarketHistoryBucket[] {
  return Array.from({ length: MARKET_BUCKET_COUNT }, (_, index) => {
    const active = index === 120;
    const price = active ? 12 + dataRevision : 12;
    const volume = active ? 120 + dataRevision * 80 : index % 41 === 0 ? 20 : 0;
    return {
      startAt: windowStart + index * MARKET_BUCKET_MS,
      price,
      volume,
      buyVolume: volume,
      sellVolume: 0,
      neutralVolume: 0,
      netVolume: volume,
      direction: volume > 0 ? 'buy' : 'neutral',
    };
  });
}

declare global {
  interface Window {
    __advanceMarketTooltipData?: () => void;
  }
}

function MarketTooltipPersistenceHarness() {
  const [renderCount, setRenderCount] = useState(0);
  const [dataRevision, setDataRevision] = useState(0);
  const buckets = useMemo(() => buildBuckets(dataRevision), [dataRevision]);

  useEffect(() => {
    const timer = window.setInterval(() => setRenderCount((current) => current + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.__advanceMarketTooltipData = () => setDataRevision((current) => current + 1);
    return () => {
      delete window.__advanceMarketTooltipData;
    };
  }, []);

  return (
    <main style={{ width: '900px', maxWidth: '100%', margin: '0 auto', padding: '24px' }}>
      <div data-testid="market-tooltip-render-count" data-render-count={renderCount} data-data-revision={dataRevision}>
        <PriceSparkline buckets={buckets} variant="full" />
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Market tooltip persistence root is missing');
createRoot(root).render(<MarketTooltipPersistenceHarness />);
