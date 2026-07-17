const INVITATION_API_BASE = '/economy-api/game/invitations';

export type InvitationSource = 'share_link' | 'manual_code';
export type InvitationStatus = 'rewarded' | 'blocked_same_ip' | 'blocked_banned_account' | 'revoked';

export interface InvitationSummary {
  gems: number;
  inviteCode: string;
  shareUrl: string;
  rewardGems: number;
  successfulInvitations: number;
  shareLinkInvitations: number;
  manualCodeInvitations: number;
  invitationGemsEarned: number;
  claimExpiresAt?: number;
  claimedInvitation?: {
    inviteCode: string;
    inviterName: string;
    source: InvitationSource;
    status: InvitationStatus;
    claimedAt: number;
  };
  recentInvitations: Array<{
    playerName: string;
    source: InvitationSource;
    status: InvitationStatus;
    rewardGems: number;
    claimedAt: number;
    rewardedAt?: number;
  }>;
}

function createRequestKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `invite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function parseError(response: Response): Promise<never> {
  let message = '邀请接口请求失败';
  try {
    const payload = (await response.json()) as { message?: string };
    if (payload.message) message = payload.message;
  } catch {
    // Preserve fallback.
  }
  throw new Error(message);
}

export async function getInvitationSummary(): Promise<InvitationSummary> {
  const response = await fetch(INVITATION_API_BASE, { credentials: 'include' });
  if (!response.ok) return parseError(response);
  return ((await response.json()) as { invitation: InvitationSummary }).invitation;
}

export async function claimInvitation(inviteCode: string): Promise<{ message: string }> {
  const response = await fetch(`${INVITATION_API_BASE}/claim`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': createRequestKey(),
    },
    body: JSON.stringify({ inviteCode }),
  });
  if (!response.ok) return parseError(response);
  return response.json() as Promise<{ message: string }>;
}
