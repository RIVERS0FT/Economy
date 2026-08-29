import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  saveFactoryAutoOperationPolicy,
  type FactoryAutoOperationMode,
  type FactoryAutoOperationOutputMode,
  type FactoryAutoOperationPolicyInput,
} from '../../api/game';
import {
  getStateAuthoritySnapshot,
  subscribeStateAuthorityDependencies,
} from '../../app/stateDelivery.js';
import type { FacilityGroup } from '../../types';
import { SelectInput } from '../ui/FormControls';
import { Button, SwitchControl } from '../ui/layout';
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

function modeDescription(mode: FactoryAutoOperationMode) {
  if (mode === 'profit') return '利润优先：压低原料采购上限，提高产成品出售底价。';
  if (mode === 'supply') return '保供优先：允许更高原料采购价，以减少生产因缺料中断。';
  return '均衡：在资金占用、连续生产与出售速度之间保持折中。';
}

export function FacilityAutoOperationControls({ group }: { group: FacilityGroup }) {
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

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await saveFactoryAutoOperationPolicy(group.provinceId, group.facilityTypeId, draft);
      setMessage(response.result.message || (response.result.ok ? '自动经营策略已保存' : '自动经营策略保存失败'));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '自动经营策略保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="facility-auto-operation mobile-detail-section" aria-label="自动经营">
      <div className="facility-auto-operation__header">
        <div>
          <strong>自动经营</strong>
          <small>按工厂生产需求自动汇总采购与出售，不需要逐商品维护库存数量。</small>
        </div>
        <SwitchControl
          checked={draft.enabled}
          aria-label={draft.enabled ? '关闭自动经营' : '开启自动经营'}
          disabled={group.count < 1 || saving}
          onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
        />
      </div>

      <div className="facility-auto-operation__grid">
        <SelectInput
          label="原料保障"
          description="系统会在下一生产周期基础上额外保护对应周期的原料库存。"
          value={String(draft.inputCoverageCycles)}
          disabled={!draft.enabled || saving}
          onChange={(event) => setDraft((current) => ({
            ...current,
            inputCoverageCycles: Number(event.target.value) as 1 | 2 | 3 | 5,
          }))}
        >
          <option value="1">1 个生产周期</option>
          <option value="2">2 个生产周期</option>
          <option value="3">3 个生产周期</option>
          <option value="5">5 个生产周期</option>
        </SelectInput>

        <SelectInput
          label="经营模式"
          description={modeDescription(draft.mode)}
          value={draft.mode}
          disabled={!draft.enabled || saving}
          onChange={(event) => setDraft((current) => ({
            ...current,
            mode: event.target.value as FactoryAutoOperationMode,
          }))}
        >
          <option value="profit">利润优先</option>
          <option value="balanced">均衡</option>
          <option value="supply">保供优先</option>
        </SelectInput>

        <SelectInput
          label="产成品处理"
          description="共享仓库中同一商品若有任一自动经营工厂要求保留，系统不会自动出售该商品。"
          value={draft.outputMode}
          disabled={!draft.enabled || saving}
          onChange={(event) => setDraft((current) => ({
            ...current,
            outputMode: event.target.value as FactoryAutoOperationOutputMode,
          }))}
        >
          <option value="surplus">满足内部需求后出售</option>
          <option value="keep">全部保留</option>
        </SelectInput>
      </div>

      <div className="facility-auto-operation__footer">
        <small className="ui-helper-text">
          系统仍通过本州统一商品订单簿执行真实买卖；合同保留与其他工厂的原料需求会一起计算，不创建工厂专属订单簿。
        </small>
        <Button onClick={() => void save()} disabled={saving || group.count < 1}>
          {saving ? '正在保存…' : '保存自动经营策略'}
        </Button>
      </div>
      {message ? <small className="facility-auto-operation__message" role="status">{message}</small> : null}
    </section>
  );
}
