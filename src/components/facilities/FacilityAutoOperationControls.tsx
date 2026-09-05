import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  saveFactoryAutoOperationPolicy,
  type FactoryAutoOperationPolicyInput,
} from '../../api/game';
import {
  getStateAuthoritySnapshot,
  subscribeStateAuthorityDependencies,
} from '../../app/stateDelivery.js';
import { announceFactoryAutoOperationSaved } from '../../game-guide/tutorialEvents';
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
  children,
}: {
  group: FacilityGroup;
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
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDraft(sourcePolicy);
  }, [sourcePolicy, group.facilityTypeId, group.provinceId]);

  const save = async (nextPolicy: FactoryAutoOperationPolicyInput) => {
    setSaving(true);
    setMessage('');
    try {
      const response = await saveFactoryAutoOperationPolicy(group.provinceId, group.facilityTypeId, nextPolicy);
      setMessage(response.result.message || (response.result.ok ? '自动经营策略已保存' : '自动经营策略保存失败'));
      if (response.result.ok) {
        const state = getStateAuthoritySnapshot().state;
        announceFactoryAutoOperationSaved({
          userId: Number(state?.userId || 0),
          provinceId: group.provinceId,
          facilityTypeId: group.facilityTypeId,
        });
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '自动经营策略保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updatePolicy = (nextPolicy: FactoryAutoOperationPolicyInput) => {
    setDraft(nextPolicy);
    void save(nextPolicy);
  };

  return (
    <BuildingAutoOperationSection label={<GameConcept concept="factory-auto-operation">自动经营</GameConcept>}
      enabled={draft.enabled} disabled={group.count < 1 || saving}
      onChange={(enabled) => updatePolicy({ ...draft, enabled })} message={message}>
      {children({ policy: draft, saving, updatePolicy })}
    </BuildingAutoOperationSection>
  );
}
