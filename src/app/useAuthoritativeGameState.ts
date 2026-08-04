import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GameApiError,
  getGameState,
  type GameActionResponse,
} from '../api/game';
import type { AuthUser, EconomyState } from '../types';
import {
  loadLocalActivity,
  syncLocalActivity,
  type LocalActivityAction,
  type LocalActivityView,
} from '../utils/localActivityStore';
import { canAcceptRevision } from './revisionGate.js';

export type RefreshMode = 'normal' | 'authoritative';
export interface RefreshOptions {
  mode?: RefreshMode;
  expectedDeadline?: number;
}

interface RefreshTask {
  controller: AbortController;
  startedAt: number;
  mode: RefreshMode;
  expectedDeadline?: number;
  promise: Promise<void>;
}

export function messageFromGameError(reason: unknown) {
  return reason instanceof Error ? reason.message : '游戏服务器请求失败';
}

export function useAuthoritativeGameState(
  user: AuthUser,
  onSignedOut: () => void,
  refreshRate: string,
) {
  const [game, setGame] = useState<EconomyState | null>(null);
  const [localActivity, setLocalActivity] = useState<LocalActivityView>(() => loadLocalActivity(user.id));
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const revisionRef = useRef<number | null>(null);
  const refreshTaskRef = useRef<RefreshTask | null>(null);
  const actionsInFlightRef = useRef(0);

  const handleUnauthorized = useCallback(() => {
    setGame(null);
    onSignedOut();
  }, [onSignedOut]);

  const acceptState = useCallback((
    state: EconomyState,
    action: LocalActivityAction,
    message?: string,
  ) => {
    setLocalActivity(syncLocalActivity(user.id, state, {
      action,
      message,
      createdAt: Date.now(),
    }));
    setGame(state);
  }, [user.id]);

  const acceptVersionedState = useCallback((
    incomingRevision: number | undefined,
    state: EconomyState | undefined,
    action: LocalActivityAction,
    message?: string,
  ) => {
    if (!canAcceptRevision(revisionRef.current, incomingRevision)) return false;
    if (typeof incomingRevision === 'number' && Number.isInteger(incomingRevision)) {
      revisionRef.current = incomingRevision;
    }
    if (state) acceptState(state, action, message);
    return true;
  }, [acceptState]);

  const refresh = useCallback((options: RefreshOptions = {}) => {
    const mode = options.mode ?? 'normal';
    if (mode === 'normal' && actionsInFlightRef.current > 0) return Promise.resolve();

    const existing = refreshTaskRef.current;
    if (existing) {
      if (mode === 'normal' || existing.mode === 'authoritative') return existing.promise;
      existing.controller.abort();
    }

    const controller = new AbortController();
    const promise = (async () => {
      try {
        const response = await getGameState(revisionRef.current, controller.signal);
        if (mode === 'normal' && actionsInFlightRef.current > 0) return;
        acceptVersionedState(response.revision, response.state, 'refresh');
        setLoadError('');
      } catch (reason) {
        if (reason instanceof Error && reason.name === 'AbortError') return;
        if (reason instanceof GameApiError && reason.status === 401) {
          handleUnauthorized();
          return;
        }
        setLoadError(messageFromGameError(reason));
      } finally {
        if (refreshTaskRef.current?.controller === controller) refreshTaskRef.current = null;
      }
    })();

    refreshTaskRef.current = {
      controller,
      startedAt: Date.now(),
      mode,
      expectedDeadline: options.expectedDeadline,
      promise,
    };
    return promise;
  }, [acceptVersionedState, handleUnauthorized]);

  useEffect(() => {
    refreshTaskRef.current?.controller.abort();
    refreshTaskRef.current = null;
    revisionRef.current = null;
    setLocalActivity(loadLocalActivity(user.id));
    void refresh();
  }, [refresh, reloadVersion, user.id]);

  useEffect(() => () => {
    refreshTaskRef.current?.controller.abort();
  }, []);

  useEffect(() => {
    if (!game) return undefined;
    const timer = window.setInterval(
      () => void refresh(),
      Math.max(1, Number(refreshRate)) * 1_000,
    );
    return () => window.clearInterval(timer);
  }, [game, refresh, refreshRate]);

  const syncConfirmedAction = useCallback(async (
    response: GameActionResponse,
    action: LocalActivityAction,
  ) => {
    try {
      const stateResponse = await getGameState(revisionRef.current);
      if (stateResponse.revision < response.revision) {
        throw new Error('服务器状态同步落后于已确认操作');
      }
      acceptVersionedState(
        stateResponse.revision,
        stateResponse.state,
        action,
        response.result.message,
      );
      setLoadError('');
    } catch (reason) {
      if (reason instanceof GameApiError && reason.status === 401) {
        handleUnauthorized();
      } else {
        setLoadError(`操作已完成，但状态同步失败：${messageFromGameError(reason)}`);
      }
    }
  }, [acceptVersionedState, handleUnauthorized]);

  const beginAction = useCallback(() => {
    actionsInFlightRef.current += 1;
    refreshTaskRef.current?.controller.abort();
  }, []);

  const endAction = useCallback(() => {
    actionsInFlightRef.current = Math.max(0, actionsInFlightRef.current - 1);
  }, []);

  const retry = useCallback(() => {
    setLoadError('');
    setReloadVersion((current) => current + 1);
  }, []);

  return {
    game,
    localActivity,
    setLocalActivity,
    loadError,
    retry,
    refresh,
    beginAction,
    endAction,
    syncConfirmedAction,
    handleUnauthorized,
  };
}
