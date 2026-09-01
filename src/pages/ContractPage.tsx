import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { ContractWorkspacePage } from './ContractWorkspacePage';

export function ContractPage({ model }: { model: TutorialAwareGameViewModel }) {
  return <ContractWorkspacePage model={model} />;
}
