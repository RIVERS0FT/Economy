import { useSyncExternalStore } from 'react';

export type InputModality = 'mouse' | 'touch' | 'keyboard';

type Listener = () => void;

let installed = false;
let modality: InputModality = 'mouse';
const listeners = new Set<Listener>();

function detectInitialModality(): InputModality {
  if (typeof window === 'undefined') return 'mouse';
  return window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'mouse';
}

function publish(next: InputModality) {
  modality = next;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.inputModality = next;
  }
  listeners.forEach((listener) => listener());
}

export function configureInputModality() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (installed) {
    document.documentElement.dataset.inputModality = modality;
    return;
  }

  installed = true;
  publish(detectInitialModality());

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') publish('touch');
    else if (event.pointerType === 'mouse') publish('mouse');
  }, { capture: true, passive: true });

  window.addEventListener('wheel', () => publish('mouse'), { capture: true, passive: true });
  window.addEventListener('keydown', () => publish('keyboard'), { capture: true });
}

export function getInputModality(): InputModality {
  return modality;
}

export function subscribeInputModality(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInputModality() {
  if (typeof window !== 'undefined' && !installed) configureInputModality();
  return useSyncExternalStore(
    subscribeInputModality,
    getInputModality,
    () => 'mouse',
  );
}
