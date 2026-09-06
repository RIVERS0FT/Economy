/** Serial event-driven pump. It has no timer and never retries unchanged inputs. */
export function createTransportCoordinator({ getCandidates, refresh, onFailure }) {
  let stopped = false;
  let requested = false;
  let task = null;
  let lastRouteId = null;
  const attempted = new Map();

  async function report(message) {
    if (stopped || !onFailure) return;
    try { await onFailure(message); } catch { /* Reporting must not break the pump. */ }
  }

  async function drain() {
    try {
      while (requested && !stopped) {
        requested = false;
        const candidates = getCandidates(lastRouteId);
        const routeIds = new Set(candidates.map((candidate) => candidate.routeId));
        for (const routeId of attempted.keys()) {
          if (!routeIds.has(routeId)) attempted.delete(routeId);
        }
        const candidate = candidates.find((entry) => {
          const previous = attempted.get(entry.routeId);
          return !previous || previous.key !== entry.key || previous.fingerprint !== entry.fingerprint;
        });
        if (!candidate) break;
        lastRouteId = candidate.routeId;
        attempted.set(candidate.routeId, { key: candidate.key, fingerprint: candidate.fingerprint });
        try {
          const response = await candidate.run();
          if (!response?.result?.ok) await report(response?.result?.message || '运输操作未完成，正在确认服务器状态');
        } catch {
          await report('运输操作结果未确认，正在同步服务器状态');
        }
        if (stopped) break;
        try { await refresh(); } catch { await report('运输状态暂未同步，将在权威状态更新后继续'); }
        // Drain other routes even after a failure. A coalesced notification or
        // an acknowledged state change is observed on the next iteration.
        requested = true;
      }
    } catch {
      requested = false;
      await report('运输规划暂未就绪，将在权威状态更新后重试');
    }
  }

  function notify() {
    if (stopped) return;
    requested = true;
    if (task) return;
    task = drain().finally(() => {
      task = null;
      if (requested && !stopped) notify();
    });
  }

  return {
    notify,
    stop() { stopped = true; requested = false; attempted.clear(); },
    whenIdle() { return task ?? Promise.resolve(); },
  };
}
