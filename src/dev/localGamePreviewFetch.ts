const INSTALL_MARKER = '__economyLocalGamePreviewFetchInstalled';

type PreviewWindow = Window & typeof globalThis & {
  [INSTALL_MARKER]?: boolean;
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return new URL(input, window.location.origin);
  if (input instanceof URL) return input;
  return new URL(input.url, window.location.origin);
}

export function installLocalGamePreviewFetch() {
  const previewWindow = window as PreviewWindow;
  if (previewWindow[INSTALL_MARKER]) return;
  previewWindow[INSTALL_MARKER] = true;
  const networkFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = requestUrl(input);
    if (!url.pathname.startsWith('/economy-api')) return networkFetch(input, init);

    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET') {
      return jsonResponse({ message: '免登录游戏模式使用本地模拟数据，不会提交真实操作。' }, 409);
    }

    if (url.pathname === '/economy-api/game/community-link') {
      return jsonResponse({
        communityLink: { qqGroupUrl: 'https://qm.qq.com/q/eN8hya0Yn0', updatedAt: null },
      });
    }
    if (url.pathname === '/economy-api/game/gem-shop') {
      const now = Date.now();
      return jsonResponse({
        gemShop: {
          gems: 36,
          credits: 128_600,
          quoteDateKey: 'LOCAL-PREVIEW',
          creditsPerGem: 1_280,
          previousCreditsPerGem: 1_240,
          rateDelta: 40,
          nextRateAt: now + 12 * 60 * 60_000,
          demandTone: 'high',
          demandPressurePpm: 84_000,
          quoteDecision: 'pending',
          quoteDecisionAt: null,
          minExchangeGems: 1,
          maxExchangeGems: 100,
          maxExchangeableGems: 36,
          totalGemsSpent: 8,
          totalCreditsReceived: 9_600,
          recentExchanges: [
            { gemsSpent: 5, creditsReceived: 6_000, creditsPerGem: 1_200, dateKey: 'LOCAL-1', createdAt: now - 3 * 86_400_000 },
            { gemsSpent: 3, creditsReceived: 3_600, creditsPerGem: 1_200, dateKey: 'LOCAL-2', createdAt: now - 7 * 86_400_000 },
          ],
          recentRates: [
            { dateKey: 'LOCAL-1', creditsPerGem: 1_280, demandTone: 'high' },
            { dateKey: 'LOCAL-2', creditsPerGem: 1_240, demandTone: 'neutral' },
          ],
        },
      });
    }
    if (url.pathname === '/economy-api/game/invitations') {
      return jsonResponse({
        invitation: {
          gems: 36,
          inviteCode: 'LOCAL2026',
          shareUrl: `${window.location.origin}/economy/?invite=LOCAL2026`,
          rewardGems: 5,
          successfulInvitations: 3,
          shareLinkInvitations: 2,
          manualCodeInvitations: 1,
          invitationGemsEarned: 15,
          recentInvitations: [
            { playerName: '预览好友', source: 'share_link', status: 'rewarded', rewardGems: 5, claimedAt: Date.now() - 2 * 86_400_000 },
          ],
        },
      });
    }
    if (url.pathname === '/economy-api/game/contracts/performance') {
      return jsonResponse({
        performance: {
          totalEnded: 12,
          completed: 11,
          abnormalEnded: 1,
          defaulted: 0,
          completionRateBps: 9_167,
          compensationPaid: 0,
          compensationReceived: 240,
          recent: [],
        },
      });
    }
    if (url.pathname === '/economy-api/game/contracts/history') {
      return jsonResponse({ history: { items: [], nextCursor: null } });
    }
    if (url.pathname === '/economy-api/game/save-deletion/preflight') {
      return jsonResponse({
        preflight: {
          allowed: false,
          blockers: [{ type: 'local_preview', message: '免登录游戏模式不会删除任何存档。', targetTab: 'settings' }],
          autoClose: { orders: 0, facilityListings: 0, auctions: 0, contracts: 0 },
          saveEpoch: 1,
          checkedAt: Date.now(),
          revision: 1,
        },
      });
    }
    const auctionHistoryMatch = url.pathname.match(/^\/economy-api\/game\/auctions\/([^/]+)\/bids$/);
    if (auctionHistoryMatch) {
      return jsonResponse({
        history: {
          auctionId: decodeURIComponent(auctionHistoryMatch[1]),
          bidCount: 0,
          latestBidAt: null,
          bids: [],
        },
      });
    }

    return new Response(null, { status: 503 });
  };
}
