import { createRoot } from 'react-dom/client';
import { EconomicEventLogPanel } from '../../src/components/EconomicEventLogPanel';
import '../../src/styles/globals.css';
import '../../src/styles/design-system.css';
import '../../src/styles/economic-event-log.css';

const now = Date.UTC(2026, 7, 18, 12, 0, 0);

createRoot(document.getElementById('root') as HTMLElement).render(
  <main style={{ width: 320, height: 520, padding: 12 }}>
    <EconomicEventLogPanel
      referenceNow={now}
      products={[{ id: 'machinery', name: '机械', category: 'industrial', basePrice: 40 }] as any}
      markets={{
        machinery: {
          productId: 'machinery',
          lastPrice: 42,
          priceHistory: [],
        },
      } as any}
      events={[{
        id: 'browser-event-1',
        type: 'industrial-demand',
        title: '制造业采购季',
        description: '制造业需求阶段性提高。',
        startsAt: now + 60 * 60_000,
        endsAt: now + 4 * 60 * 60_000,
        classIds: ['working'],
        classLabels: ['劳动人口'],
        categoryWeights: { industrial: 10_000 },
        productIds: ['machinery'],
      }] as any}
    />
  </main>,
);
