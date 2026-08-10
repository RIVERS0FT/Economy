import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cancelFacilityBuildProcurement, createFacilityBuildProcurement } from '../api/game';
import { useNow } from '../hooks/useNow';
import type { OnlineAutoSellAwareGameViewModel } from '../auto-sell/useOnlineAutoSell';
import { ProductArtwork } from '../components/products/ProductArtwork';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { MoneyInput, SelectInput } from '../components/ui/FormControls';
import { RichSelectInput } from '../components/ui/RichSelectInput';
import { WarehouseInventoryPanel } from '../components/warehouse/WarehouseInventoryPanel';
import {
  Button,
  DataList,
  DataRow,
  PageLayout,
  PagePanel,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import type { AssetOrder, FacilityGroup } from '../types';
import { quoteFacilityBuildProcurement } from '../utils/facilityBuildProcurement';
import {
  activeFacilityBuildProcurementGroups,
  loadFacilityBuildProcurementGroups,
  saveFacilityBuildProcurementGroups,
  type FacilityBuildProcurementGroup,
} from '../utils/facilityBuildProcurementGroups';
import { getUnlockedFacilityTypes } from '../utils/facilityResearchAccess';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { openOrderLimitForCatalog } from '../config/economy';
import { setContractMarketIntent } from '../contracts/navigation';
import {
  FacilityClusterDetailContent,
  FacilityClusterSelectorCard,
  isMobileFacilityLayout,
  recipesForType,
  resolveFacilityDetailRecipeState,
  type FacilityClusterEntry,
} from './production/ProductionFacilityDetail';
import { MobileFacilityDetailSheet } from './production/MobileFacilityDetailSheet';
import '../styles/production-methods.css';
import '../styles/facility-build-select.css';

/*
 * Split-module ownership manifest for static page-contract verification. Runtime implementations live in
 * production/ProductionFacilityDetail.tsx and production/MobileFacilityDetailSheet.tsx:
 * SwitchControl; checked={group.enabled}; facilityStatusLabel; facility-status-header;
 * facility-card-title-row; facility-card-title-block; facility-count-summary; facility-staffing-summary;
 * 异常：资金不足; 异常：原料不足;
 * 运行中 <strong>{formatNumber(group.participatingCount)}</strong>;
 * 新增生产可用工厂立即参与运行并同步稀释满员率;
 * 冻结中 <strong>{formatNumber(group.frozenCount ?? group.listedCount)}</strong>;
 * FacilityProductionFormula; facility-recipe-section; <strong>生产产物</strong>; <strong>生产配置</strong>;
 * 作业制度; 生产方式; 生产进度已清零; 前往市场交易该工厂; 前往市场交易该工厂 →;
 * formatNumber(group.count). The legacy branch `if (!entry.constructionOnly)` was removed because
 * construction tasks no longer create selector/detail entries.
 */

function normalizeOrderPrice(value: string) {
  const text = value.trim();
  if (!/^\d+(?:\.\d{0,2})?$/.test(text)) return null;
  const number = Number(text);
  const cents = Math.round(number * 100);
  return Number.isSafeInteger(cents) && cents >= 1 ? cents / 100 : null;
}

function openOwnCommoditySell(order: AssetOrder, productId: string, price: number) {
  return order.isOwn
    && order.assetKind === 'commodity'
    && order.assetId === productId
    && order.side === 'sell'
    && (order.status === 'open' || order.status === 'partial')
    && order.remaining > 0
    && order.price <= price;
}

export function ProductionPage({ model }: { model: OnlineAutoSellAwareGameViewModel }) {
  const {
    game,
    selectedFacilityTypeId,
    setSelectedFacilityTypeId,
    buildFacility,
    startFacility,
    stopFacility,
    setFacilityRecipe,
    selectMarketAsset,
    showResult,
  } = model;

  const now = useNow(game.lastProcessedAt);
  const [selectedFacilityGroupId, setSelectedFacilityGroupId] = useState('');
  const [isFacilityDetailOpen, setFacilityDetailOpen] = useState(false);
  const [buildQuantity, setBuildQuantity] = useState(1);
  const [procurementPriceDrafts, setProcurementPriceDrafts] = useState<Record<string, string>>({});
  const [procurementGroups, setProcurementGroups] = useState<FacilityBuildProcurementGroup[]>(
    () => loadFacilityBuildProcurementGroups(game.userId),
  );
  const [procurementPending, setProcurementPending] = useState(false);
  const [cancellingProcurementId, setCancellingProcurementId] = useState('');
  const procurementPriceContextRef = useRef('');
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeFacilityDetail = useCallback(() => setFacilityDetailOpen(false), []);

  const unlockedFacilityTypes = useMemo(
    () => getUnlockedFacilityTypes(game),
    [game.facilityTypes, game.research, game.researchTechnologies],
  );
  const productNamesById = useMemo(
    () => new Map(game.products.map((product) => [product.id, product.name])),
    [game.products],
  );
  const buildFacilityOptions = useMemo(() => unlockedFacilityTypes.map((type) => {
    const seenProductIds = new Set<string>();
    const outputProductIds = recipesForType(type).flatMap((recipe) => {
      const productId = recipe.output.productId;
      if (seenProductIds.has(productId)) return [];
      seenProductIds.add(productId);
      return [productId];
    });
    return {
      value: type.id,
      label: type.name,
      detail: (
        <span className="facility-build-output-list">
          {outputProductIds.map((productId) => (
            <span className="facility-build-output-item" key={productId}>
              <ProductArtwork productId={productId} />
              <span>{productNamesById.get(productId) ?? productId}</span>
            </span>
          ))}
        </span>
      ),
    };
  }), [productNamesById, unlockedFacilityTypes]);
  const selectedType = useMemo(
    () => unlockedFacilityTypes.find((type) => type.id === selectedFacilityTypeId) ?? unlockedFacilityTypes[0],
    [selectedFacilityTypeId, unlockedFacilityTypes],
  );
  const orderedFacilityGroups = useMemo<FacilityClusterEntry[]>(() => {
    const groupsByTypeId = new Map<string, FacilityGroup>(
      game.facilityGroups.map((group) => [group.facilityTypeId, group]),
    );

    return game.facilityTypes.flatMap((type): FacilityClusterEntry[] => {
      const group = groupsByTypeId.get(type.id);
      return group && group.count > 0 ? [{ type, group }] : [];
    });
  }, [game.facilityGroups, game.facilityTypes]);
  const facilityClusterStatusCounts = useMemo(() => {
    const summary: Record<FacilityGroup['status'], number> = {
      running: 0,
      stopped: 0,
      error: 0,
    };
    for (const entry of orderedFacilityGroups) {
      summary[entry.group.status] += 1;
    }
    return summary;
  }, [orderedFacilityGroups]);
  const selectedFacilityEntry =
    orderedFacilityGroups.find(({ type }) => type.id === selectedFacilityGroupId) ?? orderedFacilityGroups[0];
  const effectiveSelectedFacilityGroupId = selectedFacilityEntry?.type.id ?? '';

  useEffect(() => {
    if (selectedType && selectedType.id !== selectedFacilityTypeId) {
      setSelectedFacilityTypeId(selectedType.id);
    }
  }, [selectedFacilityTypeId, selectedType, setSelectedFacilityTypeId]);

  useEffect(() => {
    if (effectiveSelectedFacilityGroupId !== selectedFacilityGroupId) {
      setSelectedFacilityGroupId(effectiveSelectedFacilityGroupId);
    }
    if (!effectiveSelectedFacilityGroupId && isFacilityDetailOpen) {
      setFacilityDetailOpen(false);
    }
  }, [effectiveSelectedFacilityGroupId, isFacilityDetailOpen, selectedFacilityGroupId]);

  useEffect(() => {
    setProcurementGroups(loadFacilityBuildProcurementGroups(game.userId));
  }, [game.userId]);

  useEffect(() => {
    setProcurementGroups((current) => {
      const active = activeFacilityBuildProcurementGroups(current, game.orders);
      if (active.length === current.length && active.every((group, index) => group.id === current[index]?.id)) {
        return current;
      }
      saveFacilityBuildProcurementGroups(game.userId, active);
      return active;
    });
  }, [game.orders, game.userId]);

  useEffect(() => {
    if (!selectedType) return;
    const contextKey = `${selectedType.id}:${buildQuantity}`;
    if (procurementPriceContextRef.current === contextKey) return;
    procurementPriceContextRef.current = contextKey;
    const missing = (selectedType.buildInputs ?? []).flatMap((item) => {
      const required = item.quantity * buildQuantity;
      const available = game.inventories[item.productId]?.available ?? 0;
      const quantity = Math.max(0, required - available);
      return quantity > 0 ? [{ productId: item.productId, quantity }] : [];
    });
    const quote = quoteFacilityBuildProcurement(game.orders, missing);
    setProcurementPriceDrafts(Object.fromEntries(
      missing.map((item) => [item.productId, quote.materialOrderPrices[item.productId].toFixed(2)]),
    ));
  }, [buildQuantity, game.inventories, game.orders, selectedType]);

  if (!selectedType) {
    const hasCatalog = game.facilityTypes.length > 0;
    return (
      <PageLayout
        title="生产"
        description={hasCatalog ? '当前没有已解锁工厂，请先前往研发页面完成对应科技。' : '服务器尚未返回工厂目录。'}
      >
        <Panel className="empty-state">
          {hasCatalog ? '当前没有已解锁工厂。' : '暂无工厂类型。'}
        </Panel>
      </PageLayout>
    );
  }

  const selectedBuildInputs = selectedType.buildInputs ?? [];
  const buildCashCost = selectedType.buildCost * buildQuantity;
  const buildMaterialRequirements = selectedBuildInputs.map((item) => {
    const available = game.inventories[item.productId]?.available ?? 0;
    const required = item.quantity * buildQuantity;
    return {
      productId: item.productId,
      available,
      required,
      missing: Math.max(0, required - available),
    };
  });
  const missingBuildMaterials = buildMaterialRequirements
    .filter((item) => item.missing > 0)
    .map((item) => ({ productId: item.productId, quantity: item.missing }));
  const procurementQuote = quoteFacilityBuildProcurement(game.orders, missingBuildMaterials);
  const needsProcurement = procurementQuote.missingQuantity > 0;
  const estimatedTotalSpend = buildCashCost + procurementQuote.estimatedTotal;
  const inventoryBuildable = Math.max(0, Math.min(
    100,
    Math.floor(game.credits / Math.max(1, selectedType.buildCost)),
    ...selectedBuildInputs.map((item) => Math.floor(
      (game.inventories[item.productId]?.available ?? 0) / Math.max(1, item.quantity),
    )),
  ));
  const productName = (productId: string) => (
    game.products.find((candidate) => candidate.id === productId)?.name ?? productId
  );

  const materialOrderPrices = Object.fromEntries(missingBuildMaterials.flatMap((item) => {
    const fallback = procurementQuote.materialOrderPrices[item.productId];
    const normalized = normalizeOrderPrice(procurementPriceDrafts[item.productId] ?? fallback.toFixed(2));
    return normalized === null ? [] : [[item.productId, normalized]];
  }));
  const invalidOrderPriceProductIds = missingBuildMaterials
    .filter((item) => materialOrderPrices[item.productId] === undefined)
    .map((item) => item.productId);
  const selfCrossingOrderProductIds = missingBuildMaterials
    .filter((item) => {
      const price = materialOrderPrices[item.productId];
      return price !== undefined && game.orders.some((order) => openOwnCommoditySell(order, item.productId, price));
    })
    .map((item) => item.productId);
  const procurementOrderTotalCents = missingBuildMaterials.reduce((total, item) => {
    const price = materialOrderPrices[item.productId];
    if (price === undefined) return total;
    const cents = Math.round(price * 100);
    const lineTotal = cents * item.quantity;
    return Number.isSafeInteger(lineTotal) && Number.isSafeInteger(total + lineTotal)
      ? total + lineTotal
      : Number.MAX_SAFE_INTEGER;
  }, 0);
  const procurementOrderTotal = procurementOrderTotalCents / 100;
  const ownOpenOrderCount = game.orders.filter((order) => (
    order.isOwn && (order.status === 'open' || order.status === 'partial')
  )).length;
  const maxOpenOrderCount = openOrderLimitForCatalog(game.products.length, game.facilityTypes.length);

  const buildDisabledReason = game.credits < buildCashCost
    ? `建造资金不足，还需要 ${formatCurrency(buildCashCost - game.credits)}。`
    : needsProcurement && procurementQuote.complete && procurementQuote.selfCrossingProductIds.length > 0
      ? `${procurementQuote.selfCrossingProductIds.map(productName).join('、')}存在自己的交叉卖单，请先撤单。`
      : needsProcurement && procurementQuote.complete && game.credits < estimatedTotalSpend
        ? `建造与采购总资金不足，预计需要 ${formatCurrency(estimatedTotalSpend)}。`
        : undefined;
  const procurementOrderDisabledReason = invalidOrderPriceProductIds.length > 0
    ? `${invalidOrderPriceProductIds.map(productName).join('、')}买单价格无效。`
    : selfCrossingOrderProductIds.length > 0
      ? `${selfCrossingOrderProductIds.map(productName).join('、')}买价会与自己的卖单交叉，请先撤单或降低价格。`
      : ownOpenOrderCount + missingBuildMaterials.length > maxOpenOrderCount
        ? `未完成订单数量不足以再提交 ${formatNumber(missingBuildMaterials.length)} 张建造材料买单。`
        : game.credits < buildCashCost + procurementOrderTotal
          ? `建造与缺料买单总资金不足，最多需要 ${formatCurrency(buildCashCost + procurementOrderTotal)}。`
          : undefined;
  const actionDisabledReason = needsProcurement && !procurementQuote.complete
    ? procurementOrderDisabledReason
    : buildDisabledReason;

  const selectFacilityEntry = (facilityTypeId: string, trigger: HTMLButtonElement) => {
    detailTriggerRef.current = trigger;
    setSelectedFacilityGroupId(facilityTypeId);
    if (isMobileFacilityLayout()) setFacilityDetailOpen(true);
  };

  const toggleSelectedFacility = (enabled: boolean) => {
    if (!selectedFacilityEntry) return;
    void showResult(
      enabled
        ? startFacility(selectedFacilityEntry.group.facilityTypeId)
        : stopFacility(selectedFacilityEntry.group.facilityTypeId),
    );
  };
  const changeSelectedFacilityRecipe = (recipeId: string) => {
    if (!selectedFacilityEntry) return;
    const recipeState = resolveFacilityDetailRecipeState(selectedFacilityEntry);
    if (recipeId === recipeState.selectedRecipeId) return;
    void showResult(setFacilityRecipe(selectedFacilityEntry.group.facilityTypeId, recipeId));
  };
  const openSelectedFacilityMarket = () => {
    if (!selectedFacilityEntry) return;
    selectMarketAsset('facility', selectedFacilityEntry.group.facilityTypeId);
  };
  const openProductMarket = (productId: string) => {
    selectMarketAsset('commodity', productId);
  };
  const openProductContracts = (productId: string) => {
    setContractMarketIntent(productId);
    model.setTab('contracts');
  };

  const submitBuildProcurementOrders = async () => {
    if (procurementPending || procurementOrderDisabledReason) {
      return { ok: false, message: procurementOrderDisabledReason ?? '建造材料买单正在提交' };
    }
    setProcurementPending(true);
    try {
      const response = await createFacilityBuildProcurement(
        selectedType.id,
        buildQuantity,
        materialOrderPrices,
      );
      const group = response.result.procurementGroup;
      if (response.result.ok && group) {
        setProcurementGroups((current) => {
          const next = [group, ...current.filter((item) => item.id !== group.id)];
          saveFacilityBuildProcurementGroups(game.userId, next);
          return next;
        });
      }
      await model.refresh({ mode: 'authoritative' });
      return response.result;
    } catch (reason) {
      return { ok: false, message: reason instanceof Error ? reason.message : '建造材料买单提交失败' };
    } finally {
      setProcurementPending(false);
    }
  };

  const cancelProcurementGroup = async (group: FacilityBuildProcurementGroup) => {
    if (cancellingProcurementId) return { ok: false, message: '正在取消建造材料买单' };
    setCancellingProcurementId(group.id);
    try {
      const response = await cancelFacilityBuildProcurement(group.orders.map((order) => order.orderId));
      if (response.result.ok) {
        setProcurementGroups((current) => {
          const next = current.filter((item) => item.id !== group.id);
          saveFacilityBuildProcurementGroups(game.userId, next);
          return next;
        });
      }
      await model.refresh({ mode: 'authoritative' });
      return response.result;
    } catch (reason) {
      return { ok: false, message: reason instanceof Error ? reason.message : '建造材料买单取消失败' };
    } finally {
      setCancellingProcurementId('');
    }
  };

  const submitBuild = () => {
    if (actionDisabledReason || procurementPending) return;
    if (!needsProcurement) {
      void showResult(buildFacility(selectedType.id, buildQuantity));
      return;
    }
    if (!procurementQuote.complete) {
      void showResult(submitBuildProcurementOrders());
      return;
    }
    void showResult(buildFacility(selectedType.id, buildQuantity, {
      autoProcure: true,
      maxProcurementTotal: procurementQuote.estimatedTotal,
      materialPriceCaps: procurementQuote.materialPriceCaps,
    }));
  };

  const orderById = new Map(game.orders.map((order) => [order.id, order]));

  return (
    <PageLayout
      title="生产"
      description="同类未冻结工厂共享生产周期、配方、生产方式与满员率；变化即时生效，每个周期按完成时刻的满员率结算。"
      actions={
        <>
          <StatusTag tone="success">运行 {formatNumber(facilityClusterStatusCounts.running)}</StatusTag>
          <StatusTag tone="neutral">停止 {formatNumber(facilityClusterStatusCounts.stopped)}</StatusTag>
          <StatusTag tone={facilityClusterStatusCounts.error > 0 ? 'danger' : 'neutral'}>
            异常 {formatNumber(facilityClusterStatusCounts.error)}
          </StatusTag>
        </>
      }
    >
      <WarehouseInventoryPanel model={model} className="factory-warehouse-card" />

      <div className="production-grid production-workspace">
        <PagePanel className="production-surface build-card production-build-card">
          <WidgetHeading title="建设新工厂" />
          <RichSelectInput
            label="工厂类型"
            value={selectedType.id}
            options={buildFacilityOptions}
            onValueChange={setSelectedFacilityTypeId}
          />
          <SelectInput
            label="建造数量"
            value={String(buildQuantity)}
            onChange={(event) => setBuildQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
          >
            {[1, 5, 10, 25, 50, 100].map((quantity) => (
              <option value={quantity} key={quantity}>{quantity}</option>
            ))}
          </SelectInput>
          <DataList>
            <DataRow
              label="建造资金"
              value={<CurrencyAmount>{formatCurrency(selectedType.buildCost * buildQuantity)}</CurrencyAmount>}
              tone={game.credits >= selectedType.buildCost * buildQuantity ? 'neutral' : 'danger'}
            />
            {selectedBuildInputs.length === 0 ? (
              <DataRow label="建造材料" value="无需材料" />
            ) : buildMaterialRequirements.map((item) => (
              <DataRow
                key={item.productId}
                label={productName(item.productId)}
                value={item.missing > 0
                  ? `${formatNumber(item.required)} / 库存 ${formatNumber(item.available)} · 缺 ${formatNumber(item.missing)}`
                  : `${formatNumber(item.required)} / 库存 ${formatNumber(item.available)}`}
                tone={item.missing > 0 ? 'danger' : 'neutral'}
              />
            ))}
            <DataRow label="库存可直接建" value={`${formatNumber(inventoryBuildable)} 座`} />
            {needsProcurement ? (
              <DataRow
                label="预计采购"
                value={procurementQuote.complete
                  ? <CurrencyAmount>{formatCurrency(procurementQuote.estimatedTotal)}</CurrencyAmount>
                  : '卖盘不足 · 可挂买单'}
                tone={procurementQuote.complete ? 'neutral' : 'danger'}
              />
            ) : null}
            {needsProcurement && procurementQuote.complete ? (
              <DataRow
                label="预计总支出"
                value={<CurrencyAmount>{formatCurrency(estimatedTotalSpend)}</CurrencyAmount>}
                tone={game.credits >= estimatedTotalSpend ? 'neutral' : 'danger'}
              />
            ) : null}
            {needsProcurement && !procurementQuote.complete && invalidOrderPriceProductIds.length === 0 ? (
              <DataRow
                label="买单最高占用"
                value={<CurrencyAmount>{formatCurrency(procurementOrderTotal)}</CurrencyAmount>}
                tone={game.credits >= buildCashCost + procurementOrderTotal ? 'neutral' : 'danger'}
              />
            ) : null}
          </DataList>

          {needsProcurement && !procurementQuote.complete ? (
            <div className="facility-build-order-prices">
              {missingBuildMaterials.map((item) => {
                const fallbackPrice = procurementQuote.materialOrderPrices[item.productId];
                return (
                  <MoneyInput
                    key={item.productId}
                    label={`${productName(item.productId)}买单价格`}
                    value={procurementPriceDrafts[item.productId] ?? fallbackPrice.toFixed(2)}
                    fallbackValue={fallbackPrice}
                    min={0.01}
                    wheelStep={0.01}
                    onValueChange={(value) => setProcurementPriceDrafts((current) => ({
                      ...current,
                      [item.productId]: value,
                    }))}
                  />
                );
              })}
            </div>
          ) : null}

          <Button
            block
            onClick={submitBuild}
            disabled={Boolean(actionDisabledReason) || procurementPending}
          >
            {needsProcurement
              ? procurementQuote.complete
                ? buildQuantity === 1
                  ? `一键购齐并建造${selectedType.name}`
                  : `一键购齐并建造 ${buildQuantity} 座${selectedType.name}`
                : procurementPending
                  ? '正在提交缺料买单…'
                  : buildQuantity === 1
                    ? `一键提交${selectedType.name}缺料买单`
                    : `一键提交 ${buildQuantity} 座${selectedType.name}缺料买单`
              : buildQuantity === 1
                ? `立即建造${selectedType.name}`
                : `立即建造 ${buildQuantity} 座${selectedType.name}`}
          </Button>
          <small className="ui-helper-text">
            {actionDisabledReason ?? (needsProcurement
              ? procurementQuote.complete
                ? '提交时服务器按当前卖盘价格上限一次购齐缺料；任一材料不足或价格超限时整笔采购与建造全部回滚。'
                : '当前卖盘无法一次购齐。提交后可成交部分立即按正式订单簿成交，剩余数量作为普通商品买单留在市场；建造资金不会冻结，材料购齐后再点击建造。'
              : <>提交后立即扣除{selectedBuildInputs.length === 0 ? '建造资金' : '资金与建造材料'}，工厂直接加入同类集群；运行中的集群保持当前进度并重新计算满员率。</>)}
          </small>

          {procurementGroups.length > 0 ? (
            <div className="facility-build-procurements">
              <div className="facility-build-procurements__heading">
                <strong>待采购</strong>
                <StatusTag tone="neutral">{formatNumber(procurementGroups.length)} 次</StatusTag>
              </div>
              {procurementGroups.map((group) => {
                const facilityType = game.facilityTypes.find((type) => type.id === group.facilityTypeId);
                const rows = group.orders.map((reference) => {
                  const order = orderById.get(reference.orderId);
                  const remaining = order && (order.status === 'open' || order.status === 'partial')
                    ? Math.max(0, order.remaining)
                    : 0;
                  return {
                    ...reference,
                    remaining,
                    filled: order ? Math.max(0, reference.quantity - Math.max(0, Number(order.remaining || 0))) : 0,
                  };
                });
                const remainingQuantity = rows.reduce((sum, row) => sum + row.remaining, 0);
                const openOrderCount = rows.filter((row) => row.remaining > 0).length;
                return (
                  <div className="facility-build-procurement-group" key={group.id}>
                    <div className="facility-build-procurement-group__title">
                      <strong>{facilityType?.name ?? group.facilityTypeId} × {formatNumber(group.quantity)}</strong>
                      <span>{formatNumber(openOrderCount)} 张买单 · 剩余 {formatNumber(remainingQuantity)} 件</span>
                    </div>
                    <div className="facility-build-procurement-group__orders">
                      {rows.map((row) => (
                        <div className="facility-build-procurement-order" key={row.orderId}>
                          <span>{productName(row.productId)}</span>
                          <span>
                            已成交 {formatNumber(row.filled)} / {formatNumber(row.quantity)} · 剩余 {formatNumber(row.remaining)} · {formatCurrency(row.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Button
                      block
                      disabled={Boolean(cancellingProcurementId)}
                      onClick={() => void showResult(cancelProcurementGroup(group))}
                    >
                      {cancellingProcurementId === group.id ? '正在取消…' : '取消全部'}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </PagePanel>

        <PagePanel className="production-surface facility-cluster-navigation">
          <div className="facility-cluster-navigation-heading">
            <div>
              <h2 id="facility-cluster-navigation-title">工厂集群</h2>
              <p>按复杂度从 C1 到 C7 选择工厂并查看生产详情。</p>
            </div>
            <StatusTag tone="neutral">{formatNumber(orderedFacilityGroups.length)} 类</StatusTag>
          </div>

          <div className="facility-cluster-selector-list">
            {orderedFacilityGroups.map((entry) => (
              <FacilityClusterSelectorCard
                key={entry.group.facilityTypeId}
                entry={entry}
                products={game.products}
                now={now}
                onSelect={(trigger) => selectFacilityEntry(entry.type.id, trigger)}
              />
            ))}
          </div>

          {orderedFacilityGroups.length === 0 ? (
            <div className="empty-state tall">尚未拥有工厂集群。先建设第一座工厂。</div>
          ) : null}
        </PagePanel>

        <div className="facility-cluster-detail-shell">
          {selectedFacilityEntry ? (
            <PagePanel className="production-surface facility-card facility-group-card facility-cluster-detail-card">
              <FacilityClusterDetailContent
                entry={selectedFacilityEntry}
                products={game.products}
                inventories={game.inventories}
                markets={game.markets}
                credits={game.credits}
                now={now}
                onToggle={toggleSelectedFacility}
                onRecipeChange={changeSelectedFacilityRecipe}
                onOpenMarket={openSelectedFacilityMarket}
                onOpenProductMarket={openProductMarket}
                onOpenContracts={openProductContracts}
                titleId="desktop-facility-detail-title"
              />
            </PagePanel>
          ) : (
            <PagePanel className="production-surface empty-state tall facility-cluster-detail-card">
              建设第一座工厂后，可在此查看集群详情。
            </PagePanel>
          )}
        </div>
      </div>

      <MobileFacilityDetailSheet
        entry={selectedFacilityEntry}
        products={game.products}
        inventories={game.inventories}
        markets={game.markets}
        credits={game.credits}
        now={now}
        isOpen={isFacilityDetailOpen}
        returnFocusRef={detailTriggerRef}
        onClose={closeFacilityDetail}
        onToggle={toggleSelectedFacility}
        onRecipeChange={changeSelectedFacilityRecipe}
        onOpenMarket={openSelectedFacilityMarket}
        onOpenProductMarket={openProductMarket}
        onOpenContracts={openProductContracts}
      />
    </PageLayout>
  );
}
