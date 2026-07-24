import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  adminApi,
  createAdminRequestKey,
  type GiftRedemptionRecord,
} from '../api/admin';
import { GameApiError } from '../api/game';
import { CurrencyAmount } from './ui/CurrencyAmount';
import { IntegerInput, TextArea, TextInput } from './ui/FormControls';
import {
  Button,
  EmptyState,
  Panel,
  StatusTag,
  WidgetHeading,
} from './ui/layout';
import { VirtualList } from './ui/VirtualList';
import type { GiftCodeAdminRecord } from '../types';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';

function giftCodeKey(gift: GiftCodeAdminRecord) { return gift.id; }
function redemptionKey(record: GiftRedemptionRecord) { return `${record.user_id}-${record.redeemed_at}`; }

function downloadGiftCodes(codes: string[]) {
  if (codes.length === 0) return;
  const blob = new Blob([`${codes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `economy-gift-codes-${timestamp}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function AdminGiftCodesSection({
  active,
  refreshToken,
  onNotice,
  onError,
}: {
  active: boolean;
  refreshToken: number;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [giftCodes, setGiftCodes] = useState<GiftCodeAdminRecord[]>([]);
  const [giftCodeTotal, setGiftCodeTotal] = useState(0);
  const [giftCodeCursor, setGiftCodeCursor] = useState<string | null>(null);
  const [loadingMoreGiftCodes, setLoadingMoreGiftCodes] = useState(false);
  const [code, setCode] = useState('');
  const [giftCount, setGiftCount] = useState(1);
  const [giftCountInput, setGiftCountInput] = useState('1');
  const [rewardCredits, setRewardCredits] = useState(100);
  const [rewardCreditsInput, setRewardCreditsInput] = useState('100');
  const [maxRedemptions, setMaxRedemptions] = useState(100);
  const [maxRedemptionsInput, setMaxRedemptionsInput] = useState('100');
  const [expiresAt, setExpiresAt] = useState('');
  const [note, setNote] = useState('');
  const [createdCodes, setCreatedCodes] = useState<string[]>([]);
  const [creatingGift, setCreatingGift] = useState(false);
  const giftRequestKeyRef = useRef('');
  const [redemptions, setRedemptions] = useState<GiftRedemptionRecord[]>([]);
  const [redemptionTotal, setRedemptionTotal] = useState(0);
  const [redemptionCursor, setRedemptionCursor] = useState<string | null>(null);
  const [loadingMoreRedemptions, setLoadingMoreRedemptions] = useState(false);
  const [selectedGiftId, setSelectedGiftId] = useState<number | null>(null);

  const parsedGiftCount = parseIntegerDraft(giftCountInput, { min: 1, max: 50_000 });
  const parsedRewardCredits = parseIntegerDraft(rewardCreditsInput, { min: 1, max: 1_000_000 });
  const parsedMaxRedemptions = parseIntegerDraft(maxRedemptionsInput, { min: 1, max: 1_000_000 });
  const giftFormValid = parsedGiftCount !== null
    && parsedRewardCredits !== null
    && parsedMaxRedemptions !== null;

  const loadGiftCodes = useCallback(async () => {
    const nextCodesPage = await adminApi.giftCodes();
    setGiftCodes(nextCodesPage.items);
    setGiftCodeTotal(nextCodesPage.total);
    setGiftCodeCursor(nextCodesPage.nextCursor);
  }, []);

  useEffect(() => {
    if (!active) return;
    void loadGiftCodes().then(() => onError('')).catch((reason) => {
      onError(reason instanceof Error ? reason.message : '无法加载礼品码');
    });
  }, [active, loadGiftCodes, onError, refreshToken]);

  function resetGiftRequestKey() {
    giftRequestKeyRef.current = '';
  }

  function updateGiftCount(value: string) {
    resetGiftRequestKey();
    setGiftCountInput(value);
    const parsed = parseIntegerDraft(value, { min: 1, max: 50_000 });
    if (parsed !== null) setGiftCount(parsed);
  }

  function updateRewardCredits(value: string) {
    resetGiftRequestKey();
    setRewardCreditsInput(value);
    const parsed = parseIntegerDraft(value, { min: 1, max: 1_000_000 });
    if (parsed !== null) setRewardCredits(parsed);
  }

  function updateMaxRedemptions(value: string) {
    resetGiftRequestKey();
    setMaxRedemptionsInput(value);
    const parsed = parseIntegerDraft(value, { min: 1, max: 1_000_000 });
    if (parsed !== null) setMaxRedemptions(parsed);
  }

  async function createGift() {
    if (creatingGift) return;
    if (parsedGiftCount === null) {
      onNotice('生成数量必须为 1～50000');
      return;
    }
    if (parsedRewardCredits === null || parsedMaxRedemptions === null) {
      onNotice('奖励货币和每码最大兑换次数必须为 1～1000000 的整数');
      return;
    }

    const requestKey = giftRequestKeyRef.current || createAdminRequestKey();
    giftRequestKeyRef.current = requestKey;
    setCreatingGift(true);
    try {
      const payload = {
        rewardCredits: parsedRewardCredits,
        maxRedemptions: parsedMaxRedemptions,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
        note,
      };
      const nextCodes = parsedGiftCount === 1
        ? [(await adminApi.createGiftCode({ ...payload, code: code.trim() || undefined }, requestKey)).code]
        : (await adminApi.createGiftCodeBatch({ ...payload, count: parsedGiftCount }, requestKey)).codes;
      giftRequestKeyRef.current = '';
      setCreatedCodes(nextCodes);
      setCode('');
      onNotice(`已创建 ${nextCodes.length} 个礼品码。明文仅保留在本次页面中，请立即下载 TXT。`);
      await loadGiftCodes();
    } catch (reason) {
      if (reason instanceof GameApiError) giftRequestKeyRef.current = '';
      onNotice(reason instanceof GameApiError
        ? reason.message
        : '请求连接中断；保持参数不变再次点击，会使用同一幂等键安全重试本批次。');
    } finally {
      setCreatingGift(false);
    }
  }

  async function disableGift(id: number) {
    try {
      await adminApi.disableGiftCode(id);
      onNotice(`礼品码 #${id} 已停用`);
      await loadGiftCodes();
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '停用礼品码失败');
    }
  }

  async function loadMoreGiftCodes() {
    if (!giftCodeCursor || loadingMoreGiftCodes) return;
    setLoadingMoreGiftCodes(true);
    try {
      const page = await adminApi.giftCodes(giftCodeCursor);
      setGiftCodes((current) => [...current, ...page.items]);
      setGiftCodeTotal(page.total);
      setGiftCodeCursor(page.nextCursor);
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '读取更多礼品码失败');
    } finally {
      setLoadingMoreGiftCodes(false);
    }
  }

  async function showRedemptions(id: number) {
    try {
      const page = await adminApi.redemptions(id);
      setSelectedGiftId(id);
      setRedemptions(page.items);
      setRedemptionTotal(page.total);
      setRedemptionCursor(page.nextCursor);
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '读取兑换记录失败');
    }
  }

  async function loadMoreRedemptions() {
    if (selectedGiftId === null || !redemptionCursor || loadingMoreRedemptions) return;
    setLoadingMoreRedemptions(true);
    try {
      const page = await adminApi.redemptions(selectedGiftId, redemptionCursor);
      setRedemptions((current) => [...current, ...page.items]);
      setRedemptionTotal(page.total);
      setRedemptionCursor(page.nextCursor);
    } catch (reason) {
      onNotice(reason instanceof Error ? reason.message : '读取更多兑换记录失败');
    } finally {
      setLoadingMoreRedemptions(false);
    }
  }

  return (
    <div className="admin-section-stack admin-gift-console">
      <Panel className="admin-panel admin-gift-create">
        <WidgetHeading title="创建礼品码" />
        <div className="admin-form-grid">
<IntegerInput
  label="生成数量（最多 50000）"
  value={giftCountInput}
  fallbackValue={giftCount}
  min={1}
  max={50_000}
  error={parsedGiftCount === null ? '请输入 1～50000 的整数。' : undefined}
  onValueChange={updateGiftCount}
/>
<TextInput
  label="指定兑换码（仅生成 1 个时可用）"
  value={code}
  maxLength={64}
  disabled={parsedGiftCount !== 1}
  onChange={(event: ChangeEvent<HTMLInputElement>) => {
    resetGiftRequestKey();
    setCode(event.target.value.toUpperCase());
  }}
  placeholder="RIVER-XXXX-XXXX"
/>
<IntegerInput
  label="奖励货币"
  value={rewardCreditsInput}
  fallbackValue={rewardCredits}
  min={1}
  max={1_000_000}
  error={parsedRewardCredits === null ? '请输入 1～1000000 的整数。' : undefined}
  onValueChange={updateRewardCredits}
/>
<IntegerInput
  label="每码最大兑换次数"
  value={maxRedemptionsInput}
  fallbackValue={maxRedemptions}
  min={1}
  max={1_000_000}
  error={parsedMaxRedemptions === null ? '请输入 1～1000000 的整数。' : undefined}
  onValueChange={updateMaxRedemptions}
/>
<TextInput
  label="过期时间（可选）"
  type="datetime-local"
  value={expiresAt}
  onChange={(event) => {
    resetGiftRequestKey();
    setExpiresAt(event.target.value);
  }}
/>
<TextArea
  label="管理备注"
  fieldClassName="admin-form-wide"
  value={note}
  maxLength={240}
  onChange={(event) => {
    resetGiftRequestKey();
    setNote(event.target.value);
  }}
/>
        </div>
        <Button disabled={creatingGift || !giftFormValid} onClick={() => void createGift()}>{creatingGift ? '正在生成…' : parsedGiftCount && parsedGiftCount > 1 ? `批量生成 ${parsedGiftCount} 个` : '创建礼品码'}</Button>
        {createdCodes.length > 0 ? <div className="created-gift-code" aria-live="polite"><span>本次生成 {createdCodes.length} 个礼品码</span>{createdCodes.length === 1 ? <strong>{createdCodes[0]}</strong> : <small>为避免页面渲染大量明文，批量结果不逐条显示。</small>}<Button variant="secondary" onClick={() => downloadGiftCodes(createdCodes)}>下载 TXT</Button></div> : null}
      </Panel>

      <Panel className="admin-panel admin-gift-list">
        <WidgetHeading title="礼品码记录" action={<span>已加载 {giftCodes.length}/{giftCodeTotal} 条</span>} />
        {giftCodes.length === 0 ? <EmptyState>暂无礼品码。</EmptyState> : (
<div className="virtual-record-table admin-gifts-virtual-table" role="table" aria-label="礼品码记录">
  <div className="virtual-record-header" role="row"><span role="columnheader">ID</span><span role="columnheader">奖励</span><span role="columnheader">兑换</span><span role="columnheader">状态</span><span role="columnheader">有效期</span><span role="columnheader">备注</span><span role="columnheader">操作</span></div>
  <VirtualList items={giftCodes} getKey={giftCodeKey} estimateSize={58} viewportHeight={520} minViewportHeight={96} overscan={6} gap={0} className="virtual-record-viewport" role="rowgroup" itemRole="presentation" ariaLabel="礼品码记录行" renderItem={(gift) => (
    <div className="virtual-record-row" role="row"><span role="cell">#{gift.id}</span><span role="cell"><CurrencyAmount>{formatCurrency(gift.reward_credits)}</CurrencyAmount></span><span role="cell">{gift.redeemed_count}/{gift.max_redemptions}</span><span role="cell"><StatusTag tone={gift.enabled ? 'success' : 'neutral'}>{gift.enabled ? '启用' : '停用'}</StatusTag></span><span role="cell">{gift.expires_at ? formatDate(gift.expires_at) : '长期'}</span><span role="cell">{gift.note || '—'}</span><span role="cell"><span className="admin-row-actions"><Button variant="compact" onClick={() => void showRedemptions(gift.id)}>兑换记录</Button>{gift.enabled ? <Button variant="danger" onClick={() => void disableGift(gift.id)}>停用</Button> : null}</span></span></div>
  )} />
</div>
        )}
        {giftCodeCursor ? <Button variant="secondary" disabled={loadingMoreGiftCodes} onClick={() => void loadMoreGiftCodes()}>{loadingMoreGiftCodes ? '正在加载…' : '加载更多礼品码'}</Button> : null}
      </Panel>

      {selectedGiftId !== null ? (
        <Panel className="admin-panel admin-redemptions">
<WidgetHeading title={`礼品码 #${selectedGiftId} 兑换记录`} action={<span>已加载 {redemptions.length}/{redemptionTotal} 条</span>} />
{redemptions.length === 0 ? <EmptyState>暂无兑换记录。</EmptyState> : (
  <div className="virtual-record-table admin-redemptions-virtual-table" role="table" aria-label={`礼品码 ${selectedGiftId} 兑换记录`}>
    <div className="virtual-record-header" role="row"><span role="columnheader">玩家 ID</span><span role="columnheader">奖励</span><span role="columnheader">兑换时间</span></div>
    <VirtualList key={selectedGiftId} items={redemptions} getKey={redemptionKey} estimateSize={52} viewportHeight={420} minViewportHeight={80} overscan={6} gap={0} className="virtual-record-viewport" role="rowgroup" itemRole="presentation" ariaLabel="礼品码兑换记录行" renderItem={(record) => (
      <div className="virtual-record-row" role="row"><span role="cell">{record.user_id}</span><span role="cell"><CurrencyAmount>{formatCurrency(record.reward_credits)}</CurrencyAmount></span><span role="cell">{formatTime(record.redeemed_at)}</span></div>
    )} />
  </div>
)}
{redemptionCursor ? <Button variant="secondary" disabled={loadingMoreRedemptions} onClick={() => void loadMoreRedemptions()}>{loadingMoreRedemptions ? '正在加载…' : '加载更多兑换记录'}</Button> : null}
        </Panel>
      ) : null}
    </div>
  );
}
