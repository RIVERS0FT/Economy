import { useEffect, useMemo, useRef, useState } from 'react';
import {
  adminApi,
  createAdminRequestKey,
  type PopulationEconomyAdminSummary,
  type PopulationModelId,
  type PopulationPolicyPayload,
} from '../api/admin';
import { formatCurrency, formatDate } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import { CurrencyAmount } from './ui/CurrencyAmount';
import { IntegerInput, SelectInput } from './ui/FormControls';
import { Button, StatusTag } from './ui/layout';
import { AdminPopulationHealth } from './AdminPopulationHealth';

type DurationMode = 'temporary' | 'permanent';

type Draft = {
  sharePercent: string;
  productionWagePercent: string;
  targetCycles: string;
  refillPercent: string;
  basicPercent: string;
  skilledPercent: string;
  professionalPercent: string;
  durationCycles: string;
};

type ParameterDraft = Omit<Draft, 'durationCycles'>;
type PopulationPolicyRequest = PopulationPolicyPayload & { durationMode: DurationMode };

function policyDurationCycles(economy: PopulationEconomyAdminSummary) {
  const { effectiveCycleId, expiresAfterCycleId } = economy.policy;
  if (expiresAfterCycleId === null) return null;
  return Math.max(1, expiresAfterCycleId - effectiveCycleId);
}

function durationModeFromEconomy(economy: PopulationEconomyAdminSummary): DurationMode {
  return !economy.policy.isDefault && economy.policy.expiresAfterCycleId === null ? 'permanent' : 'temporary';
}

function draftFromEconomy(economy: PopulationEconomyAdminSummary): Draft {
  const remainingCycles = !economy.policy.isDefault && economy.policy.remainingCycles !== null
    ? Math.max(1, economy.policy.remainingCycles)
    : 12;
  return {
    sharePercent: String(economy.policy.stabilizationShareBps / 100),
    productionWagePercent: String(economy.policy.productionWageMultiplierBps / 100),
    targetCycles: String(economy.policy.targetWalletCycles),
    refillPercent: String(economy.policy.refillCapBps / 100),
    basicPercent: String(economy.policy.modelMultipliersBps.basic / 100),
    skilledPercent: String(economy.policy.modelMultipliersBps.skilled / 100),
    professionalPercent: String(economy.policy.modelMultipliersBps.professional / 100),
    durationCycles: String(remainingCycles),
  };
}

function percentToBps(value: number) {
  const result = value * 100;
  return Number.isSafeInteger(result) ? result : null;
}

function roundMoney(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function calculatePreviewBudget(economy: PopulationEconomyAdminSummary, payload: PopulationPolicyPayload) {
  const maximum = roundMoney(economy.policyBaseBudget * payload.stabilizationShareBps / 10_000);
  if (!Number.isSafeInteger(Math.round(maximum * 1_000_000))) return null;
  const populations = {
    basic: Math.max(0, economy.models.basic.population),
    skilled: Math.max(0, economy.models.skilled.population),
    professional: Math.max(0, economy.models.professional.population),
  };
  const totalPopulation = populations.basic + populations.skilled + populations.professional;
  if (totalPopulation <= 0) return 0;
  const adjusted = (Object.keys(populations) as PopulationModelId[]).reduce((sum, modelId) => {
    const base = maximum * populations[modelId] / totalPopulation;
    return sum + base * payload.modelMultipliersBps[modelId] / 10_000;
  }, 0);
  const result = roundMoney(Math.min(maximum, adjusted));
  return Number.isSafeInteger(Math.round(result * 1_000_000)) ? result : null;
}

function durationLabel(cycles: number | null) {
  if (cycles === null) return '长期';
  if (cycles > Math.floor(Number.MAX_SAFE_INTEGER / 5)) return `${cycles} 个周期`;
  const minutes = cycles * 5;
  if (minutes < 60) return `${cycles} 个周期（${minutes} 分钟）`;
  if (minutes < 24 * 60) return `${cycles} 个周期（约 ${Math.round(minutes / 6) / 10} 小时）`;
  return `${cycles} 个周期（约 ${Math.round(minutes / 144) / 10} 天）`;
}

export function AdminPopulationControl({
  economy,
  onChanged,
  onNotice,
}: {
  economy: PopulationEconomyAdminSummary;
  onChanged: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromEconomy(economy));
  const [durationMode, setDurationMode] = useState<DurationMode>(() => durationModeFromEconomy(economy));
  const [targetModel, setTargetModel] = useState<PopulationModelId | 'all'>('all');
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestKeyRef = useRef('');

  useEffect(() => {
    setDraft(draftFromEconomy(economy));
    setDurationMode(durationModeFromEconomy(economy));
  }, [economy.policy.updatedAt, economy.policy.expiresAfterCycleId]);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    requestKeyRef.current = '';
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function chooseDurationMode(nextMode: DurationMode) {
    requestKeyRef.current = '';
    setDurationMode(nextMode);
  }

  const payload = useMemo<PopulationPolicyRequest | null>(() => {
    const share = parseIntegerDraft(draft.sharePercent, { min: 0 });
    const productionWage = parseIntegerDraft(draft.productionWagePercent, { min: 50 });
    const target = parseIntegerDraft(draft.targetCycles, { min: 1 });
    const refill = parseIntegerDraft(draft.refillPercent, { min: 0 });
    const basic = parseIntegerDraft(draft.basicPercent, { min: 50 });
    const skilled = parseIntegerDraft(draft.skilledPercent, { min: 50 });
    const professional = parseIntegerDraft(draft.professionalPercent, { min: 50 });
    const duration = durationMode === 'temporary'
      ? parseIntegerDraft(draft.durationCycles, { min: 1 })
      : 1;
    if ([share, productionWage, target, refill, basic, skilled, professional, duration].some((value) => value === null)) return null;
    const shareBps = percentToBps(share!);
    const productionWageBps = percentToBps(productionWage!);
    const refillBps = percentToBps(refill!);
    const basicBps = percentToBps(basic!);
    const skilledBps = percentToBps(skilled!);
    const professionalBps = percentToBps(professional!);
    if ([shareBps, productionWageBps, refillBps, basicBps, skilledBps, professionalBps].some((value) => value === null)) return null;
    return {
      stabilizationShareBps: shareBps!,
      productionWageMultiplierBps: productionWageBps!,
      targetWalletCycles: target!,
      refillCapBps: refillBps!,
      modelMultipliersBps: {
        basic: basicBps!,
        skilled: skilledBps!,
        professional: professionalBps!,
      },
      durationMode,
      durationCycles: duration!,
    };
  }, [draft, durationMode]);

  const previewBudget = payload ? calculatePreviewBudget(economy, payload) : null;
  const automaticIssued = Object.values(economy.policy.currentCycleIssued.automaticByModel).reduce((sum, value) => sum + value, 0);
  const adminIssued = Object.values(economy.policy.currentCycleIssued.adminByModel).reduce((sum, value) => sum + value, 0);
  const currentDuration = policyDurationCycles(economy);
  const currentPolicyKind = economy.policy.isDefault
    ? 'default'
    : economy.policy.expiresAfterCycleId === null
      ? 'permanent'
      : 'temporary';
  const currentPolicyDescription = currentPolicyKind === 'default'
    ? '当前使用模型默认政策'
    : currentPolicyKind === 'permanent'
      ? '当前使用永久自定义政策'
      : '当前使用限时政策';
  const currentPolicyLabel = currentPolicyKind === 'default' ? '默认' : currentPolicyKind === 'permanent' ? '永久' : '限时';
  const currentTotalDuration = currentPolicyKind === 'default'
    ? '长期'
    : currentPolicyKind === 'permanent'
      ? '永久'
      : durationLabel(currentDuration);
  const currentElapsed = currentPolicyKind === 'default'
    ? '模型默认'
    : `${economy.policy.elapsedCycles ?? 0} 个周期`;
  const effectiveAt = economy.policy.effectiveAt;
  const expiresAt = economy.policy.expiresAt;

  function usePreset(name: 'default' | 'mild' | 'strong' | 'tight' | 'pause') {
    const presets: Record<typeof name, ParameterDraft> = {
      default: { sharePercent: '12', productionWagePercent: '100', targetCycles: '3', refillPercent: '100', basicPercent: '100', skilledPercent: '100', professionalPercent: '100' },
      mild: { sharePercent: '15', productionWagePercent: '110', targetCycles: '4', refillPercent: '100', basicPercent: '110', skilledPercent: '100', professionalPercent: '90' },
      strong: { sharePercent: '25', productionWagePercent: '180', targetCycles: '8', refillPercent: '250', basicPercent: '160', skilledPercent: '120', professionalPercent: '80' },
      tight: { sharePercent: '6', productionWagePercent: '90', targetCycles: '2', refillPercent: '50', basicPercent: '100', skilledPercent: '100', professionalPercent: '100' },
      pause: { sharePercent: '0', productionWagePercent: '100', targetCycles: '3', refillPercent: '0', basicPercent: '100', skilledPercent: '100', professionalPercent: '100' },
    };
    requestKeyRef.current = '';
    setDraft((current) => ({ ...current, ...presets[name] }));
  }

  async function applyPolicy() {
    if (!payload || previewBudget === null || busy) {
      onNotice(previewBudget === null && payload ? '政策计算结果超出系统可预览范围，请降低参数后重试' : '请填写有效政策参数');
      return;
    }
    const requestKey = requestKeyRef.current || createAdminRequestKey();
    requestKeyRef.current = requestKey;
    setBusy(true);
    try {
      await adminApi.updatePopulationPolicy(payload, requestKey);
      requestKeyRef.current = '';
      onNotice(`${durationMode === 'permanent' ? '永久' : '限时'}人口政策已发布；当前订单与已开始的生产周期不重建，新参数从后续需求处理和下一完整生产周期开始生效。`);
      await onChanged();
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '应用人口政策失败');
    } finally {
      setBusy(false);
    }
  }

  async function resetPolicy() {
    if (busy) return;
    setBusy(true);
    try {
      await adminApi.resetPopulationPolicy();
      onNotice('人口政策已恢复人口模型默认参数。');
      await onChanged();
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '恢复默认政策失败');
    } finally {
      setBusy(false);
    }
  }

  async function topUp() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await adminApi.topUpPopulation(targetModel);
      onNotice(`本周期人口补充完成，共发行 ${formatCurrency(result.issuedTotal)}。`);
      await onChanged();
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '立即补充人口资金失败');
    } finally {
      setBusy(false);
    }
  }

  const publishLabel = durationMode === 'permanent'
    ? '发布永久政策'
    : payload
      ? `发布 ${payload.durationCycles} 周期限时政策`
      : '发布限时政策';

  return (
    <>
      <AdminPopulationHealth economy={economy} />
      <section className="admin-population-control" aria-label="人口政策调控">
        <header className="admin-population-control__header">
          <div>
            <h3>人口政策调控</h3>
            <p>{currentPolicyDescription}；下方始终显示服务器正在执行的完整参数与持续时间。</p>
            <small>本周期自动补充 <CurrencyAmount>{formatCurrency(automaticIssued)}</CurrencyAmount> · 管理员补充 <CurrencyAmount>{formatCurrency(adminIssued)}</CurrencyAmount> · 下周期 {formatDate(economy.policy.nextCycleAt)}</small>
          </div>
          <div className="admin-population-control__header-actions">
            <StatusTag tone={currentPolicyKind === 'default' ? 'success' : currentPolicyKind === 'temporary' && economy.policy.remainingCycles !== null && economy.policy.remainingCycles <= 2 ? 'warning' : 'neutral'}>
              {currentPolicyLabel}
            </StatusTag>
            <Button variant="secondary" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? '收起拟应用政策' : '展开拟应用政策'}</Button>
          </div>
        </header>

        <section className="admin-population-policy-current admin-population-policy-current--summary" aria-label="当前人口政策参数">
          <header><h4>当前政策</h4><small>服务器只读</small></header>
          <dl>
            <div><dt>最低消费保障率／目标钱包</dt><dd>{economy.policy.stabilizationShareBps / 100}%／{economy.policy.targetWalletCycles} 个周期</dd></div>
            <div><dt>单周期补充比例／生产工资</dt><dd>{economy.policy.refillCapBps / 100}%／{economy.policy.productionWageMultiplierBps / 100}%</dd></div>
            <div><dt>基础／技术／专业人口倍率</dt><dd>{economy.policy.modelMultipliersBps.basic / 100}%／{economy.policy.modelMultipliersBps.skilled / 100}%／{economy.policy.modelMultipliersBps.professional / 100}%</dd></div>
            <div><dt>总持续时间</dt><dd>{currentTotalDuration}</dd></div>
            <div><dt>已持续／剩余</dt><dd>{currentElapsed}／{economy.policy.remainingCycles === null ? '不自动到期' : durationLabel(economy.policy.remainingCycles)}</dd></div>
            <div><dt>生效时间／预计到期</dt><dd>{effectiveAt === null ? '模型默认' : formatDate(effectiveAt)}／{expiresAt === null ? '不自动到期' : formatDate(expiresAt)}</dd></div>
          </dl>
        </section>

        {expanded ? (
          <div className="admin-population-control__workspace">
            <section className="admin-population-policy-editor">
              <header><h4>拟应用政策参数</h4><p>参数不设业务上限，但必须是安全整数；计算结果超出系统可表示范围时服务器会拒绝。</p></header>
              <div className="admin-population-presets" aria-label="人口政策预设">
                <Button variant="secondary" onClick={() => usePreset('default')}>默认参数</Button>
                <Button variant="secondary" onClick={() => usePreset('mild')}>温和刺激</Button>
                <Button variant="secondary" onClick={() => usePreset('strong')}>强力刺激</Button>
                <Button variant="secondary" onClick={() => usePreset('tight')}>温和收紧</Button>
                <Button variant="secondary" onClick={() => usePreset('pause')}>暂停稳定发行</Button>
              </div>

              <div className="admin-population-policy-groups">
                <fieldset>
                  <legend>需求规模</legend>
                  <div className="admin-population-policy-grid">
                    <IntegerInput label="最低消费保障率（%）" value={draft.sharePercent} fallbackValue={12} min={0} onValueChange={(value) => setField('sharePercent', value)} />
                    <IntegerInput label="目标钱包周期" value={draft.targetCycles} fallbackValue={3} min={1} onValueChange={(value) => setField('targetCycles', value)} />
                    <IntegerInput label="单周期补充比例（%）" value={draft.refillPercent} fallbackValue={100} min={0} onValueChange={(value) => setField('refillPercent', value)} />
                  </div>
                  <div className="admin-population-presets" role="group" aria-label="政策生效方式">
                    <Button variant={durationMode === 'temporary' ? 'primary' : 'secondary'} aria-pressed={durationMode === 'temporary'} onClick={() => chooseDurationMode('temporary')}>限时生效</Button>
                    <Button variant={durationMode === 'permanent' ? 'primary' : 'secondary'} aria-pressed={durationMode === 'permanent'} onClick={() => chooseDurationMode('permanent')}>永久生效</Button>
                  </div>
                  {durationMode === 'temporary' ? (
                    <>
                      <IntegerInput label="政策有效周期" value={draft.durationCycles} fallbackValue={12} min={1} onValueChange={(value) => setField('durationCycles', value)} />
                      <p>限时政策到期后自动恢复模型默认政策。</p>
                    </>
                  ) : <p>此政策不会自动到期，将持续到下一次发布政策或手动恢复默认政策。</p>}
                </fieldset>
                <fieldset>
                  <legend>生产工资</legend>
                  <IntegerInput label="生产工资系数（%）" value={draft.productionWagePercent} fallbackValue={100} min={50} onValueChange={(value) => setField('productionWagePercent', value)} />
                </fieldset>
                <fieldset>
                  <legend>人口权重</legend>
                  <div className="admin-population-policy-grid">
                    <IntegerInput label="基础人口倍率（%）" value={draft.basicPercent} fallbackValue={100} min={50} onValueChange={(value) => setField('basicPercent', value)} />
                    <IntegerInput label="技术人口倍率（%）" value={draft.skilledPercent} fallbackValue={100} min={50} onValueChange={(value) => setField('skilledPercent', value)} />
                    <IntegerInput label="专业人口倍率（%）" value={draft.professionalPercent} fallbackValue={100} min={50} onValueChange={(value) => setField('professionalPercent', value)} />
                  </div>
                </fieldset>
              </div>
            </section>

            <aside className="admin-population-policy-impact">
              <section className="admin-population-policy-preview" aria-label="人口政策影响预估">
                <header><h4>调整前／调整后</h4><small>实时预览</small></header>
                {!payload ? <p>请填写有效政策参数。</p> : previewBudget === null ? <p>参数计算结果超出系统可表示范围，无法应用。</p> : (
                  <dl>
                    <div><dt>稳定预算</dt><dd><CurrencyAmount>{formatCurrency(economy.policyProjectedStabilizationTotal)}</CurrencyAmount>／<CurrencyAmount>{formatCurrency(previewBudget)}</CurrencyAmount></dd></div>
                    <div><dt>生产工资／生产成本</dt><dd>{payload.productionWageMultiplierBps / 100}%／成本不变</dd></div>
                    <div><dt>目标钱包</dt><dd>{payload.targetWalletCycles} 个周期</dd></div>
                    <div><dt>单周期补充比例</dt><dd>{payload.refillCapBps / 100}% 稳定预算</dd></div>
                    <div><dt>生效方式</dt><dd>{durationMode === 'permanent' ? '永久（不自动到期）' : durationLabel(payload.durationCycles)}</dd></div>
                  </dl>
                )}
                <Button disabled={!payload || previewBudget === null || busy} onClick={() => void applyPolicy()}>{busy ? '正在执行…' : publishLabel}</Button>
              </section>

              <section className="admin-population-policy-current" aria-label="当前政策操作">
                <header><h4>当前政策操作</h4><small>不修改拟发布草稿</small></header>
                <SelectInput label="立即补充目标" value={targetModel} onChange={(event) => setTargetModel(event.target.value as PopulationModelId | 'all')}>
                  <option value="all">全部人口</option>
                  <option value="basic">基础人口</option>
                  <option value="skilled">技术人口</option>
                  <option value="professional">专业人口</option>
                </SelectInput>
                <div className="admin-population-control__actions">
                  <Button variant="secondary" disabled={busy} onClick={() => void topUp()}>按当前政策立即补充</Button>
                  <Button variant="danger" disabled={busy || economy.policy.isDefault} onClick={() => void resetPolicy()}>恢复默认政策</Button>
                </div>
              </section>
            </aside>
          </div>
        ) : null}
      </section>
    </>
  );
}
