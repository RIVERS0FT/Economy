import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { LoadedGameViewModel } from '../../src/app/gameViewModel';
import { SettingsPage } from '../../src/pages/SettingsPage';
import { loadLocalActivity } from '../../src/utils/localActivityStore';
import '../../src/styles/globals.css';
import '../../src/styles/card-system.css';
import '../../src/styles/design-system.css';

const localActivityResult = loadLocalActivity(123);
Object.assign(window, { __localActivityResult: localActivityResult });

function RuntimeHarness() {
  const [playerName, setPlayerName] = useState('测试玩家');
  const [compactNumbers, setCompactNumbers] = useState(false);
  const [refreshRate, setRefreshRate] = useState('5');
  const model = {
    user: { id: 123, email: 'runtime@example.com', role: 'user' },
    game: {
      playerName: '测试玩家',
      registeredAt: Date.UTC(2026, 6, 17),
      stats: {
        workClicks: 12,
        producedGoods: 34,
        boughtGoods: 56,
        soldGoods: 78,
      },
    },
    avatarText: '测',
    playerName,
    setPlayerName,
    compactNumbers,
    setCompactNumbers,
    refreshRate,
    setRefreshRate,
    renamePlayer: async () => ({ ok: true, message: '昵称已保存' }),
    redeemGift: async () => ({ ok: false, message: '测试环境不兑换礼品' }),
    showResult: async () => {},
    notify: () => {},
    signOut: async () => {},
    reset: async () => ({ ok: true, message: '测试环境已重置' }),
  } as unknown as LoadedGameViewModel;

  return <SettingsPage model={model} />;
}

createRoot(document.getElementById('root') as HTMLElement).render(<RuntimeHarness />);
