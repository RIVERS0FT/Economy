import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { LatestConfigurationQueue } from '../app/latestConfigurationQueue';
import { getStateAuthoritySnapshot } from '../app/stateDelivery.js';
import { subscribeGameWriteSession } from '../api/gameWriteSession';
import type { FacilityGroup } from '../types';

let sessionGeneration = 0;
const queues = new Map<string, LatestConfigurationQueue<string>>();
subscribeGameWriteSession(() => {
  sessionGeneration += 1;
  for (const queue of queues.values()) queue.dispose();
  queues.clear();
});
const clusterKey = (provinceId: string, facilityTypeId: string) => `${provinceId}:${facilityTypeId}`;

export function useFacilityRecipeConfiguration(model: LoadedGameViewModel) {
  const scope = `${sessionGeneration}:${model.user.id}:${model.game.saveEpoch}`;
  let queue = queues.get(scope);
  if (!queue) {
    // A save reset must discard unsent commands even when the same user stays signed in.
    for (const [key, old] of queues) { old.dispose(); queues.delete(key); }
    queue = new LatestConfigurationQueue<string>();
    queues.set(scope, queue);
  }
  const controller = queue;
  const version = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const authority = useMemo(() => {
    const groups = [...Object.values(model.game.provinceFacilityGroups ?? {}).flat(), ...model.game.facilityGroups];
    return new Map(groups.map((group) => [clusterKey(group.provinceId || model.selectedProvinceId, group.facilityTypeId), group.activeRecipeId]));
  }, [model.game.provinceFacilityGroups, model.game.facilityGroups, model.selectedProvinceId]);
  const snapshot = getStateAuthoritySnapshot();
  const revision = snapshot.state?.userId === model.user.id && snapshot.state.saveEpoch === model.game.saveEpoch
    ? snapshot.revision ?? undefined : undefined;
  useEffect(() => { controller.reconcile(authority, revision); }, [controller, authority, revision, version]);

  function project(group: FacilityGroup) {
    const recipeId = controller.read(clusterKey(group.provinceId || model.selectedProvinceId, group.facilityTypeId), group.activeRecipeId);
    return recipeId === group.activeRecipeId ? group : { ...group, activeRecipeId: recipeId };
  }
  function setRecipes(targets: Array<{ provinceId: string; facilityTypeId: string; recipeId: string }>, batch = true) {
    controller.enqueue(targets.map((target) => ({ key: clusterKey(target.provinceId, target.facilityTypeId), value: target.recipeId })), authority,
      async (pending) => {
        const requested = pending.map(({ key, value }) => {
          const separator = key.indexOf(':');
          return { provinceId: key.slice(0, separator), facilityTypeId: key.slice(separator + 1), recipeId: value };
        });
        if ((batch || requested.length > 1) && model.setFacilityRecipes) return model.setFacilityRecipes(requested);
        const target = requested[0];
        if (requested.length === 1 && target.provinceId === model.selectedProvinceId) {
          return model.setFacilityRecipe(target.facilityTypeId, target.recipeId);
        }
        return { ok: false, message: '当前环境不支持跨地区生产配置' };
      }, (result) => { void model.showResult(result); });
  }
  return { version, project, setRecipes };
}
