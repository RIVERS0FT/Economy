import { invoke } from '@tauri-apps/api/core';

const LOCAL_SAVE_KEY = 'economy-arena-autosave';

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function saveGameState(stateJson: string) {
  if (isTauriRuntime()) {
    await invoke('save_game_state', { stateJson });
    return;
  }

  localStorage.setItem(LOCAL_SAVE_KEY, stateJson);
}

export async function loadGameState() {
  if (isTauriRuntime()) {
    return invoke<string>('load_game_state');
  }

  const saved = localStorage.getItem(LOCAL_SAVE_KEY);
  if (!saved) throw new Error('No local save found.');
  return saved;
}

export async function clearGameSave() {
  if (isTauriRuntime()) {
    await invoke('clear_save');
    return;
  }

  localStorage.removeItem(LOCAL_SAVE_KEY);
}
