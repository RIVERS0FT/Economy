import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import { useGameViewModel } from '../../src/app/gameViewModel';
import type { AuthUser } from '../../src/types';

const user: AuthUser = {
  id: 1,
  email: 'player@example.com',
  name: '玩家',
  role: 'user',
};

function GameViewModelProbe({ onSignedOut }: { onSignedOut: () => void }) {
  const state = useGameViewModel(user, onSignedOut);
  return <output data-testid="game-view-model-status">{state.status}</output>;
}

function Harness() {
  const [renderVersion, setRenderVersion] = useState(0);
  const [mountVersion, setMountVersion] = useState(0);

  return (
    <main>
      <button id="rerender-parent" type="button" onClick={() => setRenderVersion((current) => current + 1)}>
        rerender {renderVersion}
      </button>
      <button id="remount-game" type="button" onClick={() => setMountVersion((current) => current + 1)}>
        remount {mountVersion}
      </button>
      <GameViewModelProbe key={mountVersion} onSignedOut={() => {}} />
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
