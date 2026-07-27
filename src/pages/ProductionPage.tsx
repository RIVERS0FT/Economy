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
import { formatCurrency, formatDuration, formatNumber } from '../utils/formatters';
import {
  FacilityClusterDetailContent,
  FacilityClusterSelectorCard,
  isMobileFacilityLayout,
  recipesForType,
  resolveFacilityDetailRecipeState,
  type FacilityClusterEntry,
} from './production/ProductionFacilityDetail';
import { MobileFacilityDetailSheet } from './production/MobileFacilityDetailSheet';
import '../styles/production-gem-acceleration.css';

/*
 * Split-module ownership manifest for static page-contract verification. Runtime implementations live in
 * production/ProductionFacilityDetail.tsx and production/MobileFacilityDetailSheet.tsx:
 * SwitchControl; checked={group.enabled}; facility-status-header; facility-card-title-row;
 * facility-card-title-block; 异常：资金不足; 异常：仓库已满; 异常：原料不足;
 * 运行中 <strong>{formatNumber(group.participatingCount)}</strong>;
 * 下一周期加入 <strong>{formatNumber(group.pendingJoinCount)}</strong>;
 * 冻结中 <strong>{formatNumber(group.frozenCount ?? group.listedCount)}</strong>;
 * FacilityProductionFormula; facility-recipe-section; 生产配方; <strong>生产配方</strong>;
 * 下一周期切换为：; 前往市场交易该工厂; 前往市场交易该工厂 →;
 * formatNumber(group.count). The legacy branch `if (!entry.constructionOnly)` was removed because
 * construction tasks no longer create selector/detail entries.
 */

export function ProductionPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    selectedFacilityTypeId,
    setSelectedFacilityTypeId,
    buildFacility,
    accelerateFacilityConstruction,
    startFacility,
    stopFacility,
    setFacilityRecipe,
    selectMarketAsset,
    showResult,
  } = model;

  const now = useNow(game.lastProcessedAt);
  const [selectedFacilityGroupId, setSelectedFacilityGroupId] = useState('');
  const [isFacilityDetailOpen, setFacilityDetailOpen] = useState(false);
  const [acceleratingConstruction, setAcceleratingConstruction] = useState(false);
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
  const hasConstruction = Boolean(game.facilityConstruction);
  const selectedRecipes = selectedType ? recipesForType(selectedType) : [];

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

  const constructionType = game.facilityConstruction
    ? game.facilityTypes.find((type) => type.id === game.facilityConstruction?.facilityTypeId)
    : undefined;
  const constructionRemaining = game.facilityConstruction
    ? Math.max(0, game.facilityConstruction.completesAt - now)
    : 0;
  const constructionAwaitingConfirmation = Boolean(game.facilityConstruction && constructionRemaining === 0);
  const constructionAccelerationMs = game.facilityConstruction?.gemAccelerationMs ?? 30 * 60 * 1000;
  const constructionAccelerationCost = game.facilityConstruction?.gemAccelerationCost ?? 1;
  const constructionRemainingAfterAcceleration = Math.max(0, constructionRemaining - constructionAccelerationMs);

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
  const accelerateSelectedConstruction = async () => {
    if (!game.facilityConstruction || acceleratingConstruction) return;
    setAcceleratingConstruction(true);
    try {
      await showResult(accelerateFacilityConstruction());
    } finally {
      setAcceleratingConstruction(false);
    }
  };

  return (
    <PageLayout
      title="生产"
      description="同类未冻结工厂共享生产周期和服务器正式配方；公式展示本周期或恢复后的集群输入、输出与成本。"
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
                ? `可选配方：${selectedRecipes.map((recipe) => recipe.name).join('／')}`
                : `固定配方：${selectedRecipes[0]?.name ?? selectedType.name}`}
            </p>
          </div>
          <DataList>
            <DataRow
              label="建造费用"
              value={<CurrencyAmount>{formatCurrency(selectedType.buildCost)}</CurrencyAmount>}
              tone="danger"
            />
            <DataRow label="施工时间" value={formatDuration(selectedType.buildTimeMs)} tone="warning" />
          </DataList>
          {game.facilityConstruction ? (
            <div className="construction-status" aria-live="polite">
              <strong>
                {constructionType?.name ?? '工厂'}
                {constructionAwaitingConfirmation ? '确认完工中' : '施工中'}
              </strong>
              <span>
                {constructionAwaitingConfirmation
                  ? '正在同步服务器结算结果'
                  : `剩余 ${formatDuration(constructionRemaining)}`}
              </span>
              <div className="build-card-gem-acceleration">
                <strong>宝石加速</strong>
                <span>
                  {constructionAwaitingConfirmation
                    ? '等待服务器确认完工'
                    : constructionRemainingAfterAcceleration > 0
                      ? `使用后剩余 ${formatDuration(constructionRemainingAfterAcceleration)}`
                      : '使用后立即完工'}
                </span>
                <Button
                  block
                  disabled={
                    constructionAwaitingConfirmation ||
                    game.gems < constructionAccelerationCost ||
                    acceleratingConstruction
                  }
                  onClick={() => void accelerateSelectedConstruction()}
                >
                  {acceleratingConstruction
                    ? '加速处理中…'
                    : `${formatNumber(constructionAccelerationCost)} 宝石 · 加速 ${formatDuration(constructionAccelerationMs)}`}
                </Button>
                <small>每次固定减少 30m；剩余不足 30m 时直接完工，不退还部分宝石。</small>
              </div>
              <small>建成后不会重置当前集群进度，将在下一生产周期加入。</small>
            </div>
          ) : null}
          <Button
            block
            onClick={() => void showResult(buildFacility(selectedType.id))}
            disabled={hasConstruction || game.credits < selectedType.buildCost}
          >
            {constructionAwaitingConfirmation
              ? '确认完工中…'
              : hasConstruction
                ? '已有工厂正在施工'
                : `建设${selectedType.name}`}
          </Button>
          <small className="ui-helper-text">工厂按类型和数量保存；同一时间只能施工一座工厂。</small>
        </PagePanel>

        <PagePanel className="production-surface facility-cluster-navigation">
          <div className="facility-cluster-navigation-heading">
            <div>
              <h2 id="facility-cluster-navigation-title">工厂集群</h2>
              <p>按服务器正式目录顺序选择工厂并查看生产详情。</p>
            </div>
            <StatusTag tone="neutral">{formatNumber(orderedFacilityGroups.length)} 类</StatusTag>
          </div>

          <div className="facility-cluster-selector-list">
            {orderedFacilityGroups.map((entry) => (
              <FacilityClusterSelectorCard
                key={entry.group.facilityTypeId}
                entry={entry}
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
