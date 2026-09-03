import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { ContractWorkspacePage } from './ContractWorkspacePage';
import '../styles/contract-core-workspace.css';

export function ContractPage({ model }: { model: TutorialAwareGameViewModel }) {
  return <ContractWorkspacePage model={model} />;
}
