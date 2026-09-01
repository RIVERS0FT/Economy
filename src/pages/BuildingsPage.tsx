import { CompactCurrency, CompactNumber } from '../components/ui/CompactNumber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelFacilityBuildProcurement,
  createFacilityBuildProcurement,
  getFacilityBuildProcurementQuote,
} from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { ProductArtwork } from '../components/products/ProductArtwork';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import { MoneyInput, SelectInput } from '../components/ui/FormControls';
import { RichSelectInput } from '../components/ui/RichSelectInput';
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
import type { FacilityBuildProcurementQuote } from '../utils/facilityBuildProcurement';
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
  recipesForType,
  resolveFacilityDetailRecipeState,
  type FacilityClusterEntry,
} from './production/ProductionFacilityDetail';
import '../styles/production-methods.css';
import '../styles/facility-build-select.css';


/*
 * Split-module ownership manifest for static page-contract verification. Runtime implementations live in
 * production/ProductionFacilityDetail.tsx:
 * SwitchControl; checked={group.enabled}; facilityStatusLabel; facility-status-header;
 * facility-card-title-row; facility-card-title-block; facility-count-summary; facility-staffing-summary;
 * 异常：资金不足; 异常：原料不足;
 * 运行中 <strong>{<CompactNumber value={group.participatingCount} />}</strong>;
 * 新增生产可用工厂立即参与运行并同步稀释满员率;
 * 冻结中 <strong>{<CompactNumber value={group.frozenCount ?? group.listedCount} />}</strong>;
 * FacilityProductionFormula; facility-recipe-section; <strong>生产产物</strong>; <strong>生产配置</strong>;
 * 作业制度; 生产方式; 生产进度已清零;
 * formatNumber(group.count). The legacy branch `if (!entry.constructionOnly)` was removed because
 * construction tasks no longer create selector/detail entries.
 * Retired broad page-verifier markers only: title="建筑概况"; className="buildings-summary-metrics";
 * className="buildings-list-filters"; label="产业分类"; label="运行状态".
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

export function BuildingsPage({
  model,
  embedded = false,
  detailFacilityTypeId,
  onDetailFacilityChange,
}: {
  model: LoadedGameViewModel;
  embedded?: boolean;
  detailFacilityTypeId?: string;
  onDetailFacilityChange?: (facilityTypeId: string | null) => void;
}) {
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

  const now = game.lastProcessedAt;
  const [internalDetailFacilityTypeId, setInternalDetailFacilityTypeId] = useState('');
  const [buildQuantity, setBuildQuantity] = useState(1);
  const [procurementPriceDrafts, setProcurementPriceDrafts] = useState<Record<string, string>>({});
  const [procurementGroups, setProcurementGroups] = useState<FacilityBuildProcurementGroup[]>(
    () => loadFacilityBuildProcurementGroups(game.userId),
  );
  const [procurementPending, setProcurementPending] = useState(false);
  const [procurementQuoteState, setProcurementQuoteState] = useState<{
    key: string;
    quote: FacilityBuildProcurementQuote;
  } | null>(null);
  const [procurementQuoteLoading, setProcurementQuoteLoading] = useState(false);
  const [procurementQuoteError, setProcurementQuoteError] = useState('');
  const [cancellingProcurementId, setCancellingProcurementId] = useState('');
  const [optimisticRecipeIds, setOptimisticRecipeIds] = useState<Record<string, string>>({});
  const procurementPriceContextRef = useRef('');
  const recipeTargetByFacilityRef = useRef(new Map<string, string>());
  const recipeInFlightFacilitiesRef = useRef(new Set<string>());
  const lastConfirmedRecipeIdsRef = useRef(new Map<string, string>());
  const activeDetailFacilityTypeId = onDetailFacilityChange
    ? detailFacilityTypeId ?? ''
    : internalDetailFacilityTypeId;

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
      if (!group || group.count < 1) return [];
      const optimisticRecipeId = optimisticRecipeIds[type.id];
      const displayGroup = optimisticRecipeId && optimisticRecipeId !== group.activeRecipeId
        ? { ...group, activeRecipeId: optimisticRecipeId }
        : group;
      return [{ type, group: displayGroup }];
    });
  }, [game.facilityGroups, game.facilityTypes, optimisticRecipeIds]);
  const selectedFacilityEntry = orderedFacilityGroups.find(
    ({ type }) => type.id === activeDetailFacilityTypeId,
  );

  useEffect(() => {
    if (selectedType && selectedType.id !== selectedFacilityTypeId) {
      setSelectedFacilityTypeId(selectedType.id);
    }
  }, [selectedFacilityTypeId, selectedType, setSelectedFacilityTypeId]);

  useEffect(() => {
    if (!activeDetailFacilityTypeId || selectedFacilityEntry) return;
    if (onDetailFacilityChange) onDetailFacilityChange(null);
    else setInternalDetailFacilityTypeId('');
  }, [activeDetailFacilityTypeId, onDetailFacilityChange, selectedFacilityEntry]);

  useEffect(() => {
    const authoritativeGroups = new Map(
      game.facilityGroups.map((group) => [group.facilityTypeId, group]),
    );
    for (const group of game.facilityGroups) {
      if (
        !recipeInFlightFacilitiesRef.current.has(group.facilityTypeId)
        && !recipeTargetByFacilityRef.current.has(group.facilityTypeId)
      ) {
        lastConfirmedRecipeIdsRef.current.set(group.facilityTypeId, group.activeRecipeId);
      }
    }
    setOptimisticRecipeIds((current) => {
      let changed = false;
      const next = { ...current };
      for (const [facilityTypeId, recipeId] of Object.entries(current)) {
        const authoritative = authoritativeGroups.get(facilityTypeId);
        if (!authoritative || authoritative.activeRecipeId === recipeId) {
          delete next[facilityTypeId];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [game.facilityGroups]);

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
    if (!selectedType) return undefined;
    const contextKey = `${model.selectedProvinceId}:${selectedType.id}:${buildQuantity}`;
    const controller = new AbortController();
    setProcurementQuoteLoading(true);
    setProcurementQuoteError('');
    void getFacilityBuildProcurementQuote(
      model.selectedProvinceId,
      selectedType.id,
      buildQuantity,
      controller.signal,
    ).then((quote) => {
      if (controller.signal.aborted) return;
      setProcurementQuoteState({ key: contextKey, quote });
      if (procurementPriceContextRef.current !== contextKey) {
        procurementPriceContextRef.current = contextKey;
        setProcurementPriceDrafts(Object.fromEntries(
          Object.entries(quote.materialOrderPrices).map(([productId, price]) => [
            productId,
            price.toFixed(2),
          ]),
        ));
      }
    }).catch((reason) => {
      if (controller.signal.aborted) return;
      setProcurementQuoteError(reason instanceof Error ? reason.message : '建造采购报价加载失败');
    }).finally(() => {
      if (!controller.signal.aborted) setProcurementQuoteLoading(false);
    });
    return () => controller.abort();
  }, [buildQuantity, game.inventories, game.markets, model.selectedProvinceId, selectedType]);

  if (!selectedType) {
    const hasCatalog = game.facilityTypes.length > 0;
    const emptyContent = (
      <Panel className="empty-state">
        {hasCatalog ? '当前没有已解锁工厂。' : '暂无工厂类型。'}
      </Panel>
    );
    return embedded ? emptyContent : (
      <PageLayout
        title="建筑"
        description={hasCatalog ? '当前没有已解锁工厂，请先前往研发页面完成对应科技。' : '服务器尚未返回工厂目录。'}
      >
        {emptyContent}
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
  const procurementQuoteKey = `${model.selectedProvinceId}:${selectedType.id}:${buildQuantity}`;
  const procurementQuote = procurementQuoteState?.key === procurementQuoteKey
    ? procurementQuoteState.quote
    : null;
  const needsProcurement = missingBuildMaterials.length > 0;
  const estimatedTotalSpend = buildCashCost + Number(procurementQuote?.estimatedTotal || 0);
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
    const market = game.markets[item.productId];
    const fallback = procurementQuote?.materialOrderPrices[item.productId]
      ?? market?.bestAsk
      ?? market?.bestBid
      ?? 1;
    const normalized = normalizeOrderPrice(procurementPriceDrafts[item.productId] ?? fallback.toFixed(2));
    return normalized === null ? [] : [[item.productId, normalized]];
  }));
  const invalidOrderPriceProductIds = missingBuildMaterials
    .filter((item) => materialOrderPrices[item.productId] === undefined)
    .map((item) => item.productId);
  const crossingSellOrderIds = new Set<string>();
  const effectiveProcurementMaterials = missingBuildMaterials.flatMap((item) => {
    const price = materialOrderPrices[item.productId];
    if (price === undefined) return [{ ...item }];
    let releasedQuantity = 0;
    for (const order of game.orders) {
      if (!openOwnCommoditySell(order, item.productId, price)) continue;
      crossingSellOrderIds.add(order.id);
      releasedQuantity += Math.max(0, Number(order.remaining || 0));
    }
    const quantity = Math.max(0, item.quantity - releasedQuantity);
    return quantity > 0 ? [{ productId: item.productId, quantity }] : [];
  });
  const crossingSellOrderCount = crossingSellOrderIds.size;
  const procurementOrderTotalCents = effectiveProcurementMaterials.reduce((total, item) => {
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
  const effectiveOwnOpenOrderCount = Math.max(0, ownOpenOrderCount - crossingSellOrderCount);
  const maxOpenOrderCount = openOrderLimitForCatalog(game.products.length, game.facilityTypes.length);

  const buildDisabledReason = game.credits < buildCashCost
    ? `建造资金不足，还需要 ${formatCurrency(buildCashCost - game.credits)}。`
    : needsProcurement && procurementQuoteLoading
      ? '正在获取当前市场采购报价。'
      : needsProcurement && procurementQuoteError
        ? `采购报价加载失败：${procurementQuoteError}`
        : needsProcurement && !procurementQuote
          ? '当前市场采购报价尚未就绪。'
    : needsProcurement && procurementQuote?.complete && procurementQuote.selfCrossingProductIds.length > 0
      ? `${procurementQuote.selfCrossingProductIds.map(productName).join('、')}存在自己的交叉卖单，请先撤单。`
      : needsProcurement && procurementQuote?.complete && game.credits < estimatedTotalSpend
        ? `建造与采购总资金不足，预计需要 ${formatCurrency(estimatedTotalSpend)}。`
        : undefined;
  const procurementOrderDisabledReason = invalidOrderPriceProductIds.length > 0
    ? `${invalidOrderPriceProductIds.map(productName).join('、')}买单价格无效。`
    : effectiveOwnOpenOrderCount + effectiveProcurementMaterials.length > maxOpenOrderCount
      ? `未完成订单数量不足以再提交 ${formatNumber(effectiveProcurementMaterials.length)} 张建造材料买单。`
      : game.credits < buildCashCost + procurementOrderTotal
        ? `建造与缺料买单总资金不足，最多需要 ${formatCurrency(buildCashCost + procurementOrderTotal)}。`
        : undefined;
  const actionDisabledReason = needsProcurement && procurementQuote && !procurementQuote.complete
    ? procurementOrderDisabledReason
    : buildDisabledReason;

  const selectFacilityEntry = (facilityTypeId: string) => {
    if (onDetailFacilityChange) onDetailFacilityChange(facilityTypeId);
    else setInternalDetailFacilityTypeId(facilityTypeId);
  };

  const closeFacilityDetail = () => {
    if (onDetailFacilityChange) onDetailFacilityChange(null);
    else setInternalDetailFacilityTypeId('');
  };

  const toggleSelectedFacility = (enabled: boolean) => {
    if (!selectedFacilityEntry) return;
    void showResult(
      enabled
        ? startFacility(selectedFacilityEntry.group.facilityTypeId)
        : stopFacility(selectedFacilityEntry.group.facilityTypeId),
    );
  };
  const flushFacilityRecipeQueue = (facilityTypeId: string) => {
    if (recipeInFlightFacilitiesRef.current.has(facilityTypeId)) return;
    recipeInFlightFacilitiesRef.current.add(facilityTypeId);
    void (async () => {
      try {
        while (true) {
          const targetRecipeId = recipeTargetByFacilityRef.current.get(facilityTypeId);
          if (!targetRecipeId) break;
          recipeTargetByFacilityRef.current.delete(facilityTypeId);
          const result = await setFacilityRecipe(facilityTypeId, targetRecipeId);
          const hasNewerTarget = recipeTargetByFacilityRef.current.has(facilityTypeId);
          if (result.ok) {
            lastConfirmedRecipeIdsRef.current.set(facilityTypeId, targetRecipeId);
          } else if (!hasNewerTarget) {
            const fallbackRecipeId = lastConfirmedRecipeIdsRef.current.get(facilityTypeId);
            setOptimisticRecipeIds((current) => {
              if (current[facilityTypeId] !== targetRecipeId) return current;
              const next = { ...current };
              if (fallbackRecipeId) next[facilityTypeId] = fallbackRecipeId;
              else delete next[facilityTypeId];
              return next;
            });
          }
          if (!hasNewerTarget) void showResult(result);
        }
      } finally {
        recipeInFlightFacilitiesRef.current.delete(facilityTypeId);
      }
    })();
  };
  const changeSelectedFacilityRecipe = (recipeId: string) => {
    if (!selectedFacilityEntry) return;
    const recipeState = resolveFacilityDetailRecipeState(selectedFacilityEntry);
    if (recipeId === recipeState.selectedRecipeId) return;
    const facilityTypeId = selectedFacilityEntry.group.facilityTypeId;
    if (!lastConfirmedRecipeIdsRef.current.has(facilityTypeId)) {
      const authoritative = game.facilityGroups.find((group) => group.facilityTypeId === facilityTypeId);
      lastConfirmedRecipeIdsRef.current.set(
        facilityTypeId,
        authoritative?.activeRecipeId ?? recipeState.selectedRecipeId,
      );
    }
    recipeTargetByFacilityRef.current.set(facilityTypeId, recipeId);
    setOptimisticRecipeIds((current) => (
      current[facilityTypeId] === recipeId ? current : { ...current, [facilityTypeId]: recipeId }
    ));
    flushFacilityRecipeQueue(facilityTypeId);
  };
  const openProductMarket = (productId: string) => {
    selectMarketAsset('commodity', productId);
  };
  const openProductContracts = (productId: string) => {
    setContractMarketIntent(productId, model.selectedProvinceId);
    model.setTab('contracts');
  };

  const submitBuildProcurementOrders = async () => {
    if (procurementPending || procurementOrderDisabledReason) {
      return { ok: false, message: procurementOrderDisabledReason ?? '建造材料买单正在提交' };
    }
    setProcurementPending(true);
    try {
      const response = await createFacilityBuildProcurement(
        model.selectedProvinceId,
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
      void model.refresh({ mode: 'authoritative' });
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
      void model.refresh({ mode: 'authoritative' });
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
    if (!procurementQuote?.complete) {
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

  const buildCard = (
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
            value={procurementQuoteLoading
              ? '正在获取当前卖盘…'
              : procurementQuoteError
                ? '报价加载失败'
                : procurementQuote?.complete
              ? <CurrencyAmount>{formatCurrency(procurementQuote.estimatedTotal)}</CurrencyAmount>
              : '卖盘不足 · 可挂买单'}
            tone={procurementQuote?.complete ? 'neutral' : 'danger'}
          />
        ) : null}
        {needsProcurement && procurementQuote?.complete ? (
          <DataRow
            label="预计总支出"
            value={<CurrencyAmount>{formatCurrency(estimatedTotalSpend)}</CurrencyAmount>}
            tone={game.credits >= estimatedTotalSpend ? 'neutral' : 'danger'}
          />
        ) : null}
        {needsProcurement && procurementQuote && !procurementQuote.complete && invalidOrderPriceProductIds.length === 0 ? (
          <DataRow
            label="买单最高占用"
            value={<CurrencyAmount>{formatCurrency(procurementOrderTotal)}</CurrencyAmount>}
            tone={game.credits >= buildCashCost + procurementOrderTotal ? 'neutral' : 'danger'}
          />
        ) : null}
      </DataList>

      {needsProcurement && procurementQuote && !procurementQuote.complete ? (
        <div className="facility-build-order-prices">
          {missingBuildMaterials.map((item) => {
            const fallbackPrice = procurementQuote.materialOrderPrices[item.productId]
              ?? game.markets[item.productId]?.bestAsk
              ?? game.markets[item.productId]?.bestBid
              ?? 1;
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
        disabled={Boolean(actionDisabledReason) || procurementPending || procurementQuoteLoading}
      >
        {needsProcurement
          ? procurementQuote?.complete
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
          ? procurementQuote?.complete
            ? '提交时服务器按当前卖盘价格上限一次购齐缺料；任一材料不足或价格超限时整笔采购与建造全部回滚。'
            : crossingSellOrderCount > 0
              ? `提交时服务器会先自动撤销 ${formatNumber(crossingSellOrderCount)} 张与本次买价交叉的本人卖单，释放库存后重新计算真实缺口；可成交部分立即按正式订单簿成交，剩余数量继续挂在市场。`
              : '当前卖盘无法一次购齐。提交后可成交部分立即按正式订单簿成交，剩余数量作为普通商品买单留在市场；建造资金不会冻结，材料购齐后再点击建造。'
          : <>提交后立即扣除{selectedBuildInputs.length === 0 ? '建造资金' : '资金与建造材料'}，工厂直接加入同类集群；运行中的集群保持当前进度并重新计算满员率。</>)}
      </small>

      {procurementGroups.length > 0 ? (
        <div className="facility-build-procurements">
          <div className="facility-build-procurements__heading">
            <strong>待采购</strong>
            <StatusTag tone="neutral">{<CompactNumber value={procurementGroups.length} />} 次</StatusTag>
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
                  <strong>{facilityType?.name ?? group.facilityTypeId} × {<CompactNumber value={group.quantity} />}</strong>
                  <span>{<CompactNumber value={openOrderCount} />} 张买单 · 剩余 {<CompactNumber value={remainingQuantity} />} 件</span>
                </div>
                <div className="facility-build-procurement-group__orders">
                  {rows.map((row) => (
                    <div className="facility-build-procurement-order" key={row.orderId}>
                      <span>{productName(row.productId)}</span>
                      <span>
                        已成交 {<CompactNumber value={row.filled} />} / {<CompactNumber value={row.quantity} />} · 剩余 {<CompactNumber value={row.remaining} />} · {<CompactCurrency value={row.price} />}
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
  );

  const facilityList = (
    <section className="facility-cluster-selector-region" aria-label="建筑列表">
      <div className="facility-cluster-selector-list">
        {orderedFacilityGroups.map((entry) => (
          <FacilityClusterSelectorCard
            key={entry.group.facilityTypeId}
            entry={entry}
            products={game.products}
            now={now}
            onSelect={() => selectFacilityEntry(entry.type.id)}
          />
        ))}
      </div>

      {orderedFacilityGroups.length === 0 ? (
        <div className="empty-state tall">尚未拥有建筑。先建设第一座工厂。</div>
      ) : null}
    </section>
  );

  const facilityDetail = selectedFacilityEntry ? (
    <div className="facility-cluster-detail-shell facility-cluster-detail-page">
      <PagePanel className="production-surface facility-card facility-group-card facility-cluster-detail-card">
        <FacilityClusterDetailContent
          entry={selectedFacilityEntry}
          products={game.products}
          inventories={game.inventories}
          markets={game.markets}
          credits={game.credits}
          completedTechnologyIds={game.research?.completedTechnologyIds ?? []}
          researchTechnologies={game.researchTechnologies ?? []}
          now={now}
          onToggle={toggleSelectedFacility}
          onRecipeChange={changeSelectedFacilityRecipe}
          onOpenProductMarket={openProductMarket}
          onOpenContracts={openProductContracts}
          titleId="facility-detail-title"
        />
      </PagePanel>
    </div>
  ) : null;

  const buildingsManagementContent = selectedFacilityEntry ? facilityDetail : (
    <div className="regional-buildings-management">
      {buildCard}
      {facilityList}
    </div>
  );

  const buildingsContent = buildingsManagementContent;

  if (embedded) return buildingsContent;

  if (selectedFacilityEntry) {
    const provinceName = model.selectedProvince?.name || '加利福尼亚州';
    return (
      <PageLayout
        title={(
          <RegionalEntityPageTitle
            entityName={selectedFacilityEntry.type.name}
            regionName={provinceName}
            className="province-facility-detail-title"
          />
        )}
        description="管理本州建筑的建造、运行、满员率、生产方式、投入产出与资产交易；商品库存和自动交易分别归属仓库与市场。"
        backAction={{ label: '返回建筑列表', onClick: closeFacilityDetail }}
      >
        {buildingsContent}
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`${model.selectedProvince?.name || '加利福尼亚州'}建筑`}
      description="管理本州建筑的建造、运行、满员率、生产方式、投入产出与资产交易；商品库存和自动交易分别归属仓库与市场。"
    >
      {buildingsContent}
    </PageLayout>
  );
}
