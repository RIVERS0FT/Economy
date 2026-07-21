import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useNow } from '../hooks/useNow';
import {
  type LoadedGameViewModel,
} from '../app/gameViewModel';
import { FacilityProductionFormula } from '../components/facilities/FacilityProductionFormula';
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
  SwitchControl,
  type StatusTone,
  WidgetHeading,
} from '../components/ui/layout';
import type {
  FacilityGroup,
  FacilityRecipeDefinition,
  FacilityTypeDefinition,
  ProductDefinition,
  ProductInventory,
} from '../types';
import { formatCurrency, formatDuration, formatNumber } from '../utils/formatters';

interface FacilityClusterEntry {
  group: FacilityGroup;
  type: FacilityTypeDefinition;
}

function facilityTone(status: string): StatusTone {
  if (status === 'running') return 'success';
  if (status === 'error') return 'danger';
  return 'neutral';
}

function facilityStatusLabel(group: FacilityGroup) {
  if (group.status === 'running') return '运行中';
  if (group.status === 'stopped') return '已停止';
  switch (group.statusReason) {
    case 'warehouse_full': return '异常：仓库已满';
    case 'insufficient_funds': return '异常：资金不足';
    case 'insufficient_input': return '异常：原料不足';
    case 'no_available_facility': return '异常：无可运行工厂';
    case 'maintenance': return '异常：维护中';
    default: return '异常：生产条件不足';
  }
}

function recipesForType(type: FacilityTypeDefinition): FacilityRecipeDefinition[] {
  if (Array.isArray(type.recipes) && type.recipes.length > 0) return type.recipes;
  return [{
    id: type.defaultRecipeId || `${type.id}-default`,
    name: type.name,
    cycleMs: type.cycleMs,
    operatingCost: type.operatingCost,
    inputs: Array.isArray(type.inputs) ? type.inputs : type.input ? [type.input] : [],
    output: type.output,
  }];
}

function typeForRecipe(type: FacilityTypeDefinition, recipe: FacilityRecipeDefinition): FacilityTypeDefinition {
  return {
    ...type,
    cycleMs: recipe.cycleMs,
    operatingCost: recipe.operatingCost,
    inputs: Array.isArray(recipe.inputs) ? recipe.inputs : recipe.input ? [recipe.input] : [],
    input: recipe.input,
    output: recipe.output,
  };
}

function isMobileFacilityLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

function FacilityClusterSelectorCard({
  entry,
  isSelected,
  onSelect,
}: {
  entry: FacilityClusterEntry;
  isSelected: boolean;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const { group, type } = entry;

  return (
    <button
      type="button"
      className={`facility-cluster-selector-card${isSelected ? ' is-selected' : ''}`}
      aria-pressed={isSelected}
      onClick={(event) => onSelect(event.currentTarget)}
    >
      <span className="facility-cluster-selector-heading">
        <strong>{type.name} × {formatNumber(group.count)}</strong>
        <StatusTag tone={facilityTone(group.status)}>{facilityStatusLabel(group)}</StatusTag>
      </span>
      <span className="facility-cluster-selector-summary" aria-label={`${type.name}运行数量`}>
        <span>运行 <strong>{formatNumber(group.participatingCount)}</strong></span>
        <span>待加入 <strong>{formatNumber(group.pendingJoinCount)}</strong></span>
        <span>冻结 <strong>{formatNumber(group.frozenCount ?? group.listedCount)}</strong></span>
      </span>
    </button>
  );
}

function FacilityClusterDetailContent({
  entry,
  products,
  inventories,
  now,
  onToggle,
  onRecipeChange,
  onOpenMarket,
  titleId,
  closeAction,
}: {
  entry: FacilityClusterEntry;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  now: number;
  onToggle: (enabled: boolean) => void;
  onRecipeChange: (recipeId: string) => void;
  onOpenMarket: () => void;
  titleId: string;
  closeAction?: ReactNode;
}) {
  const { group, type } = entry;
  const recipes = recipesForType(type);
  const activeRecipe = recipes.find((recipe) => recipe.id === group.activeRecipeId)
    ?? recipes.find((recipe) => recipe.id === type.defaultRecipeId)
    ?? recipes[0];
  const pendingRecipe = recipes.find((recipe) => recipe.id === group.pendingRecipeId);
  const nextRecipe = pendingRecipe ?? activeRecipe;
  const formulaType = typeForRecipe(type, activeRecipe);
  const nextFormulaType = typeForRecipe(type, nextRecipe);
  const showNextCyclePreview = Boolean(pendingRecipe);

  return (
    <>
      <div className="facility-card-head facility-status-header">
        <div className="facility-card-title-row">
          <h2 id={titleId}>{type.name} × {formatNumber(group.count)}</h2>
          <SwitchControl
            checked={group.enabled}
            aria-label={group.enabled ? `停止${type.name}生产` : `开启${type.name}生产`}
            title={group.enabled ? '停止生产' : '开启自动运行'}
            disabled={group.count < 1}
            onChange={(event) => onToggle(event.target.checked)}
          />
        </div>
        <div className="facility-detail-header-actions">
          <StatusTag tone={facilityTone(group.status)}>{facilityStatusLabel(group)}</StatusTag>
          {closeAction}
        </div>
        <div className="facility-count-summary" aria-label={`${type.name}运行数量`}>
          <span>运行中 <strong>{formatNumber(group.participatingCount)}</strong></span>
          <span>下一周期加入 <strong>{formatNumber(group.pendingJoinCount)}</strong></span>
          <span>冻结中 <strong>{formatNumber(group.frozenCount ?? group.listedCount)}</strong></span>
        </div>
      </div>

      <div className="facility-recipe-section">
        <div className="facility-recipe-heading">
          <strong>生产配方</strong>
          {pendingRecipe ? (
            <small className="facility-recipe-status" aria-live="polite">
              下一周期切换为：{pendingRecipe.name}
            </small>
          ) : null}
        </div>
        <SelectInput
          label={<span className="sr-only">{type.name}生产配方</span>}
          aria-label={`${type.name}生产配方`}
          value={pendingRecipe?.id ?? activeRecipe.id}
          disabled={group.count < 1 || recipes.length === 1}
          onChange={(event) => onRecipeChange(event.target.value)}
        >
          {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
        </SelectInput>
      </div>

      <FacilityProductionFormula
        group={group}
        type={formulaType}
        nextType={nextFormulaType}
        showNextCyclePreview={showNextCyclePreview}
        products={products}
        inventories={inventories}
        now={now}
      />

      <div className="facility-card-spacer" aria-hidden="true" />

      <div className="facility-market-link-row">
        <Button
          variant="text"
          className="facility-market-link"
          onClick={onOpenMarket}
        >
          前往市场交易该工厂 →
        </Button>
      </div>
    </>
  );
}

function MobileFacilityDetailSheet({
  entry,
  products,
  inventories,
  now,
  isOpen,
  sheetRef,
  closeButtonRef,
  onClose,
  onToggle,
  onRecipeChange,
  onOpenMarket,
}: {
  entry: FacilityClusterEntry | undefined;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  now: number;
  isOpen: boolean;
  sheetRef: RefObject<HTMLDivElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
  onRecipeChange: (recipeId: string) => void;
  onOpenMarket: () => void;
}) {
  if (!isOpen || !entry) return null;

  return createPortal(
    <div
      className="facility-detail-sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className="facility-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-facility-detail-title"
      >
        <div className="facility-detail-sheet-handle" aria-hidden="true" />
        <div className="facility-detail-sheet-scroll">
          <FacilityClusterDetailContent
            entry={entry}
            products={products}
            inventories={inventories}
            now={now}
            onToggle={onToggle}
            onRecipeChange={onRecipeChange}
            onOpenMarket={onOpenMarket}
            titleId="mobile-facility-detail-title"
            closeAction={(
              <button
                ref={closeButtonRef}
                type="button"
                className="ui-button ui-button--text facility-detail-sheet-close"
                aria-label="关闭工厂详情"
                onClick={onClose}
              >
                ×
              </button>
            )}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

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
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);

  const selectedType = useMemo(
    () => game.facilityTypes.find((type) => type.id === selectedFacilityTypeId) ?? game.facilityTypes[0],
    [game.facilityTypes, selectedFacilityTypeId],
  );
  const orderedFacilityGroups = useMemo<FacilityClusterEntry[]>(() => {
    const groupsByTypeId = new Map<string, FacilityGroup>(
      game.facilityGroups.map((group) => [group.facilityTypeId, group]),
    );

    return game.facilityTypes.flatMap((type) => {
      const group = groupsByTypeId.get(type.id);
      return group && group.count > 0 ? [{ type, group }] : [];
    });
  }, [game.facilityGroups, game.facilityTypes]);
  const selectedFacilityEntry = orderedFacilityGroups.find(
    ({ type }) => type.id === selectedFacilityGroupId,
  ) ?? orderedFacilityGroups[0];
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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 720px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) setFacilityDetailOpen(false);
    };
    mediaQuery.addEventListener('change', closeOnDesktop);
    return () => mediaQuery.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!isFacilityDetailOpen) return undefined;

    const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
    const previousBodyOverflow = document.body.style.overflow;
    const previousPageOverflow = pageScroll?.style.overflowY ?? '';
    document.body.style.overflow = 'hidden';
    if (pageScroll) pageScroll.style.overflowY = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFacilityDetailOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (pageScroll) pageScroll.style.overflowY = previousPageOverflow;
      requestAnimationFrame(() => detailTriggerRef.current?.focus());
    };
  }, [isFacilityDetailOpen]);

  if (!selectedType) {
    return <PageLayout title="生产" description="服务器尚未返回工厂目录。"><Panel className="empty-state">暂无工厂类型。</Panel></PageLayout>;
  }

  const constructionType = game.facilityConstruction
    ? game.facilityTypes.find((type) => type.id === game.facilityConstruction?.facilityTypeId)
    : undefined;
  const constructionRemaining = game.facilityConstruction
    ? Math.max(0, game.facilityConstruction.completesAt - now)
    : 0;
  const constructionAwaitingConfirmation = Boolean(game.facilityConstruction && constructionRemaining === 0);

  const selectFacilityEntry = (facilityTypeId: string, trigger: HTMLButtonElement) => {
    detailTriggerRef.current = trigger;
    setSelectedFacilityGroupId(facilityTypeId);
    if (isMobileFacilityLayout()) setFacilityDetailOpen(true);
  };

  const closeFacilityDetail = () => setFacilityDetailOpen(false);
  const toggleSelectedFacility = (enabled: boolean) => {
    if (!selectedFacilityEntry) return;
    void showResult(enabled
      ? startFacility(selectedFacilityEntry.group.facilityTypeId)
      : stopFacility(selectedFacilityEntry.group.facilityTypeId));
  };
  const changeSelectedFacilityRecipe = (recipeId: string) => {
    if (!selectedFacilityEntry) return;
    void showResult(setFacilityRecipe(selectedFacilityEntry.group.facilityTypeId, recipeId));
  };
  const openSelectedFacilityMarket = () => {
    if (!selectedFacilityEntry) return;
    closeFacilityDetail();
    selectMarketAsset('facility', selectedFacilityEntry.group.facilityTypeId);
  };

  return (
    <PageLayout
      title="生产"
      description="同类未冻结工厂共享生产周期和服务器正式配方；公式展示本周期或恢复后的集群输入、输出与成本。"
      actions={(
        <>
          <StatusTag tone="success">运行 {formatNumber(model.derived.runningFacilities)}</StatusTag>
          <StatusTag tone="neutral">停止 {formatNumber(model.derived.stoppedFacilities)}</StatusTag>
          <StatusTag tone={model.derived.blockedFacilities > 0 ? 'danger' : 'neutral'}>异常 {formatNumber(model.derived.blockedFacilities)}</StatusTag>
          {model.derived.constructingFacilities > 0 ? <StatusTag tone="warning">施工 {formatNumber(model.derived.constructingFacilities)}</StatusTag> : null}
        </>
      )}
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
            {game.facilityTypes.map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}
          </SelectInput>
          <div className="facility-type-summary">
            <h3>{selectedType.name}</h3>
            <p>{selectedRecipes.length > 1
              ? `可选配方：${selectedRecipes.map((recipe) => recipe.name).join('／')}`
              : `固定配方：${selectedRecipes[0]?.name ?? selectedType.name}`}</p>
          </div>
          <DataList>
            <DataRow label="建造费用" value={<CurrencyAmount>{formatCurrency(selectedType.buildCost)}</CurrencyAmount>} tone="danger" />
            <DataRow label="施工时间" value={formatDuration(selectedType.buildTimeMs)} tone="warning" />
          </DataList>
          {game.facilityConstruction ? (
            <div className="construction-status" aria-live="polite">
              <strong>{constructionType?.name ?? '工厂'}{constructionAwaitingConfirmation ? '确认完工中' : '施工中'}</strong>
              <span>{constructionAwaitingConfirmation ? '正在同步服务器结算结果' : `剩余 ${formatDuration(constructionRemaining)}`}</span>
              <small>建成后不会重置当前集群进度，将在下一生产周期加入。</small>
            </div>
          ) : null}
          <Button block onClick={() => void showResult(buildFacility(selectedType.id))} disabled={hasConstruction || game.credits < selectedType.buildCost}>
            {constructionAwaitingConfirmation ? '确认完工中…' : hasConstruction ? '已有工厂正在施工' : `建设${selectedType.name}`}
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

          {selectedFacilityEntry ? (
            <div className="facility-current-selection-bar">
              <span>
                <small>当前工厂</small>
                <strong>{selectedFacilityEntry.type.name} × {formatNumber(selectedFacilityEntry.group.count)}</strong>
                <em>{facilityStatusLabel(selectedFacilityEntry.group)}</em>
              </span>
              <Button
                variant="secondary"
                onClick={(event) => {
                  detailTriggerRef.current = event.currentTarget;
                  setFacilityDetailOpen(true);
                }}
              >
                查看详情
              </Button>
            </div>
          ) : null}

          <div className="facility-cluster-selector-list">
            {orderedFacilityGroups.map((entry) => (
              <FacilityClusterSelectorCard
                key={entry.group.facilityTypeId}
                entry={entry}
                isSelected={entry.type.id === effectiveSelectedFacilityGroupId}
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
        sheetRef={sheetRef}
        closeButtonRef={closeButtonRef}
        onClose={closeFacilityDetail}
        onToggle={toggleSelectedFacility}
        onRecipeChange={changeSelectedFacilityRecipe}
        onOpenMarket={openSelectedFacilityMarket}
      />
    </PageLayout>
  );
}
