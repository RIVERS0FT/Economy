import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import { FinancialBackdrop } from '../../src/components/visual/FinancialBackdrop';
import '../../src/styles/financial-backdrop.css';

const host = document.getElementById('backdrop-root');
if (!host) throw new Error('persistent backdrop harness root is missing');

createRoot(host).render(<FinancialBackdrop />);
