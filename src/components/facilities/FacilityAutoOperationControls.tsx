import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { saveFactoryAutoOperationPolicy, type FactoryAutoOperationPolicyInput } from '../../api/game';
import { subscribeGameWriteSession } from '../../api/gameWriteSession';
import { getStateAuthoritySnapshot, subscribeStateAuthorityDependencies } from '../../app/stateDelivery.js';
import { LatestConfigurationQueue, isUnconfirmedConfiguration } from '../../app/latestConfigurationQueue';
import { announceFactoryAutoOperationSaved } from '../../game-guide/tutorialEvents';
import { autoOperationSuccessMessage, type OperationFeedback } from '../../notifications/operationFeedback';
import type { FacilityGroup } from '../../types';
import { GameConcept } from '../ui/GameConcept';
import { BuildingAutoOperationSection } from '../buildings/BuildingAutoOperationSection';
import '../../styles/factory-auto-operation.css';

const DEFAULT_POLICY: FactoryAutoOperationPolicyInput = Object.freeze({
  enabled: true, inputCoverageCycles: 2, mode: 'balanced', outputMode: 'surplus',
});
const samePolicy = (left: FactoryAutoOperationPolicyInput, right: FactoryAutoOperationPolicyInput) => (
  left.enabled === right.enabled && left.inputCoverageCycles === right.inputCoverageCycles
  && left.mode === right.mode && left.outputMode === right.outputMode
);
let scope = '';
let queue = new LatestConfigurationQueue<FactoryAutoOperationPolicyInput>(samePolicy);
subscribeGameWriteSession(() => { queue.dispose(); scope = ''; queue = new LatestConfigurationQueue(samePolicy); });
function policyKey(group: FacilityGroup) { return `${group.provinceId}:${group.facilityTypeId}`; }
function authorityPolicy(group: FacilityGroup): FactoryAutoOperationPolicyInput {
  const policies = (getStateAuthoritySnapshot().state as { factoryAutoOperationPolicies?: Record<string, FactoryAutoOperationPolicyInput> } | null)?.factoryAutoOperationPolicies;
  return policies?.[policyKey(group)] ?? policies?.[group.facilityTypeId] ?? DEFAULT_POLICY;
}
export type FacilityAutoOperationController = {
  policy: FactoryAutoOperationPolicyInput;
  saving: boolean;
  updatePolicy: (nextPolicy: Partial<FactoryAutoOperationPolicyInput>) => void;
};

export function FacilityAutoOperationControls({ group, feedback, children }: {
  group: FacilityGroup;
  feedback: OperationFeedback;
  children: (controller: FacilityAutoOperationController) => ReactNode;
}) {
  const state = getStateAuthoritySnapshot().state;
  const nextScope = state ? `${state.userId}:${state.saveEpoch}` : scope || 'preview';
  if (scope !== nextScope) { queue.dispose(); queue = new LatestConfigurationQueue(samePolicy); scope = nextScope; }
  const controller = queue;
  const key = policyKey(group);
  const subscribe = useCallback((listener: () => void) => subscribeStateAuthorityDependencies(['player.production'], listener), []);
  const sourcePolicy = useSyncExternalStore(subscribe, () => authorityPolicy(group), () => DEFAULT_POLICY);
  const version = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    const snapshot = getStateAuthoritySnapshot();
    if (!snapshot.state) return;
    const groups = Object.values(snapshot.state.provinceFacilityGroups ?? {}).flat();
    const authority = new Map([...groups, ...snapshot.state.facilityGroups]
      .map((candidate) => [policyKey(candidate), authorityPolicy(candidate)]));
    controller.reconcile(authority, snapshot.revision ?? undefined);
  }, [controller, sourcePolicy, key, version]);
  const draft = controller.read(key, sourcePolicy);
  function updatePolicy(patch: Partial<FactoryAutoOperationPolicyInput>) {
    if (group.count < 1) return;
    const previous = controller.read(key, authorityPolicy(group));
    const nextPolicy = { ...previous, ...patch };
    const successMessage = autoOperationSuccessMessage(previous.enabled, nextPolicy.enabled);
    controller.enqueue([{ key, value: nextPolicy }], new Map([[key, authorityPolicy(group)]]), async (targets) => {
      const response = await saveFactoryAutoOperationPolicy(group.provinceId, group.facilityTypeId, targets[0].value);
      return { ...response.result, revision: response.revision };
    }, (result) => {
      if (isUnconfirmedConfiguration(result)) {
        feedback.notify('自动经营设置结果未确认，请核对服务器状态', 'warning');
        void feedback.refresh({ mode: 'authoritative' }).catch(() => {});
        return;
      }
      void feedback.showResult({ ...result, message: result.ok ? successMessage : result.message || '自动经营设置保存失败' });
      if (result.ok) {
        announceFactoryAutoOperationSaved({ userId: Number(state?.userId || 0), provinceId: group.provinceId, facilityTypeId: group.facilityTypeId });
        const snapshot = getStateAuthoritySnapshot();
        if (result.revision !== undefined && (snapshot.revision ?? -1) < result.revision) {
          void feedback.refresh({ mode: 'authoritative' });
        }
      }
    });
  }
  const saving = controller.isBusy(key);
  return (
    <BuildingAutoOperationSection label={<GameConcept concept="factory-auto-operation">自动经营</GameConcept>}
      enabled={draft.enabled} disabled={group.count < 1}
      onChange={(enabled) => updatePolicy({ enabled })}>
      {children({ policy: draft, saving, updatePolicy })}
    </BuildingAutoOperationSection>
  );
}
