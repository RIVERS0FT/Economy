import { useEffect, useRef } from 'react';
import { gameActions } from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  getStateAuthoritySnapshot,
  subscribeStateAuthorityDependencies,
} from '../app/stateDelivery.js';
import { estimateServerNow } from '../utils/serverClock.js';
import { createTransportCoordinator } from './transportCoordinator.js';
import { transportMaintenanceCandidates } from './transportPlanning.js';

export function useOnlineTransport(model: LoadedGameViewModel) {
  const modelRef = useRef(model);
  modelRef.current = model;
  const userId = model.user.id;
  const saveEpoch = model.game.saveEpoch;

  useEffect(() => {
    function currentGame() {
      const game = getStateAuthoritySnapshot().state;
      if (!game || game.userId !== userId || game.saveEpoch !== saveEpoch
        || modelRef.current.user.id !== userId || modelRef.current.game.saveEpoch !== saveEpoch) return null;
      return game;
    }

    const coordinator = createTransportCoordinator({
      getCandidates(lastRouteId) {
        const game = currentGame();
        if (!game) return [];
        const now = estimateServerNow(game.lastProcessedAt);
        return transportMaintenanceCandidates(game, now, lastRouteId).map((command) => ({
          key: command.key,
          routeId: command.routeId,
          fingerprint: command.fingerprint,
          run: () => command.kind === 'start'
            ? gameActions.startTransportCycle(command.routeId, command.load)
            : gameActions.serviceTransportNode(
              command.routeId, command.cycleId, command.visitIndex, command.unload, command.load,
            ),
        }));
      },
      refresh: () => currentGame()
        ? modelRef.current.refresh({ mode: 'authoritative' })
        : Promise.resolve(),
      async onFailure(message) {
        if (currentGame()) await modelRef.current.showResult({ ok: false, message });
      },
    });
    const unsubscribe = subscribeStateAuthorityDependencies(
      ['catalog', 'player.assets', 'player.misc', 'market.quotes'],
      coordinator.notify,
    );
    coordinator.notify();
    return () => {
      coordinator.stop();
      unsubscribe();
    };
  }, [saveEpoch, userId]);
}
