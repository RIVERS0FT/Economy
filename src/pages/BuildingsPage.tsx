import { CompactCurrency, CompactNumber } from '../components/ui/CompactNumber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getFacilityBuildProcurementQuote } from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { ProductArtwork } from '../components/products/ProductArtwork';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { BuildingDetailPage } from '../components/buildings/BuildingDetailPage';
import { SelectInput } from '../components/ui/FormControls';
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
import type { FacilityGroup } from '../types';
import type { FacilityBuildProcurementQuote } from '../utils/facilityBuildProcurement';
import { getUnlockedFacilityTypes } from '../utils/facilityResearchAccess';
import { formatCurrency, formatNumber } from '../utils/formatters';
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


export function BuildingsPage({
  model,
  embedded = false,
  renderPart,
  detailFacilityTypeId,
  onDetailFacilityChange,
}: {
  model: LoadedGameViewModel;
  embedded?: boolean;
  renderPart?: 'build' | 'cards';
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
  const [procurementQuoteState, setProcurementQuoteState] = useState<{
    key: string;
    quote: FacilityBuildProcurementQuote;
  } | null>(null);
  const [procurementQuoteLoading, setProcurementQuoteLoading] = useState(false);
  const [procurementQuoteError, setProcurementQuoteError] = useState('');
  const [optimisticRecipeIds, setOptimisticRecipeIds] = useState<Record<string, string>>({});
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
    if (!selectedType || renderPart === 'cards') return undefined;
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
    }).catch((reason) => {
      if (controller.signal.aborted) return;
      setProcurementQuoteError(reason instanceof Error ? reason.message : '建造采购报价加载失败');
    }).finally(() => {
      if (!controller.signal.aborted) setProcurementQuoteLoading(false);
    });
    return () => controller.abort();
  }, [buildQuantity, game.inventories, game.markets, model.selectedProvinceId, selectedType, renderPart]);

  if (!selectedType) {
    if (renderPart === 'cards') return null;
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


  const buildDisabledReason = game.credits < buildCashCost
    ? `建造资金不足，还需要 ${formatCurrency(buildCashCost - game.credits)}。`
    : needsProcurement && procurementQuoteLoading
      ? '正在获取当日官方价采购报价。'
      : needsProcurement && procurementQuoteError
        ? `采购报价加载失败：${procurementQuoteError}`
        : needsProcurement && !procurementQuote
          ? '当日官方价采购报价尚未就绪。'
          : needsProcurement && game.credits < estimatedTotalSpend
            ? `建造与采购总资金不足，预计需要 ${formatCurrency(estimatedTotalSpend)}。`
            : undefined;
  const actionDisabledReason = buildDisabledReason;

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

  const submitBuild = () => {
    if (actionDisabledReason) return;
    if (!needsProcurement) {
      void showResult(buildFacility(selectedType.id, buildQuantity));
      return;
    }
    if (!procurementQuote) return;
    void showResult(buildFacility(selectedType.id, buildQuantity, {
      autoProcure: true,
      maxProcurementTotal: procurementQuote.estimatedTotal,
      materialPriceCaps: procurementQuote.materialPriceCaps,
    }));
  };

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
              ? '正在获取当日官方价…'
              : procurementQuoteError
                ? '报价加载失败'
                : procurementQuote
              ? <CurrencyAmount>{formatCurrency(procurementQuote.estimatedTotal)}</CurrencyAmount>
              : '报价尚未就绪'}
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
      </DataList>
      <Button
        block
        onClick={submitBuild}
        disabled={Boolean(actionDisabledReason) || procurementQuoteLoading}
      >
        {needsProcurement
          ? buildQuantity === 1
            ? `一键购齐并建造${selectedType.name}`
            : `一键购齐并建造 ${buildQuantity} 座${selectedType.name}`
          : buildQuantity === 1
            ? `立即建造${selectedType.name}`
            : `立即建造 ${buildQuantity} 座${selectedType.name}`}
      </Button>
      <small className="ui-helper-text">
        {actionDisabledReason ?? (needsProcurement
          ? '提交时服务器按建造州各缺失材料的当日官方系统价即时购齐并建造；任一价格保护、资金或建设校验失败时整笔事务回滚，不产生待成交商品订单。'
          : <>提交后立即扣除{selectedBuildInputs.length === 0 ? '建造资金' : '资金与建造材料'}，工厂直接加入同类集群；运行中的集群保持当前进度并重新计算满员率。</>)}
      </small>

    </PagePanel>
  );

  const facilityCards = orderedFacilityGroups.map((entry) => (
          <FacilityClusterSelectorCard
            key={entry.group.facilityTypeId}
            entry={entry}
            products={game.products}
            now={now}
            onSelect={() => selectFacilityEntry(entry.type.id)}
          />
        ));

  const facilityList = (
    <section className="facility-cluster-selector-region" aria-label="建筑列表">
      <div className="facility-cluster-selector-list">
        {facilityCards}
      </div>

      {orderedFacilityGroups.length === 0 ? (
        <div className="empty-state tall">尚未拥有建筑。先建设第一座工厂。</div>
      ) : null}
    </section>
  );

  if (renderPart === 'build') return buildCard;
  if (renderPart === 'cards') return <>{facilityCards}</>;

  const facilityDetail = selectedFacilityEntry ? (
    <BuildingDetailPage kind="industrial" name={selectedFacilityEntry.type.name}
      provinceName={model.selectedProvince?.name || '当前地区'} embedded={embedded} onBack={closeFacilityDetail}>
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
        />
    </BuildingDetailPage>
  ) : null;

  const buildingsManagementContent = selectedFacilityEntry ? facilityDetail : (
    <div className="regional-buildings-management">
      {buildCard}
      {facilityList}
    </div>
  );

  const buildingsContent = buildingsManagementContent;

  if (selectedFacilityEntry) return facilityDetail;
  if (embedded) return buildingsContent;

  return (
    <PageLayout
      title={`${model.selectedProvince?.name || '加利福尼亚州'}建筑`}
      description="管理本州建筑的建造、运行、满员率、生产方式、投入产出与资产交易；商品库存和自动交易分别归属仓库与市场。"
    >
      {buildingsContent}
    </PageLayout>
  );
}
