import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  saveFactoryAutoOperationPolicy,
  type FactoryAutoOperationPolicyInput,
} from '../../api/game';
import {
  getStateAuthoritySnapshot,
  subscribeStateAuthorityDependencies,
} from '../../app/stateDelivery.js';
import { announceFactoryAutoOperationSaved } from '../../game-guide/tutorialEvents';
import { autoOperationSuccessMessage, reportActionException, type OperationFeedback } from '../../notifications/operationFeedback';
import type { FacilityGroup } from '../../types';
import { GameConcept } from '../ui/GameConcept';
import { BuildingAutoOperationSection } from '../buildings/BuildingAutoOperationSection';
import '../../styles/factory-auto-operation.css';

const DEFAULT_POLICY: FactoryAutoOperationPolicyInput = Object.freeze({
  enabled: true,
  inputCoverageCycles: 2,
  mode: 'balanced',
  outputMode: 'surplus',
});

function policyKey(group: FacilityGroup) {
  return `${group.provinceId}:${group.facilityTypeId}`;
}

function authorityPolicy(group: FacilityGroup): FactoryAutoOperationPolicyInput {
  const state = getStateAuthoritySnapshot().state as ({
    factoryAutoOperationPolicies?: Record<string, FactoryAutoOperationPolicyInput>;
  } | null);
  return state?.factoryAutoOperationPolicies?.[policyKey(group)]
    ?? state?.factoryAutoOperationPolicies?.[group.facilityTypeId]
    ?? DEFAULT_POLICY;
}

export type FacilityAutoOperationController = {
  policy: FactoryAutoOperationPolicyInput;
  saving: boolean;
  updatePolicy: (nextPolicy: FactoryAutoOperationPolicyInput) => void;
};

export function FacilityAutoOperationControls({
  group,
  feedback,
  children,
}: {
  group: FacilityGroup;
  feedback: OperationFeedback;
  children: (controller: FacilityAutoOperationController) => ReactNode;
}) {
  const subscribe = useCallback((listener: () => void) => (
    subscribeStateAuthorityDependencies(['player.production'], listener)
  ), []);
  const sourcePolicy = useSyncExternalStore(
    subscribe,
    () => authorityPolicy(group),
    () => DEFAULT_POLICY,
  );
  const [draft, setDraft] = useState<FactoryAutoOperationPolicyInput>(sourcePolicy);
  const [saving, setSaving] = useState(false);
  const requestRef = useRef<{ key: string } | null>(null);
  const activeKeyRef = useRef<string | null>(policyKey(group));
  const key = policyKey(group);

  useEffect(() => {
    activeKeyRef.current = key;
    if (requestRef.current?.key !== key) setDraft(sourcePolicy);
    setSaving(requestRef.current?.key === key);
    return () => { activeKeyRef.current = null; };
  }, [sourcePolicy, key]);

  const save = async (nextPolicy: FactoryAutoOperationPolicyInput) => {
    if (requestRef.current?.key === key || group.count < 1) return;
    const request = { key };
    requestRef.current = request;
    const successMessage = autoOperationSuccessMessage(draft.enabled, nextPolicy.enabled);
    setDraft(nextPolicy);
    setSaving(true);
    const isCurrent = () => activeKeyRef.current === key && requestRef.current === request;
    try {
      const response = await saveFactoryAutoOperationPolicy(group.provinceId, group.facilityTypeId, nextPolicy);
      await feedback.showResult({
        ...response.result,
        message: response.result.ok ? successMessage : response.result.message || '自动经营设置保存失败',
      });
      if (!response.result.ok && isCurrent()) setDraft(authorityPolicy(group));
      if (response.result.ok) {
        const state = getStateAuthoritySnapshot().state;
        announceFactoryAutoOperationSaved({
          userId: Number(state?.userId || 0),
          provinceId: group.provinceId,
          facilityTypeId: group.facilityTypeId,
        });
      }
    } catch (reason) {
      await reportActionException(feedback, reason, '自动经营设置');
      if (isCurrent()) setDraft(authorityPolicy(group));
    } finally {
      if (isCurrent()) setSaving(false);
      if (requestRef.current === request) requestRef.current = null;
    }
  };

  const updatePolicy = (nextPolicy: FactoryAutoOperationPolicyInput) => {
    void save(nextPolicy);
  };

  return (
    <BuildingAutoOperationSection label={<GameConcept concept="factory-auto-operation">自动经营</GameConcept>}
      enabled={draft.enabled} disabled={group.count < 1 || saving}
      onChange={(enabled) => updatePolicy({ ...draft, enabled })}>
      {children({ policy: draft, saving, updatePolicy })}
    </BuildingAutoOperationSection>
  );
}
