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

function policyDurationCycles(economy: PopulationEconomyAdminSummary) {
  const { effectiveCycleId, expiresAfterCycleId } = economy.policy;
  if (expiresAfterCycleId === null) return null;
  return Math.max(1, expiresAfterCycleId - effectiveCycleId);
}

function policyElapsedCycles(economy: PopulationEconomyAdminSummary) {
  const duration = policyDurationCycles(economy);
  if (duration === null) return null;
  return Math.min(duration, Math.max(0, economy.policy.currentCycleId - economy.policy.effectiveCycleId));
}

function draftFromEconomy(economy: PopulationEconomyAdminSummary): Draft {
  return {
    sharePercent: String(economy.policy.stabilizationShareBps / 100),
    productionWagePercent: String(economy.policy.productionWageMultiplierBps / 100),
    targetCycles: String(economy.policy.targetWalletCycles),
    refillPercent: String(economy.policy.refillCapBps / 100),
    basicPercent: String(economy.policy.modelMultipliersBps.basic / 100),
    skilledPercent: String(economy.policy.modelMultipliersBps.skilled / 100),
    professionalPercent: String(economy.policy.modelMultipliersBps.professional / 100),
    durationCycles: String(policyDurationCycles(economy) ?? 12),
  };
}

function percentToBps(value: number) {
  const result = value * 100;
  return Number.isSafeInteger(result) ? result : null;
}

function safeMulDiv(value: number, multiplier: number, divisor = 10_000) {
  const result = BigInt(value) * BigInt(multiplier) / BigInt(divisor);
  return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null;
}

function calculatePreviewBudget(economy: PopulationEconomyAdminSummary, payload: PopulationPolicyPayload) {
  const maximum = safeMulDiv(economy.policyBaseBudget, payload.stabilizationShareBps);
  if (maximum === null) return null;
  const basicBase = Math.floor(maximum * 0.6);
  const skilledBase = Math.floor(maximum * 0.3);
  const professionalBase = maximum - basicBase - skilledBase;
  const basic = safeMulDiv(basicBase, payload.modelMultipliersBps.basic);
  const skilled = safeMulDiv(skilledBase, payload.modelMultipliersBps.skilled);
  const professional = safeMulDiv(professionalBase, payload.modelMultipliersBps.professional);
  if (basic === null || skilled === null || professional === null) return null;
  const adjusted = BigInt(basic) + BigInt(skilled) + BigInt(professional);
  return Number(adjusted > BigInt(maximum) ? BigInt(maximum) : adjusted);
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
  const [targetModel, setTargetModel] = useState<PopulationModelId | 'all'>('all');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestKeyRef = useRef('');

  useEffect(() => {
    setDraft(draftFromEconomy(economy));
    setPreviewVisible(false);
  }, [economy.policy.updatedAt, economy.policy.currentCycleId, economy.policy.expiresAfterCycleId]);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    requestKeyRef.current = '';
    setDraft((current) => ({ ...current, [key]: value }));
    setPreviewVisible(false);
  }

  const payload = useMemo<PopulationPolicyPayload | null>(() => {
    const share = parseIntegerDraft(draft.sharePercent, { min: 0 });
    const productionWage = parseIntegerDraft(draft.productionWagePercent, { min: 50 });
    const target = parseIntegerDraft(draft.targetCycles, { min: 1 });
    const refill = parseIntegerDraft(draft.refillPercent, { min: 0 });
    const basic = parseIntegerDraft(draft.basicPercent, { min: 50 });
    const skilled = parseIntegerDraft(draft.skilledPercent, { min: 50 });
    const professional = parseIntegerDraft(draft.professionalPercent, { min: 50 });
    const duration = parseIntegerDraft(draft.durationCycles, { min: 1 });
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
      durationCycles: duration!,
    };
  }, [draft]);

  const previewBudget = payload ? calculatePreviewBudget(economy, payload) : null;
  const automaticIssued = Object.values(economy.policy.currentCycleIssued.automaticByModel).reduce((sum, value) => sum + value, 0);
  const adminIssued = Object.values(economy.policy.currentCycleIssued.adminByModel).reduce((sum, value) => sum + value, 0);
  const currentDuration = policyDurationCycles(economy);
  const elapsedCycles = policyElapsedCycles(economy);
  const effectiveAt = economy.policy.isDefault ? null : economy.policy.effectiveCycleId * 5 * 60 * 1000;
  const expiresAt = economy.policy.expiresAfterCycleId === null ? null : economy.policy.expiresAfterCycleId * 5 * 60 * 1000;

  function usePreset(name: 'default' | 'mild' | 'strong' | 'tight' | 'pause') {
    const presets: Record<typeof name, Draft> = {
      default: { sharePercent: '12', productionWagePercent: '100', targetCycles: '3', refillPercent: '100', basicPercent: '100', skilledPercent: '100', professionalPercent: '100', durationCycles: '12' },
      mild: { sharePercent: '15', productionWagePercent: '110', targetCycles: '4', refillPercent: '100', basicPercent: '110', skilledPercent: '100', professionalPercent: '90', durationCycles: '12' },
      strong: { sharePercent: '25', productionWagePercent: '180', targetCycles: '8', refillPercent: '250', basicPercent: '160', skilledPercent: '120', professionalPercent: '80', durationCycles: '24' },
      tight: { sharePercent: '6', productionWagePercent: '90', targetCycles: '2', refillPercent: '50', basicPercent: '100', skilledPercent: '100', professionalPercent: '100', durationCycles: '12' },
      pause: { sharePercent: '0', productionWagePercent: '100', targetCycles: '3', refillPercent: '0', basicPercent: '100', skilledPercent: '100', professionalPercent: '100', durationCycles: '6' },
    };
    requestKeyRef.current = '';
    setDraft(presets[name]);
    setPreviewVisible(false);
  }

  async function applyPolicy() {
    if (!payload || !previewVisible || previewBudget === null || busy) {
      onNotice(previewBudget === null && payload ? '政策计算结果超出系统可预览范围，请降低参数后重试' : '请填写有效政策参数并先完成预览');
      return;
    }
    const requestKey = requestKeyRef.current || createAdminRequestKey();
    requestKeyRef.current = requestKey;
    setBusy(true);
    try {
      await adminApi.updatePopulationPolicy(payload, requestKey);
      requestKeyRef.current = '';
      onNotice('人口政策已应用；当前订单与已开始的生产周期不重建，新参数从后续需求处理和下一完整生产周期开始生效。');
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
      onNotice('人口政策已恢复模型 8 默认参数。');
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

  return (
    <>
      <AdminPopulationHealth economy={economy} />
      <section className="admin-population-control" aria-label="人口政策调控">
        <header className="admin-population-control__header">
          <div>
            <h3>人口政策调控</h3>
            <p>{economy.policy.isDefault ? '当前使用模型默认政策' : '当前使用临时政策'}；下方始终显示服务器正在执行的完整参数与持续时间。</p>
            <small>本周期自动补充 <CurrencyAmount>{formatCurrency(automaticIssued)}</CurrencyAmount> · 管理员补充 <CurrencyAmount>{formatCurrency(adminIssued)}</CurrencyAmount> · 下周期 {formatDate(economy.policy.nextCycleAt)}</small>
          </div>
          <div className="admin-population-control__header-actions">
            <StatusTag tone={economy.policy.isDefault ? 'success' : economy.policy.remainingCycles !== null && economy.policy.remainingCycles <= 2 ? 'warning' : 'neutral'}>
              {economy.policy.isDefault ? '默认' : '临时'}
            </StatusTag>
            <Button variant="secondary" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? '收起拟应用政策' : '展开拟应用政策'}</Button>
          </div>
        </header>

        <section className="admin-population-policy-current admin-population-policy-current--summary" aria-label="当前人口政策参数">
          <header><h4>当前政策</h4><small>服务器只读</small></header>
          <dl>
            <div><dt>稳定需求比例／目标钱包</dt><dd>{economy.policy.stabilizationShareBps / 100}%／{economy.policy.targetWalletCycles} 个周期</dd></div>
            <div><dt>单周期补充比例／生产工资</dt><dd>{economy.policy.refillCapBps / 100}%／{economy.policy.productionWageMultiplierBps / 100}%</dd></div>
            <div><dt>基础／技术／专业人口倍率</dt><dd>{economy.policy.modelMultipliersBps.basic / 100}%／{economy.policy.modelMultipliersBps.skilled / 100}%／{economy.policy.modelMultipliersBps.professional / 100}%</dd></div>
            <div><dt>总持续时间</dt><dd>{durationLabel(currentDuration)}</dd></div>
            <div><dt>已持续／剩余</dt><dd>{elapsedCycles === null ? '长期' : `${elapsedCycles} 个周期`}／{economy.policy.remainingCycles === null ? '不自动到期' : durationLabel(economy.policy.remainingCycles)}</dd></div>
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
                    <IntegerInput label="稳定需求比例（%）" value={draft.sharePercent} fallbackValue={12} min={0} onValueChange={(value) => setField('sharePercent', value)} />
                    <IntegerInput label="目标钱包周期" value={draft.targetCycles} fallbackValue={3} min={1} onValueChange={(value) => setField('targetCycles', value)} />
                    <IntegerInput label="单周期补充比例（%）" value={draft.refillPercent} fallbackValue={100} min={0} onValueChange={(value) => setField('refillPercent', value)} />
                    <IntegerInput label="政策有效周期" value={draft.durationCycles} fallbackValue={12} min={1} onValueChange={(value) => setField('durationCycles', value)} />
                  </div>
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
                <header><h4>调整前／调整后</h4><Button variant="secondary" disabled={!payload} onClick={() => setPreviewVisible(true)}>预览政策</Button></header>
                {previewVisible && payload ? (
                  previewBudget === null ? <p>参数计算结果超出系统可表示范围，无法应用。</p> : (
                    <dl>
                      <div><dt>稳定预算</dt><dd><CurrencyAmount>{formatCurrency(economy.policyProjectedStabilizationTotal)}</CurrencyAmount>／<CurrencyAmount>{formatCurrency(previewBudget)}</CurrencyAmount></dd></div>
                      <div><dt>生产工资／生产成本</dt><dd>{payload.productionWageMultiplierBps / 100}%／成本不变</dd></div>
                      <div><dt>目标钱包</dt><dd>{payload.targetWalletCycles} 个周期</dd></div>
                      <div><dt>单周期补充比例</dt><dd>{payload.refillCapBps / 100}% 稳定预算</dd></div>
                      <div><dt>持续时间</dt><dd>{durationLabel(payload.durationCycles)}</dd></div>
                    </dl>
                  )
                ) : <p>调整参数后点击“预览政策”，确认影响范围再执行。</p>}
              </section>

              <SelectInput label="立即补充目标" value={targetModel} onChange={(event) => setTargetModel(event.target.value as PopulationModelId | 'all')}>
                <option value="all">全部人口</option>
                <option value="basic">基础人口</option>
                <option value="skilled">技术人口</option>
                <option value="professional">专业人口</option>
              </SelectInput>

              <div className="admin-population-control__actions">
                <Button disabled={!previewVisible || !payload || previewBudget === null || busy} onClick={() => void applyPolicy()}>{busy ? '正在执行…' : '确认应用'}</Button>
                <Button variant="secondary" disabled={busy} onClick={() => void topUp()}>按当前政策立即补充</Button>
                <Button variant="danger" disabled={busy || economy.policy.isDefault} onClick={() => void resetPolicy()}>恢复默认政策</Button>
              </div>
            </aside>
          </div>
        ) : null}
      </section>
    </>
  );
}
