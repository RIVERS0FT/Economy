import { GameApiError } from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';

export type OperationFeedback = Pick<LoadedGameViewModel, 'notify' | 'showResult' | 'refresh'>;

export function autoOperationSuccessMessage(previousEnabled: boolean, nextEnabled: boolean) {
  return previousEnabled === nextEnabled ? '自动经营设置已更新' : nextEnabled ? '自动经营已开启' : '自动经营已关闭';
}

/** A lost response is not proof that the server rejected the mutation. Never resubmit it here. */
export async function reportActionException(feedback: OperationFeedback, reason: unknown, action: string) {
  if (reason instanceof GameApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 408) {
    await feedback.showResult({ ok: false, message: reason.message });
    return;
  }
  feedback.notify(`${action}结果未确认，请以同步后的服务器状态为准。`, 'warning');
  try {
    await feedback.refresh({ mode: 'authoritative' });
  } catch {
    // The existing warning remains valid when the read also fails; do not claim a rollback succeeded.
  }
}
