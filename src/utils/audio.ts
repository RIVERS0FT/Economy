type SfxKind = 'click' | 'trade' | 'accept' | 'reject' | 'round' | 'win';

let enabled = localStorage.getItem('economy-sound') !== 'off';
let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

const tones: Record<SfxKind, [number, number]> = {
  click: [440, 0.05],
  trade: [660, 0.08],
  accept: [880, 0.12],
  reject: [220, 0.12],
  round: [520, 0.16],
  win: [1040, 0.22],
};

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(next: boolean) {
  enabled = next;
  localStorage.setItem('economy-sound', next ? 'on' : 'off');
}

export function playSfx(kind: SfxKind) {
  if (!enabled) return;

  try {
    const ctx = getAudioContext();
    const [frequency, duration] = tones[kind];
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration + 0.02);
  } catch {
    // Audio is optional; ignore browser autoplay or context errors.
  }
}
