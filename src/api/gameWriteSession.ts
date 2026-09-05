export class GameWriteSessionChangedError extends Error {
  readonly code = 'WRITE_SESSION_CHANGED';
  constructor() { super('登录账号已变化，原操作仅能在原账号中确认，请重新登录后核对。'); this.name = 'GameWriteSessionChangedError'; }
}
export interface GameWriteSession { readonly userId: number | null; readonly generation: number; readonly signal: AbortSignal; }
let generation = 0;
let controller = new AbortController();
let current: GameWriteSession = { userId: null, generation, signal: controller.signal };
const listeners = new Set<() => void>();
function rotate(userId: number | null, closed: boolean) {
  controller.abort(new GameWriteSessionChangedError());
  controller = new AbortController();
  current = { userId, generation: ++generation, signal: controller.signal };
  if (closed) controller.abort(new GameWriteSessionChangedError());
  for (const listener of listeners) listener();
}
export function beginGameWriteSession(userId: number) {
  if (!Number.isSafeInteger(userId) || userId < 1) throw new TypeError('Invalid game write identity');
  if (current.userId !== userId || current.signal.aborted) rotate(userId, false);
}
export function endGameWriteSession() { rotate(null, true); }
export function captureGameWriteSession() { assertGameWriteSession(current); return current; }
export function isCurrentGameWriteSession(session: GameWriteSession) { return session === current && !session.signal.aborted; }
export function assertGameWriteSession(session: GameWriteSession) {
  if (!isCurrentGameWriteSession(session)) throw new GameWriteSessionChangedError();
}
export function subscribeGameWriteSession(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
