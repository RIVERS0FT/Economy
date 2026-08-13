import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import { useNow } from '../../src/hooks/useNow';

const referenceNow = Date.now();
const counts = { parent: 0, leaf: 0 };

function ClockLeaf() {
  const now = useNow(referenceNow);
  counts.leaf += 1;
  return <output data-testid="clock-leaf">{Math.floor(now / 1_000)}</output>;
}

function ClockParent() {
  counts.parent += 1;
  return (
    <main>
      <output data-testid="clock-parent">{counts.parent}</output>
      <ClockLeaf />
    </main>
  );
}

Object.assign(window, {
  __clockLeafHarness: {
    counts: () => ({ ...counts }),
  },
});

createRoot(document.getElementById('root') as HTMLElement).render(<ClockParent />);
