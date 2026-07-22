import { useEffect, useMemo, useRef, useState } from 'react';
import {
  adminApi,
  createAdminRequestKey,
  type PopulationEconomyAdminSummary,
  type PopulationModelId,
  type PopulationPolicyAuditRecord,
  type PopulationPolicyPayload,
} from '../api/admin';
import { CurrencyAmount } from './ui/CurrencyAmount';
import { IntegerInput, SelectInput, TextArea } from './ui/FormControls';
import { Button, EmptyState, MetricCard, StatusTag } from './ui/layout';
import { VirtualList } from './ui/VirtualList';
import { formatCurrency, formatDate } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';

type Draft = {
  sharePercent: string;
  targetCycles: string;
  refillPercent: string;
  basicPercent: string;
  skilledPercent: string;
  professionalPercent: string;
  durationCycles: string;
};

function draftFromEconomy(economy: PopulationEconomyAdminSummary): Draft {
  return {
    sharePercent: String(economy.policy.stabilizationShareBps / 100),
    targetCycles: String(economy.policy.targetWalletCycles),
    refillPercent: String(economy.policy.refillCapBps / 100),
    basicPercent: String(economy.policy.modelMultipliersBps.basic / 100),
    skilledPercent: String(economy.policy.modelMultipliersBps.skilled / 100),
    professionalPercent: String(economy.policy.modelMultipliersBps.professional / 100),
    durationCycles: '12',
  };
}

function policyActionLabel(action: PopulationPolicyAuditRecord['actionType']) {
  if (action === 'update_policy') return '应用政策';
  if (action === 'reset_policy') return '恢复默认';
  return '立即补充';
}

function calculatePreviewBudget(economy: PopulationEconomyAdminSummary, payload: PopulationPolicyPayload) {
  const maximum = Math.floor(economy.policyBaseBudget * payload.stabilizationShareBps / 10_000);
  const bases = {
    basic: Math.floor(maximum * 0.6),
    skilled: Math.floor(maximum * 0.3),
    professional: maximum - Math.floor(maximum * 0.6) - Math.floor(maximum * 0.3),
  };
  const adjusted = {
    basic: Math.floor(bases.basic * payload.modelMultipliersBps.basic / 10_000),
    skilled: Math.floor(bases.skilled * payload.modelMultipliersBps.skilled / 10_000),
    professional: Math.floor(bases.professional * payload.modelMultipliersBps.professional / 10_000),
  };
  return Math.min(maximum, adjusted.basic + adjusted.skilled + adjusted.professional);
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
  const [note, setNote] = useState('');
  const [targetModel, setTargetModel] = useState<PopulationModelId | 'all'>('all');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<PopulationPolicyAuditRecord[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const requestKeyRef = useRef('');

  useEffect(() => {
    setDraft(draftFromEconomy(economy));
    setPreviewVisible(false);
  }, [economy.policy.updatedAt, economy.policy.currentCycleId]);

  async function loadAudit(cursor?: string | null) {
    if (loadingAudit) return;
    setLoadingAudit(true);
    try {
      const page = await adminApi.populationPolicyAudit(cursor);
      setAudit((current) => cursor ? [...current, ...page.items] : page.items);
      setAuditTotal(page.total);
      setAuditCursor(page.nextCursor);
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '读取人口调控记录失败');
    } finally {
      setLoadingAudit(false);
    }
  }

  useEffect(() => { void loadAudit(); }, []);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    requestKeyRef.current = '';
    setDraft((current) => ({ ...current, [key]: value }));
    setPreviewVisible(false);
  }

  const payload = useMemo<PopulationPolicyPayload | null>(() => {
    const share = parseIntegerDraft(draft.sharePercent, { min: 0, max: 20 });
    const target = parseIntegerDraft(draft.targetCycles, { min: 1, max: 5 });
    const refill = parseIntegerDraft(draft.refillPercent, { min: 0, max: 150 });
    const basic = parseIntegerDraft(draft.basicPercent, { min: 50, max: 150 });
    const skilled = parseIntegerDraft(draft.skilledPercent, { min: 50, max: 150 });
    const professional = parseIntegerDraft(draft.professionalPercent, { min: 50, max: 150 });
    const duration = parseIntegerDraft(draft.durationCycles, { min: 1, max: 288 });
    if ([share, target, refill, basic, skilled, professional, duration].some((value) => value === null)) return null;
    return {
      stabilizationShareBps: share! * 100,
      targetWalletCycles: target!,
      refillCapBps: refill! * 100,
      modelMultipliersBps: {
        basic: basic! * 100,
        skilled: skilled! * 100,
        professional: professional! * 100,
      },
      durationCycles: duration!,
      note: note.trim(),
    };
  }, [draft, note]);

  const previewBudget = payload ? calculatePreviewBudget(economy, payload) : 0;
  const noteValid = note.trim().length >= economy.policyLimits.noteLength.min
    && note.trim().length <= economy.policyLimits.noteLength.max;

  function usePreset(name: 'default' | 'mild' | 'strong' | 'tight' | 'pause') {
    const presets: Record<typeof name, Draft> = {
      default: { sharePercent: '12', targetCycles: '3', refillPercent: '100', basicPercent: '100', skilledPercent: '100', professionalPercent: '100', durationCycles: '12' },
      mild: { sharePercent: '15', targetCycles: '4', refillPercent: '100', basicPercent: '110', skilledPercent: '100', professionalPercent: '90', durationCycles: '12' },
      strong: { sharePercent: '18', targetCycles: '5', refillPercent: '150', basicPercent: '120', skilledPercent: '105', professionalPercent: '90', durationCycles: '6' },
      tight: { sharePercent: '6', targetCycles: '2', refillPercent: '50', basicPercent: '100', skilledPercent: '100', professionalPercent: '100', durationCycles: '12' },
      pause: { sharePercent: '0', targetCycles: '3', refillPercent: '0', basicPercent: '100', skilledPercent: '100', professionalPercent: '100', durationCycles: '6' },
    };
    requestKeyRef.current = '';
    setDraft(presets[name]);
    setPreviewVisible(false);
  }

  async function applyPolicy() {
    if (!payload || !noteValid || busy) {
      onNotice('请填写有效政策参数和 8～200 字管理备注');
      return;
    }
    const requestKey = requestKeyRef.current || createAdminRequestKey();
    requestKeyRef.current = requestKey;
    setBusy(true);
    try {
      await adminApi.updatePopulationPolicy(payload, requestKey);
      requestKeyRef.current = '';
      onNotice('人口政策已应用；当前订单不重建，新参数从后续需求处理开始生效。');
      setNote('');
      await Promise.all([onChanged(), loadAudit()]);
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '应用人口政策失败');
    } finally {
      setBusy(false);
    }
  }

  async function resetPolicy() {
    if (!noteValid || busy) {
      onNotice('恢复默认政策前必须填写 8～200 字管理备注');
      return;
    }
    setBusy(true);
    try {
      await adminApi.resetPopulationPolicy(note.trim());
      onNotice('人口政策已恢复模型 8 默认参数。');
      setNote('');
      await Promise.all([onChanged(), loadAudit()]);
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '恢复默认政策失败');
    } finally {
      setBusy(false);
    }
  }

  async function topUp() {
    if (!noteValid || busy) {
      onNotice('执行立即补充前必须填写 8～200 字管理备注');
      return;
    }
    setBusy(true);
    try {
      const result = await adminApi.topUpPopulation(targetModel, note.trim());
      onNotice(`本周期人口补充完成，共发行 ${formatCurrency(result.issuedTotal)}。`);
      setNote('');
      await Promise.all([onChanged(), loadAudit()]);
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '立即补充人口资金失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-population-control" aria-label="人口政策调控">
      <header className="admin-population-control__header">
        <div>
          <h3>人口政策调控</h3>
          <p>只调整未来稳定需求，不允许任意修改余额、收入状态或既有订单。</p>
        </div>
        <StatusTag tone={economy.policy.isDefault ? 'success' : economy.policy.remainingCycles !== null && economy.policy.remainingCycles <= 2 ? 'warning' : 'neutral'}>
          {economy.policy.isDefault ? '默认政策' : `临时政策 · 剩余 ${economy.policy.remainingCycles} 周期`}
        </StatusTag>
      </header>

      <section className="admin-population-policy-metrics">
        <MetricCard label="当前稳定预算" value={<CurrencyAmount>{formatCurrency(economy.policyProjectedStabilizationTotal)}</CurrencyAmount>} />
        <MetricCard label="当前周期自动补充" value={<CurrencyAmount>{formatCurrency(Object.values(economy.policy.currentCycleIssued.automaticByModel).reduce((sum, value) => sum + value, 0))}</CurrencyAmount>} />
        <MetricCard label="当前周期管理员补充" value={<CurrencyAmount>{formatCurrency(Object.values(economy.policy.currentCycleIssued.adminByModel).reduce((sum, value) => sum + value, 0))}</CurrencyAmount>} />
        <MetricCard label="下个需求周期" value={formatDate(economy.policy.nextCycleAt)} />
      </section>

      <div className="admin-population-presets" aria-label="人口政策预设">
        <Button variant="secondary" onClick={() => usePreset('default')}>默认参数</Button>
        <Button variant="secondary" onClick={() => usePreset('mild')}>温和刺激</Button>
        <Button variant="secondary" onClick={() => usePreset('strong')}>强力刺激</Button>
        <Button variant="secondary" onClick={() => usePreset('tight')}>温和收紧</Button>
        <Button variant="secondary" onClick={() => usePreset('pause')}>暂停稳定发行</Button>
      </div>

      <div className="admin-population-policy-grid">
        <IntegerInput label="稳定需求比例（%）" value={draft.sharePercent} fallbackValue={12} min={0} max={20} onValueChange={(value) => setField('sharePercent', value)} />
        <IntegerInput label="目标钱包周期" value={draft.targetCycles} fallbackValue={3} min={1} max={5} onValueChange={(value) => setField('targetCycles', value)} />
        <IntegerInput label="单周期补充上限（%）" value={draft.refillPercent} fallbackValue={100} min={0} max={150} onValueChange={(value) => setField('refillPercent', value)} />
        <IntegerInput label="政策有效周期" value={draft.durationCycles} fallbackValue={12} min={1} max={288} onValueChange={(value) => setField('durationCycles', value)} />
        <IntegerInput label="基础人口倍率（%）" value={draft.basicPercent} fallbackValue={100} min={50} max={150} onValueChange={(value) => setField('basicPercent', value)} />
        <IntegerInput label="技术人口倍率（%）" value={draft.skilledPercent} fallbackValue={100} min={50} max={150} onValueChange={(value) => setField('skilledPercent', value)} />
        <IntegerInput label="专业人口倍率（%）" value={draft.professionalPercent} fallbackValue={100} min={50} max={150} onValueChange={(value) => setField('professionalPercent', value)} />
        <SelectInput label="立即补充目标" value={targetModel} onChange={(event) => setTargetModel(event.target.value as PopulationModelId | 'all')}>
          <option value="all">全部人口</option>
          <option value="basic">基础人口</option>
          <option value="skilled">技术人口</option>
          <option value="professional">专业人口</option>
        </SelectInput>
      </div>

      <TextArea
        label="管理备注"
        value={note}
        minLength={economy.policyLimits.noteLength.min}
        maxLength={economy.policyLimits.noteLength.max}
        required
        onChange={(event) => { requestKeyRef.current = ''; setNote(event.target.value); }}
        description="8～200 字；将写入不可删除的调控审计记录。"
      />

      <div className="admin-population-control__actions">
        <Button variant="secondary" disabled={!payload} onClick={() => setPreviewVisible(true)}>预览政策</Button>
        <Button disabled={!previewVisible || !payload || !noteValid || busy} onClick={() => void applyPolicy()}>
          {busy ? '正在执行…' : '确认应用'}
        </Button>
        <Button variant="secondary" disabled={!noteValid || busy} onClick={() => void topUp()}>按当前政策立即补充</Button>
        <Button variant="danger" disabled={!noteValid || busy || economy.policy.isDefault} onClick={() => void resetPolicy()}>恢复默认政策</Button>
      </div>

      {previewVisible && payload ? (
        <section className="admin-population-policy-preview" aria-label="人口政策影响预估">
          <h4>影响预估</h4>
          <dl>
            <div><dt>当前／调整后稳定预算</dt><dd><CurrencyAmount>{formatCurrency(economy.policyProjectedStabilizationTotal)}</CurrencyAmount>／<CurrencyAmount>{formatCurrency(previewBudget)}</CurrencyAmount></dd></div>
            <div><dt>目标钱包</dt><dd>{payload.targetWalletCycles} 个周期</dd></div>
            <div><dt>单周期最大补充</dt><dd>{payload.refillCapBps / 100}% 稳定预算</dd></div>
            <div><dt>持续时间</dt><dd>{payload.durationCycles} 个周期（约 {Math.round(payload.durationCycles * 5 / 60 * 10) / 10} 小时）</dd></div>
          </dl>
        </section>
      ) : null}

      <section className="admin-population-audit">
        <header><h3>人口调控记录</h3><span>已加载 {audit.length}／{auditTotal}</span></header>
        <VirtualList
          items={audit}
          getKey={(record) => record.id}
          estimateSize={92}
          viewportHeight={360}
          minViewportHeight={120}
          ariaLabel="人口调控审计记录"
          empty={<EmptyState>暂无人口调控记录。</EmptyState>}
          renderItem={(record) => (
            <article className="admin-population-audit-record">
              <header><strong>{policyActionLabel(record.actionType)}</strong><span>{formatDate(record.createdAt)}</span></header>
              <p>{record.note}</p>
              <small>管理员 #{record.adminUserId} · 目标 {record.targetModel === 'all' ? '全部人口' : record.targetModel} · 发行 <CurrencyAmount>{formatCurrency(record.issuedCredits)}</CurrencyAmount> · 世界修订 {record.revisionBefore}→{record.revisionAfter}</small>
            </article>
          )}
        />
        {auditCursor ? <Button variant="secondary" disabled={loadingAudit} onClick={() => void loadAudit(auditCursor)}>{loadingAudit ? '正在加载…' : '加载更多记录'}</Button> : null}
      </section>
    </section>
  );
}
