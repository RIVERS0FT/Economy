import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  adminApi,
  createAdminRequestKey,
  type ExtendedAdminSummary,
  type GiftRedemptionRecord,
} from '../api/admin';
import { GameApiError } from '../api/game';
import type {
  CollectibleAdminRecord,
  CollectibleImportRecord,
  CollectibleOwnershipRecord,
} from '../collectibles/types';
import { AdminBanPanel } from '../components/AdminBanPanel';
import {
  AdminMobileNavigation,
  AdminSidebar,
  type AdminSectionId,
} from '../components/shell/AdminSidebar';
import { CurrencyAmount, CurrencyText } from '../components/ui/CurrencyAmount';
import { FileInput, IntegerInput, TextArea, TextInput } from '../components/ui/FormControls';
import {
  Button,
  EmptyState,
  MetricCard,
  PageLayout,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { VirtualList } from '../components/ui/VirtualList';
import type { AuthUser, GiftCodeAdminRecord } from '../types';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';

function collectibleKey(item: CollectibleAdminRecord) { return item.id; }
function ownershipKey(record: CollectibleOwnershipRecord) { return record.id; }
function giftCodeKey(gift: GiftCodeAdminRecord) { return gift.id; }
function redemptionKey(record: GiftRedemptionRecord) { return `${record.user_id}-${record.redeemed_at}`; }

const collectibleFormatExample = `[
  {
    "sourceArtworkId": 28560,
    "title": "The Bedroom",
    "artist": "Vincent van Gogh",
    "dateDisplay": "1889",
    "mediumDisplay": "Oil on canvas",
    "dimensions": "73.6 × 92.3 cm",
    "imageId": "芝加哥艺术博物馆 image_id",
    "isPublicDomain": true,
    "initialOwnerId": 123
  }
]`;

const ADMIN_SECTION_COPY: Record<AdminSectionId, { title: string; description: string }> = {
  overview: { title: '世界概况', description: '查看 Economy 世界状态与核心运营指标。' },
  community: { title: '玩家社区', description: '配置客户端侧边栏使用的官方社区入口。' },
  collectibles: { title: '藏品管理', description: '导入公版藏品并复核当前归属与流转历史。' },
  'gift-codes': { title: '礼品码', description: '创建、停用礼品码并审阅玩家兑换记录。' },
  bans: { title: '账号封禁', description: '复核同 IP 多账号事件并调整账号封禁状态。' },
};

function parseImportItems(value: unknown): CollectibleImportRecord[] {
  const records = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : [];
  return records as CollectibleImportRecord[];
}

function ownershipReason(record: CollectibleOwnershipRecord) {
  if (record.reason === 'auction') return '拍卖成交';
  if (record.reason === 'assigned') return '管理员初始分配';
  return '创建藏品';
}

function populationStateLabel(state: 'normal' | 'cautious' | 'subsistence') {
  if (state === 'cautious') return '谨慎';
  if (state === 'subsistence') return '生存';
  return '正常';
}

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

export function AdminApp({ user }: { user: AuthUser }) {
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [banRefreshToken, setBanRefreshToken] = useState(0);
  const [summary, setSummary] = useState<ExtendedAdminSummary | null>(null);
  const [giftCodes, setGiftCodes] = useState<GiftCodeAdminRecord[]>([]);
  const [giftCodeTotal, setGiftCodeTotal] = useState(0);
  const [giftCodeCursor, setGiftCodeCursor] = useState<string | null>(null);
  const [loadingMoreGiftCodes, setLoadingMoreGiftCodes] = useState(false);
  const [collectibles, setCollectibles] = useState<CollectibleAdminRecord[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
  const [importItems, setImportItems] = useState<CollectibleImportRecord[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [ownership, setOwnership] = useState<CollectibleOwnershipRecord[]>([]);
  const [selectedCollectible, setSelectedCollectible] = useState<CollectibleAdminRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [qqGroupUrl, setQqGroupUrl] = useState('');
  const [savingCommunityLink, setSavingCommunityLink] = useState(false);

  const parsedGiftCount = parseIntegerDraft(giftCountInput, { min: 1, max: 50_000 });
  const parsedRewardCredits = parseIntegerDraft(rewardCreditsInput, { min: 1, max: 1_000_000 });
  const parsedMaxRedemptions = parseIntegerDraft(maxRedemptionsInput, { min: 1, max: 1_000_000 });
  const giftFormValid = parsedGiftCount !== null
    && parsedRewardCredits !== null
    && parsedMaxRedemptions !== null;

  const loadOverview = useCallback(async () => {
    setSummary(await adminApi.summary());
  }, []);

  const loadGiftCodes = useCallback(async () => {
    const nextCodesPage = await adminApi.giftCodes();
    setGiftCodes(nextCodesPage.items);
    setGiftCodeTotal(nextCodesPage.total);
    setGiftCodeCursor(nextCodesPage.nextCursor);
  }, []);

  const loadCollectibles = useCallback(async () => {
    setCollectibles(await adminApi.collectibles());
  }, []);

  const loadCommunityLink = useCallback(async () => {
    const nextCommunityLink = await adminApi.communityLink();
    setQqGroupUrl(nextCommunityLink.qqGroupUrl);
  }, []);

  const loadSection = useCallback(async (section: AdminSectionId) => {
    try {
      if (section === 'overview') await loadOverview();
      if (section === 'community') await loadCommunityLink();
      if (section === 'collectibles') await loadCollectibles();
      if (section === 'gift-codes') await loadGiftCodes();
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法加载当前管理员分区');
    }
  }, [loadCollectibles, loadCommunityLink, loadGiftCodes, loadOverview]);

  useEffect(() => { void loadSection(activeSection); }, [activeSection, loadSection]);

  if (user.role !== 'admin') {
    return <main className="admin-shell admin-denied"><section><h1>无权访问</h1><p>当前账号不是 Economy 管理员。</p><a href="/economy/">返回游戏</a></section></main>;
  }

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
      setNotice('生成数量必须为 1～50000');
      return;
    }
    if (parsedRewardCredits === null || parsedMaxRedemptions === null) {
      setNotice('奖励货币和每码最大兑换次数必须为 1～1000000 的整数');
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
      setNotice(`已创建 ${nextCodes.length} 个礼品码。明文仅保留在本次页面中，请立即下载 TXT。`);
      void loadSection('gift-codes');
    } catch (reason) {
      if (reason instanceof GameApiError) giftRequestKeyRef.current = '';
      setNotice(reason instanceof GameApiError
        ? reason.message
        : '请求连接中断；保持参数不变再次点击，会使用同一幂等键安全重试本批次。');
    } finally {
      setCreatingGift(false);
    }
  }

  async function disableGift(id: number) {
    try {
      await adminApi.disableGiftCode(id);
      setNotice(`礼品码 #${id} 已停用`);
      await loadSection('gift-codes');
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '停用礼品码失败');
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
      setNotice(reason instanceof Error ? reason.message : '读取更多礼品码失败');
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
      setNotice(reason instanceof Error ? reason.message : '读取兑换记录失败');
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
      setNotice(reason instanceof Error ? reason.message : '读取更多兑换记录失败');
    } finally {
      setLoadingMoreRedemptions(false);
    }
  }

  async function readCollectibleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const records = parseImportItems(parsed);
      if (records.length === 0) throw new Error('JSON 必须是藏品数组或包含 items 数组');
      setImportItems(records);
      setImportFileName(file.name);
      setNotice(`已读取 ${records.length} 条藏品记录，请确认后上传。`);
    } catch (reason) {
      setImportItems([]);
      setImportFileName('');
      setNotice(reason instanceof Error ? reason.message : '无法读取藏品 JSON');
    }
  }

  async function uploadCollectibles() {
    if (uploading || importItems.length === 0) return;
    setUploading(true);
    try {
      const result = await adminApi.importCollectibles(importItems);
      setNotice(`成功导入 ${result.importedCount} 件藏品。`);
      setImportItems([]);
      setImportFileName('');
      await loadSection('collectibles');
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '导入藏品失败');
    } finally {
      setUploading(false);
    }
  }

  async function showOwnership(item: CollectibleAdminRecord) {
    try {
      setSelectedCollectible(item);
      setOwnership(await adminApi.collectibleOwnership(item.id));
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '读取藏品归属记录失败');
    }
  }

  async function saveCommunityLink() {
    if (savingCommunityLink) return;
    setSavingCommunityLink(true);
    try {
      const saved = await adminApi.updateCommunityLink(qqGroupUrl.trim());
      setQqGroupUrl(saved.qqGroupUrl);
      setNotice('QQ群跳转链接已保存，玩家侧边栏将读取新地址。');
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '保存QQ群跳转链接失败');
    } finally {
      setSavingCommunityLink(false);
    }
  }

  function refreshActiveSection() {
    setNotice('');
    if (activeSection === 'bans') {
      setBanRefreshToken((current) => current + 1);
      return;
    }
    void loadSection(activeSection);
  }

  return (
    <main className={sidebarCollapsed ? 'admin-shell sidebar-layout sidebar-collapsed' : 'admin-shell sidebar-layout'}>
      <AdminSidebar
        email={user.email}
        activeSection={activeSection}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        onSelect={setActiveSection}
      />

      <section className="admin-workspace">
        <AdminMobileNavigation activeSection={activeSection} onSelect={setActiveSection} />
        <div className="admin-page-scroll">
          <div className="admin-page-frame">
            <PageLayout
              title={ADMIN_SECTION_COPY[activeSection].title}
              description={ADMIN_SECTION_COPY[activeSection].description}
              actions={<Button variant="secondary" onClick={refreshActiveSection}>刷新当前分区</Button>}
            >
              {error ? <div className="admin-alert danger" role="alert"><CurrencyText>{error}</CurrencyText></div> : null}
              {notice ? <div className="admin-alert" role="status"><CurrencyText>{notice}</CurrencyText></div> : null}

              {activeSection === 'overview' ? (
                <div className="admin-section-stack">
                  <section className="admin-summary-grid" aria-label="世界概况">
                    <MetricCard label="玩家数量" value={summary?.playerCount ?? '--'} />
                    <MetricCard label="未完成订单" value={summary?.openOrderCount ?? '--'} />
                    <MetricCard label="商品订单" value={summary?.commodityOrderCount ?? '--'} />
                    <MetricCard label="工厂订单" value={summary?.facilityOrderCount ?? '--'} />
                    <MetricCard label="藏品数量" value={summary?.collectibleCount ?? '--'} />
                    <MetricCard label="进行中拍卖" value={summary?.openAuctionCount ?? '--'} />
                    <MetricCard label="世界版本" value={summary?.worldVersion ?? '--'} />
                    <MetricCard label="API 状态" value={summary?.apiStatus ?? '--'} tone={summary?.apiStatus === 'ok' ? 'success' : 'neutral'} />
                  </section>

                  <Panel className="admin-panel admin-population-economy">
                    <WidgetHeading title="人口经济" />
                    {summary?.populationEconomy ? (
                      <>
                        <section className="admin-population-summary-grid" aria-label="人口经济总览">
                          <MetricCard label="人口可用资金" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.credits)}</CurrencyAmount>} />
                          <MetricCard label="人口冻结资金" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.frozenCredits)}</CurrencyAmount>} />
                          <MetricCard label="待结算就业收入" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.pendingIncome)}</CurrencyAmount>} />
                          <MetricCard label="施工就业托管" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.constructionEscrow)}</CurrencyAmount>} />
                          <MetricCard label="累计就业收入" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.totalEmploymentIncome)}</CurrencyAmount>} />
                          <MetricCard label="累计人口消费" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.totalConsumption)}</CurrencyAmount>} />
                          <MetricCard label="本周期消费预算" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.lastBudget)}</CurrencyAmount>} />
                          <MetricCard label="累计货币发行" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.issuance.total)}</CurrencyAmount>} />
                          <MetricCard label="累计稳定需求补充" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.issuance.stabilization)}</CurrencyAmount>} />
                        </section>

                        <div className="admin-population-model-grid">
                          {Object.values(summary.populationEconomy.models).map((model) => (
                            <section className="admin-population-model-card" key={model.id}>
                              <header><h3>{model.name}</h3><StatusTag tone={model.consumptionState === 'normal' ? 'success' : model.consumptionState === 'cautious' ? 'warning' : 'danger'}>{populationStateLabel(model.consumptionState)}</StatusTag></header>
                              <dl>
                                <div><dt>可用／冻结</dt><dd><CurrencyAmount>{formatCurrency(model.credits)}</CurrencyAmount>／<CurrencyAmount>{formatCurrency(model.frozenCredits)}</CurrencyAmount></dd></div>
                                <div><dt>最近收入／EMA</dt><dd><CurrencyAmount>{formatCurrency(model.lastIncome)}</CurrencyAmount>／<CurrencyAmount>{formatCurrency(model.incomeEma)}</CurrencyAmount></dd></div>
                                <div><dt>当前预算</dt><dd><CurrencyAmount>{formatCurrency(model.lastBudget)}</CurrencyAmount></dd></div>
                                <div><dt>稳定预算／本次补充</dt><dd><CurrencyAmount>{formatCurrency(model.stabilizationBudget)}</CurrencyAmount>／<CurrencyAmount>{formatCurrency(model.lastStabilizationIssued)}</CurrencyAmount></dd></div>
                                <div><dt>食品／家庭</dt><dd><CurrencyAmount>{formatCurrency(model.foodBudget)}</CurrencyAmount>／<CurrencyAmount>{formatCurrency(model.householdBudget)}</CurrencyAmount></dd></div>
                                <div><dt>连续无收入周期</dt><dd>{model.noIncomeCycles}</dd></div>
                                <div><dt>待结算</dt><dd><CurrencyAmount>{formatCurrency(Object.values(model.pendingIncome).reduce((sum, value) => sum + value, 0))}</CurrencyAmount></dd></div>
                              </dl>
                            </section>
                          ))}
                        </div>

                        <div className="admin-population-detail-grid">
                          <section>
                            <h3>就业收入来源</h3>
                            <dl className="admin-population-source-list">
                              <div><dt>生产运营</dt><dd><CurrencyAmount>{formatCurrency(summary.populationEconomy.sources.production)}</CurrencyAmount></dd></div>
                              <div><dt>建造业（固定 60/30/10）</dt><dd><CurrencyAmount>{formatCurrency(summary.populationEconomy.sources.construction)}</CurrencyAmount></dd></div>
                              <div><dt>仓库扩容</dt><dd><CurrencyAmount>{formatCurrency(summary.populationEconomy.sources.warehouse)}</CurrencyAmount></dd></div>
                              <div><dt>市场服务</dt><dd><CurrencyAmount>{formatCurrency(summary.populationEconomy.sources.marketService)}</CurrencyAmount></dd></div>
                            </dl>
                          </section>
                          <section>
                            <h3>生产工资复杂度</h3>
                            <div className="admin-population-complexity-grid">
                              {Object.entries(summary.populationEconomy.productionByComplexity).map(([complexity, amount]) => (
                                <div key={complexity}><span>{complexity}</span><strong><CurrencyAmount>{formatCurrency(amount)}</CurrencyAmount></strong></div>
                              ))}
                            </div>
                          </section>
                        </div>
                      </>
                    ) : <EmptyState>人口经济数据尚未初始化。</EmptyState>}
                  </Panel>
                </div>
              ) : null}

              {activeSection === 'community' ? (
                <Panel className="admin-panel admin-community-link-panel">
                  <WidgetHeading title="玩家社区入口" />
                  <p>配置桌面侧边栏“加入 QQ 群”按钮的跳转地址，仅接受 HTTPS 链接。</p>
                  <TextInput
                    label="QQ群跳转链接"
                    type="url"
                    inputMode="url"
                    maxLength={2048}
                    value={qqGroupUrl}
                    onChange={(event) => setQqGroupUrl(event.target.value)}
                    placeholder="https://qm.qq.com/q/..."
                  />
                  <Button disabled={savingCommunityLink} onClick={() => void saveCommunityLink()}>
                    {savingCommunityLink ? '正在保存…' : '保存链接'}
                  </Button>
                </Panel>
              ) : null}

              {activeSection === 'collectibles' ? (
                <div className="admin-section-stack">
                  <Panel className="admin-panel admin-collectible-upload">
                    <WidgetHeading title="上传藏品" />
                    <p>仅接受芝加哥艺术博物馆公版藏品。图片地址由服务器根据 IIIF image_id 生成，不允许上传任意图片 URL。</p>
                    <FileInput
                      label="藏品 JSON 文件"
                      accept="application/json,.json"
                      onChange={(event) => void readCollectibleFile(event)}
                    />
                    <pre className="admin-collectible-format">{collectibleFormatExample}</pre>
                    <div className="admin-collectible-preview">
                      <span>{importFileName ? `${importFileName} · ${importItems.length} 条` : '尚未选择文件'}</span>
                      <Button disabled={uploading || importItems.length === 0} onClick={() => void uploadCollectibles()}>{uploading ? '正在导入…' : '导入藏品'}</Button>
                    </div>
                  </Panel>

                  <Panel className="admin-panel admin-gift-list">
                    <WidgetHeading title="藏品管理与当前归属" />
                    {collectibles.length === 0 ? <EmptyState>暂无藏品。</EmptyState> : (
                      <div className="virtual-record-table admin-collectibles-virtual-table" role="table" aria-label="藏品管理与当前归属">
                        <div className="virtual-record-header" role="row">
                          <span role="columnheader">图片</span><span role="columnheader">藏品</span><span role="columnheader">艺术家</span><span role="columnheader">当前归属</span><span role="columnheader">状态</span><span role="columnheader">归属记录</span><span role="columnheader">操作</span>
                        </div>
                        <VirtualList items={collectibles} getKey={collectibleKey} estimateSize={72} viewportHeight={560} minViewportHeight={96} overscan={5} gap={0} className="virtual-record-viewport" role="rowgroup" itemRole="presentation" ariaLabel="藏品管理行" renderItem={(item) => (
                          <div className="virtual-record-row" role="row">
                            <span role="cell"><img className="admin-collectible-thumb" src={item.thumbnailUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" referrerPolicy="no-referrer" /></span>
                            <span role="cell"><strong>{item.title}</strong><small> AIC #{item.sourceArtworkId}</small></span>
                            <span role="cell">{item.artist || '佚名'}</span>
                            <span role="cell">{item.currentOwnerId ? `${item.currentOwnerName} (#${item.currentOwnerId})` : '未分配'}</span>
                            <span role="cell"><StatusTag tone={item.auctionId ? 'warning' : 'neutral'}>{item.auctionId ? '拍卖中' : '未拍卖'}</StatusTag></span>
                            <span role="cell">{item.ownershipCount}</span>
                            <span role="cell"><span className="admin-row-actions"><a className="ui-link" href={item.sourceUrl} target="_blank" rel="noreferrer">馆藏页</a><Button variant="compact" onClick={() => void showOwnership(item)}>归属历史</Button></span></span>
                          </div>
                        )} />
                      </div>
                    )}
                  </Panel>

                  {selectedCollectible ? (
                    <Panel className="admin-panel">
                      <WidgetHeading title={`《${selectedCollectible.title}》归属历史`} />
                      <VirtualList key={selectedCollectible.id} items={ownership} getKey={ownershipKey} estimateSize={72} viewportHeight={420} minViewportHeight={80} overscan={5} gap={8} className="admin-ownership-list admin-ownership-virtual-list" ariaLabel={`${selectedCollectible.title}归属历史`} empty={<EmptyState>暂无归属记录。</EmptyState>} renderItem={(record) => (
                        <div><span>{record.fromOwnerId ? `${record.fromOwnerName} (#${record.fromOwnerId})` : '系统'}</span><strong>→</strong><span>{record.toOwnerId ? `${record.toOwnerName} (#${record.toOwnerId})` : '未分配'}</span><small>{ownershipReason(record)}{record.price ? <> · <CurrencyAmount>{formatCurrency(record.price)}</CurrencyAmount></> : null} · {formatTime(record.createdAt)}</small></div>
                      )} />
                    </Panel>
                  ) : null}
                </div>
              ) : null}

              {activeSection === 'gift-codes' ? (
                <div className="admin-section-stack">
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
              ) : null}

              {activeSection === 'bans' ? <AdminBanPanel onNotice={setNotice} refreshToken={banRefreshToken} /> : null}
            </PageLayout>
          </div>
        </div>
      </section>
    </main>
  );
}
