import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNow } from '../hooks/useNow';
import { type LoadedGameViewModel } from '../app/gameViewModel';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { SelectInput } from '../components/ui/FormControls';
import { WarehouseUpgradeCard } from '../components/warehouse/WarehouseUpgradeCard';
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
import { formatCurrency, formatNumber } from '../utils/formatters';
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

/*
 * Split-module ownership manifest for static page-contract verification. Runtime implementations live in
 * production/ProductionFacilityDetail.tsx and production/MobileFacilityDetailSheet.tsx:
 * SwitchControl; checked={group.enabled}; facilityStatusLabel; facility-status-header;
 * facility-card-title-row; facility-card-title-block; facility-count-summary; facility-staffing-summary;
 * 异常：资金不足; 异常：仓库已满; 异常：原料不足;
 * 运行中 <strong>{formatNumber(group.participatingCount)}</strong>;
 * 新增生产可用工厂立即参与运行并同步稀释满员率;
 * 冻结中 <strong>{formatNumber(group.frozenCount ?? group.listedCount)}</strong>;
 * FacilityProductionFormula; facility-recipe-section; <strong>生产产物</strong>; <strong>生产配置</strong>;
 * 作业制度; 生产方式; 生产进度已清零; 前往市场交易该工厂; 前往市场交易该工厂 →;
 * formatNumber(group.count). The legacy branch `if (!entry.constructionOnly)` was removed because
 * construction tasks no longer create selector/detail entries.
 */

export function ProductionPage({ model }: { model: LoadedGameViewModel }) {
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
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeFacilityDetail = useCallback(() => setFacilityDetailOpen(false), []);

  const selectedType = useMemo(
    () => game.facilityTypes.find((type) => type.id === selectedFacilityTypeId) ?? game.facilityTypes[0],
    [game.facilityTypes, selectedFacilityTypeId],
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
  const selectedRecipes = selectedType ? recipesForType(selectedType) : [];
  const selectedBuildInputs = selectedType.buildInputs ?? [];
  const maxBuildable = Math.max(0, Math.min(
    100,
    Math.floor(game.credits / Math.max(1, selectedType.buildCost)),
    ...selectedBuildInputs.map((item) => Math.floor(
      (game.inventories[item.productId]?.available ?? 0) / Math.max(1, item.quantity),
    )),
  ));

  useEffect(() => {
    if (effectiveSelectedFacilityGroupId !== selectedFacilityGroupId) {
      setSelectedFacilityGroupId(effectiveSelectedFacilityGroupId);
    }
    if (!effectiveSelectedFacilityGroupId && isFacilityDetailOpen) {
      setFacilityDetailOpen(false);
    }
  }, [effectiveSelectedFacilityGroupId, isFacilityDetailOpen, selectedFacilityGroupId]);

  if (!selectedType) {
    return (
      <PageLayout title="生产" description="服务器尚未返回工厂目录。">
        <Panel className="empty-state">暂无工厂类型。</Panel>
      </PageLayout>
    );
  }


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
      <WarehouseUpgradeCard model={model} className="factory-warehouse-card" />

      <div className="production-grid production-workspace">
        <PagePanel className="production-surface build-card production-build-card">
          <WidgetHeading title="建设新工厂" />
          <SelectInput
            label="工厂类型"
            value={selectedType.id}
            onChange={(event) => setSelectedFacilityTypeId(event.target.value)}
          >
            {game.facilityTypes.map((type) => (
              <option value={type.id} key={type.id}>
                {type.name}
              </option>
            ))}
          </SelectInput>
          <div className="facility-type-summary">
            <h3>{selectedType.name}</h3>
            <p>
              {selectedRecipes.length > 1
                ? `可选产物：${selectedRecipes.map((recipe) => recipe.name).join('／')}`
                : `固定产物：${selectedRecipes[0]?.name ?? selectedType.name}`}
            </p>
          </div>
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
            ) : selectedBuildInputs.map((item) => {
              const product = game.products.find((candidate) => candidate.id === item.productId);
              const available = game.inventories[item.productId]?.available ?? 0;
              const required = item.quantity * buildQuantity;
              return (
                <DataRow
                  key={item.productId}
                  label={product?.name ?? item.productId}
                  value={`${formatNumber(required)} / 库存 ${formatNumber(available)}`}
                  tone={available >= required ? 'neutral' : 'danger'}
                />
              );
            })}
            <DataRow label="最多可建" value={`${formatNumber(maxBuildable)} 座`} />
          </DataList>
          <Button
            block
            onClick={() => void showResult(buildFacility(selectedType.id, buildQuantity))}
            disabled={buildQuantity > maxBuildable}
          >
            {buildQuantity === 1 ? `立即建造${selectedType.name}` : `立即建造 ${buildQuantity} 座${selectedType.name}`}
          </Button>
          <small className="ui-helper-text">提交后立即扣除{selectedBuildInputs.length === 0 ? '建造资金' : '资金与建造材料'}，工厂直接加入同类集群；运行中的集群保持当前进度并重新计算满员率。</small>
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
            <div className="empty-state tall">尚未拥有工厂集群。先确认共享仓库容量，再建设第一座工厂。</div>
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
                warehouseAvailableCapacity={game.warehouseAvailableCapacity}
                now={now}
                onToggle={toggleSelectedFacility}
                onRecipeChange={changeSelectedFacilityRecipe}
                onOpenMarket={openSelectedFacilityMarket}
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
        warehouseAvailableCapacity={game.warehouseAvailableCapacity}
        now={now}
        isOpen={isFacilityDetailOpen}
        returnFocusRef={detailTriggerRef}
        onClose={closeFacilityDetail}
        onToggle={toggleSelectedFacility}
        onRecipeChange={changeSelectedFacilityRecipe}
        onOpenMarket={openSelectedFacilityMarket}
      />
    </PageLayout>
  );
}
