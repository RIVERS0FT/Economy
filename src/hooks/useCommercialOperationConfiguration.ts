import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { getStateAuthoritySnapshot } from '../app/stateDelivery.js';
import { LatestConfigurationQueue, isUnconfirmedConfiguration } from '../app/latestConfigurationQueue';
import { subscribeGameWriteSession } from '../api/gameWriteSession';
import { runCommercialBuildingAction } from '../api/commercial';
import { commercialAutoOperationPolicyFor } from '../../shared/commercial-auto-operation.js';
import { autoOperationSuccessMessage } from '../notifications/operationFeedback';
import type { CommercialAutoOperationPolicy, CommercialBuildingGroup, CommercialStateFields } from '../types/commercial';

const equalPolicy = (a: CommercialAutoOperationPolicy, b: CommercialAutoOperationPolicy) => (
  a.enabled === b.enabled && a.inputCoverageCycles === b.inputCoverageCycles
);
let scope = '';
let queue = new LatestConfigurationQueue(equalPolicy);
subscribeGameWriteSession(() => { queue.dispose(); queue = new LatestConfigurationQueue(equalPolicy); scope = ''; });
const keyFor = (group: CommercialBuildingGroup) => `${group.provinceId}:${group.commercialTypeId}`;

export function useCommercialOperationConfiguration(model: LoadedGameViewModel) {
  const nextScope = `${model.user.id}:${model.game.saveEpoch}`;
  if (scope !== nextScope) { queue.dispose(); queue = new LatestConfigurationQueue(equalPolicy); scope = nextScope; }
  const controller = queue;
  const version = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const groups = (model.game as typeof model.game & CommercialStateFields).commercialBuildingGroups;
  const authority = useMemo(() => new Map((groups ?? []).map((group) => [keyFor(group), commercialAutoOperationPolicyFor(group)])), [groups]);
  const snapshot = getStateAuthoritySnapshot();
  const revision = snapshot.state?.userId === model.user.id && snapshot.state.saveEpoch === model.game.saveEpoch
    ? snapshot.revision ?? undefined : undefined;
  useEffect(() => { controller.reconcile(authority, revision); }, [controller, authority, revision, version]);
  function project(group: CommercialBuildingGroup) {
    return { ...group, autoOperationPolicy: controller.read(keyFor(group), commercialAutoOperationPolicyFor(group)) };
  }
  function update(group: CommercialBuildingGroup, patch: Partial<CommercialAutoOperationPolicy>) {
    const key = keyFor(group);
    const previous = controller.read(key, commercialAutoOperationPolicyFor(group));
    const value = { ...previous, ...patch };
    controller.enqueue([{ key, value }], authority, async ([target]) => runCommercialBuildingAction(Number(model.game.saveEpoch || 0), {
      operation: 'auto-operation', provinceId: group.provinceId, commercialTypeId: group.commercialTypeId, policy: target.value,
    }), (result) => {
      if (isUnconfirmedConfiguration(result)) {
        model.notify('自动经营设置结果未确认，请核对服务器状态', 'warning');
        void model.refresh({ mode: 'authoritative' }).catch(() => {});
        return;
      }
      void model.showResult({ ...result, message: result.ok ? autoOperationSuccessMessage(previous.enabled, value.enabled) : result.message });
      if (result.ok && result.revision !== undefined && (getStateAuthoritySnapshot().revision ?? -1) < result.revision) {
        void model.refresh({ mode: 'authoritative' }).catch(() => model.notify('自动经营设置已完成，但状态同步失败', 'warning'));
      }
    });
  }
  return { project, update };
}
