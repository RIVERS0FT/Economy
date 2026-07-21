import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useNow } from '../hooks/useNow';
import { type LoadedGameViewModel } from '../app/gameViewModel';
import { FacilityProductionFormula } from '../components/facilities/FacilityProductionFormula';
import { FactoryIcon } from '../components/icons/GameIcons';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { SelectInput } from '../components/ui/FormControls';
import { ScrollArea } from '../components/ui/ScrollArea';
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

interface FacilityClusterDetailSharedProps {
  entry: FacilityClusterEntry;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  now: number;
  onToggle: (enabled: boolean) => void;
  onRecipeChange: (recipeId: string) => void;
  onOpenMarket: () => void;
}

interface FacilityDetailRecipeState {
  recipes: FacilityRecipeDefinition[];
  activeRecipe: FacilityRecipeDefinition;
  pendingRecipe: FacilityRecipeDefinition | undefined;
  formulaType: FacilityTypeDefinition;
  nextFormulaType: FacilityTypeDefinition;
  showNextCyclePreview: boolean;
  selectedRecipeId: string;
}

interface FacilitySheetDragSession {
  pointerId?: number;
  startX: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  offset: number;
  source: 'header' | 'content';
  active: boolean;
}

const FACILITY_SHEET_AXIS_THRESHOLD = 8;
const FACILITY_SHEET_AXIS_DOMINANCE = 1.2;
const FACILITY_SHEET_MIN_FLING_DISTANCE = 40;
const FACILITY_SHEET_CLOSE_VELOCITY = 0.75;
const FACILITY_SHEET_SETTLE_DURATION = 200;

function facilityTone(status: string): StatusTone {
  if (status === 'running') return 'success';
  if (status === 'error') return 'danger';
  return 'neutral';
}

function facilityStatusLabel(group: FacilityGroup) {
  if (group.status === 'running') return '运行中';
  if (group.status === 'stopped') return '已停止';
  switch (group.statusReason) {
    case 'warehouse_full':
      return '异常：仓库已满';
    case 'insufficient_funds':
      return '异常：资金不足';
    case 'insufficient_input':
      return '异常：原料不足';
    case 'no_available_facility':
      return '异常：无可运行工厂';
    case 'maintenance':
      return '异常：维护中';
    default:
      return '异常：生产条件不足';
  }
}

function recipesForType(type: FacilityTypeDefinition): FacilityRecipeDefinition[] {
  if (Array.isArray(type.recipes) && type.recipes.length > 0) return type.recipes;
  return [
    {
      id: type.defaultRecipeId || `${type.id}-default`,
      name: type.name,
      cycleMs: type.cycleMs,
      operatingCost: type.operatingCost,
      inputs: Array.isArray(type.inputs) ? type.inputs : type.input ? [type.input] : [],
      output: type.output,
    },
  ];
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

function resolveFacilityDetailRecipeState(entry: FacilityClusterEntry): FacilityDetailRecipeState {
  const { group, type } = entry;
  const recipes = recipesForType(type);
  const activeRecipe =
    recipes.find((recipe) => recipe.id === group.activeRecipeId) ??
    recipes.find((recipe) => recipe.id === type.defaultRecipeId) ??
    recipes[0];
  const pendingRecipe = recipes.find((recipe) => recipe.id === group.pendingRecipeId);
  const nextRecipe = pendingRecipe ?? activeRecipe;

  return {
    recipes,
    activeRecipe,
    pendingRecipe,
    formulaType: typeForRecipe(type, activeRecipe),
    nextFormulaType: typeForRecipe(type, nextRecipe),
    showNextCyclePreview: Boolean(pendingRecipe),
    selectedRecipeId: pendingRecipe?.id ?? activeRecipe.id,
  };
}

function isMobileFacilityLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

function isReducedMotionPreferred() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isFacilitySheetInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a, input, select, textarea, [role="scrollbar"], .ui-scrollbar, [data-facility-sheet-no-drag]',
    ),
  );
}

function FacilityClusterSelectorCard({
  entry,
  onSelect,
}: {
  entry: FacilityClusterEntry;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const { group, type } = entry;

  return (
    <button
      type="button"
      className="facility-cluster-selector-card"
      data-status={group.status}
      aria-label={`${type.name}，数量 ${formatNumber(group.count)}，${facilityStatusLabel(group)}`}
      onClick={(event) => onSelect(event.currentTarget)}
    >
      <strong className="facility-cluster-name">{type.name}</strong>
      <FactoryIcon className="facility-cluster-icon" />
      <span className="facility-cluster-count">{formatNumber(group.count)}</span>
    </button>
  );
}

function FacilityClusterDetailHeader({
  entry,
  onToggle,
  titleId,
}: {
  entry: FacilityClusterEntry;
  onToggle: (enabled: boolean) => void;
  titleId: string;
}) {
  const { group, type } = entry;

  return (
    <div className="facility-card-head facility-status-header">
      <div className="facility-card-title-row">
        <div className="facility-card-title-block facility-cluster-selector-heading">
          <h2 id={titleId}>
            {type.name} × {formatNumber(group.count)}
          </h2>
          <StatusTag tone={facilityTone(group.status)}>{facilityStatusLabel(group)}</StatusTag>
        </div>
        <SwitchControl
          checked={group.enabled}
          aria-label={group.enabled ? `停止${type.name}生产` : `开启${type.name}生产`}
          title={group.enabled ? '停止生产' : '开启自动运行'}
          disabled={group.count < 1}
          onChange={(event) => onToggle(event.target.checked)}
        />
      </div>
      <div className="facility-count-summary" aria-label={`${type.name}运行数量`}>
        <span>
          运行中 <strong>{formatNumber(group.participatingCount)}</strong>
        </span>
        <span>
          下一周期加入 <strong>{formatNumber(group.pendingJoinCount)}</strong>
        </span>
        <span>
          冻结中 <strong>{formatNumber(group.frozenCount ?? group.listedCount)}</strong>
        </span>
      </div>
    </div>
  );
}

function FacilityClusterDetailBody({
  entry,
  products,
  inventories,
  now,
  onRecipeChange,
}: Omit<FacilityClusterDetailSharedProps, 'onToggle' | 'onOpenMarket'>) {
  const { group, type } = entry;
  const recipeState = resolveFacilityDetailRecipeState(entry);

  return (
    <>
      <div className="facility-recipe-section">
        <div className="facility-recipe-heading">
          <strong>生产配方</strong>
          {recipeState.pendingRecipe ? (
            <small className="facility-recipe-status" aria-live="polite">
              下一周期切换为：{recipeState.pendingRecipe.name}
            </small>
          ) : null}
        </div>
        <SelectInput
          label={<span className="sr-only">{type.name}生产配方</span>}
          aria-label={`${type.name}生产配方`}
          value={recipeState.selectedRecipeId}
          disabled={group.count < 1 || recipeState.recipes.length === 0}
          onChange={(event) => {
            if (event.target.value !== recipeState.selectedRecipeId) onRecipeChange(event.target.value);
          }}
        >
          {recipeState.recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.name}
            </option>
          ))}
        </SelectInput>
      </div>

      <FacilityProductionFormula
        group={group}
        type={recipeState.formulaType}
        nextType={recipeState.nextFormulaType}
        showNextCyclePreview={recipeState.showNextCyclePreview}
        products={products}
        inventories={inventories}
        now={now}
      />
    </>
  );
}

function FacilityMarketAction({ onOpenMarket }: { onOpenMarket: () => void }) {
  return (
    <div className="facility-market-link-row">
      <Button variant="text" className="facility-market-link" onClick={onOpenMarket}>
        前往市场交易该工厂 →
      </Button>
    </div>
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
}: FacilityClusterDetailSharedProps & {
  titleId: string;
}) {
  return (
    <>
      <FacilityClusterDetailHeader entry={entry} onToggle={onToggle} titleId={titleId} />
      <FacilityClusterDetailBody
        entry={entry}
        products={products}
        inventories={inventories}
        now={now}
        onRecipeChange={onRecipeChange}
      />
      <div className="facility-card-spacer" aria-hidden="true" />
      <FacilityMarketAction onOpenMarket={onOpenMarket} />
    </>
  );
}

function MobileFacilityDetailSheet({
  entry,
  products,
  inventories,
  now,
  isOpen,
  returnFocusRef,
  onClose,
  onToggle,
  onRecipeChange,
  onOpenMarket,
}: Omit<FacilityClusterDetailSharedProps, 'entry'> & {
  entry: FacilityClusterEntry | undefined;
  isOpen: boolean;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<FacilitySheetDragSession | null>(null);
  const dragFrameRef = useRef<number | undefined>(undefined);
  const settleTimerRef = useRef<number | undefined>(undefined);
  const closeCompletionRef = useRef<(() => void) | undefined>(undefined);
  const isClosingRef = useRef(false);
  const pendingOffsetRef = useRef(0);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== undefined) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = undefined;
    }
  }, []);

  const commitDragOffset = useCallback(() => {
    dragFrameRef.current = undefined;
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;
    const height = Math.max(1, sheet.getBoundingClientRect().height);
    const offset = Math.max(0, Math.min(pendingOffsetRef.current, height));
    const backdropProgress = Math.max(0.3, 1 - (offset / height) * 0.7);
    sheet.style.setProperty('--facility-sheet-drag-offset', `${offset}px`);
    backdrop.style.setProperty('--facility-sheet-backdrop-progress', String(backdropProgress));
  }, []);

  const applyDragOffset = useCallback(
    (offset: number) => {
      pendingOffsetRef.current = offset;
      if (dragFrameRef.current === undefined) {
        dragFrameRef.current = window.requestAnimationFrame(commitDragOffset);
      }
    },
    [commitDragOffset],
  );

  const resetDragStyles = useCallback(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;
    sheet.classList.remove('is-dragging', 'is-settling', 'is-closing');
    sheet.style.removeProperty('--facility-sheet-drag-offset');
    backdrop.style.removeProperty('--facility-sheet-backdrop-progress');
    delete sheet.dataset.dragSource;
    pendingOffsetRef.current = 0;
    isClosingRef.current = false;
  }, []);

  const completeClose = useCallback(() => {
    const completion = closeCompletionRef.current;
    closeCompletionRef.current = undefined;
    onClose();
    completion?.();
  }, [onClose]);

  const requestClose = useCallback(
    (completion?: () => void) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      closeCompletionRef.current = completion;
      dragSessionRef.current = null;
      clearSettleTimer();

      const sheet = sheetRef.current;
      const backdrop = backdropRef.current;
      if (!sheet || !backdrop || isReducedMotionPreferred()) {
        completeClose();
        return;
      }

      sheet.classList.remove('is-dragging');
      sheet.classList.add('is-settling', 'is-closing');
      applyDragOffset(sheet.getBoundingClientRect().height);
      backdrop.style.setProperty('--facility-sheet-backdrop-progress', '0');
      settleTimerRef.current = window.setTimeout(completeClose, FACILITY_SHEET_SETTLE_DURATION);
    },
    [applyDragOffset, clearSettleTimer, completeClose],
  );

  const settleDrag = useCallback(
    (close: boolean) => {
      const sheet = sheetRef.current;
      const backdrop = backdropRef.current;
      if (!sheet || !backdrop) {
        if (close) requestClose();
        return;
      }

      if (close) {
        requestClose();
        return;
      }

      clearSettleTimer();
      sheet.classList.remove('is-dragging');
      sheet.classList.add('is-settling');
      if (isReducedMotionPreferred()) {
        resetDragStyles();
        return;
      }
      applyDragOffset(0);
      backdrop.style.setProperty('--facility-sheet-backdrop-progress', '1');
      settleTimerRef.current = window.setTimeout(resetDragStyles, FACILITY_SHEET_SETTLE_DURATION);
    },
    [applyDragOffset, clearSettleTimer, requestClose, resetDragStyles],
  );

  const beginDrag = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null, pointerId?: number) => {
      if (isClosingRef.current || isFacilitySheetInteractiveTarget(target)) return false;
      const targetElement = target instanceof Element ? target : null;
      const source = targetElement?.closest('.facility-detail-sheet-header, .facility-detail-sheet-drag-handle')
        ? 'header'
        : targetElement?.closest('.facility-detail-sheet-scroll')
          ? 'content'
          : null;
      if (!source) return false;
      if (source === 'content' && (scrollViewportRef.current?.scrollTop ?? 0) > 0) return false;

      clearSettleTimer();
      resetDragStyles();
      dragSessionRef.current = {
        pointerId,
        startX: clientX,
        startY: clientY,
        lastY: clientY,
        lastTime: performance.now(),
        velocity: 0,
        offset: 0,
        source,
        active: false,
      };
      return true;
    },
    [clearSettleTimer, resetDragStyles],
  );

  const updateDrag = useCallback(
    (clientX: number, clientY: number, preventDefault: () => void) => {
      const session = dragSessionRef.current;
      const sheet = sheetRef.current;
      if (!session || !sheet) return;
      if (session.source === 'content' && !session.active && (scrollViewportRef.current?.scrollTop ?? 0) > 0) {
        dragSessionRef.current = null;
        return;
      }

      const deltaX = clientX - session.startX;
      const deltaY = clientY - session.startY;
      if (!session.active) {
        if (Math.hypot(deltaX, deltaY) < FACILITY_SHEET_AXIS_THRESHOLD) return;
        if (deltaY <= 0 || deltaY < Math.abs(deltaX) * FACILITY_SHEET_AXIS_DOMINANCE) {
          dragSessionRef.current = null;
          return;
        }
        session.active = true;
        sheet.classList.add('is-dragging');
        sheet.dataset.dragSource = session.source;
      }

      preventDefault();
      const currentTime = performance.now();
      const elapsed = Math.max(1, currentTime - session.lastTime);
      session.velocity = Math.max(0, (clientY - session.lastY) / elapsed);
      session.lastY = clientY;
      session.lastTime = currentTime;
      session.offset = Math.max(0, deltaY);
      applyDragOffset(session.offset);
    },
    [applyDragOffset],
  );

  const finishDrag = useCallback(
    (clientY?: number) => {
      const session = dragSessionRef.current;
      dragSessionRef.current = null;
      if (!session?.active) {
        resetDragStyles();
        return;
      }

      const finalY = clientY ?? session.lastY;
      const releaseElapsed = Math.max(1, performance.now() - session.lastTime);
      const releaseVelocity = Math.max(0, (finalY - session.lastY) / releaseElapsed);
      const velocity = Math.max(session.velocity, releaseVelocity);
      const sheetHeight = Math.max(1, sheetRef.current?.getBoundingClientRect().height ?? 1);
      const closeDistance = Math.max(96, Math.min(sheetHeight * 0.25, 160));
      const shouldClose =
        session.offset >= closeDistance ||
        (session.offset >= FACILITY_SHEET_MIN_FLING_DISTANCE && velocity >= FACILITY_SHEET_CLOSE_VELOCITY);
      settleDrag(shouldClose);
    },
    [resetDragStyles, settleDrag],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch' || !event.isPrimary) return;
      if (!beginDrag(event.clientX, event.clientY, event.target, event.pointerId)) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* Ignore synthetic capture failures. */
      }
    },
    [beginDrag],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      updateDrag(event.clientX, event.clientY, () => event.preventDefault());
    },
    [updateDrag],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* Ignore capture cleanup failures. */
      }
      finishDrag(event.clientY);
    },
    [finishDrag],
  );

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      beginDrag(touch.clientX, touch.clientY, event.target);
    },
    [beginDrag],
  );

  const handleTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 1 || !dragSessionRef.current) return;
      const touch = event.touches[0];
      updateDrag(touch.clientX, touch.clientY, () => event.preventDefault());
    },
    [updateDrag],
  );

  const handleTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const touch = event.changedTouches[0];
      finishDrag(touch?.clientY);
    },
    [finishDrag],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
    const pageScrollArea = pageScroll?.closest<HTMLElement>('.page-scroll-area');
    const previousBodyOverflow = document.body.style.overflow;
    const previousPageOverflow = pageScroll?.style.overflowY ?? '';
    const previousPageScrollbarSuppressed = pageScrollArea?.dataset.modalScrollbarSuppressed;
    document.body.style.overflow = 'hidden';
    if (pageScroll) pageScroll.style.overflowY = 'hidden';
    if (pageScrollArea) pageScrollArea.dataset.modalScrollbarSuppressed = 'true';

    const focusFrame = window.requestAnimationFrame(() => sheetRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        sheetRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (document.activeElement === sheetRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (pageScroll) pageScroll.style.overflowY = previousPageOverflow;
      if (pageScrollArea) {
        if (previousPageScrollbarSuppressed === undefined) delete pageScrollArea.dataset.modalScrollbarSuppressed;
        else pageScrollArea.dataset.modalScrollbarSuppressed = previousPageScrollbarSuppressed;
      }
      requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, [isOpen, requestClose, returnFocusRef]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const mediaQuery = window.matchMedia('(max-width: 720px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) onClose();
    };
    mediaQuery.addEventListener('change', closeOnDesktop);
    return () => mediaQuery.removeEventListener('change', closeOnDesktop);
  }, [isOpen, onClose]);

  useEffect(
    () => () => {
      clearSettleTimer();
      if (dragFrameRef.current !== undefined) window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = undefined;
      dragSessionRef.current = null;
      closeCompletionRef.current = undefined;
      resetDragStyles();
    },
    [clearSettleTimer, resetDragStyles],
  );

  if (!isOpen || !entry) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="facility-detail-sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={sheetRef}
        className="facility-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-facility-detail-title"
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          dragSessionRef.current = null;
          settleDrag(false);
        }}
      >
        <div className="facility-detail-sheet-header">
          <div className="facility-detail-sheet-drag-handle" aria-hidden="true">
            <span className="facility-detail-sheet-handle" />
          </div>
          <FacilityClusterDetailHeader
            entry={entry}
            onToggle={onToggle}
            titleId="mobile-facility-detail-title"
          />
        </div>

        <ScrollArea
          axis="y"
          className="facility-detail-sheet-scroll-area"
          viewportClassName="facility-detail-sheet-scroll"
          viewportRef={scrollViewportRef}
          viewportRole="region"
          viewportAriaLabel={`${entry.type.name}工厂详情内容`}
          viewportTabIndex={0}
          scrollbarVisibility="adaptive"
        >
          <FacilityClusterDetailBody
            entry={entry}
            products={products}
            inventories={inventories}
            now={now}
            onRecipeChange={onRecipeChange}
          />
        </ScrollArea>

        <div className="facility-detail-sheet-footer">
          <FacilityMarketAction onOpenMarket={() => requestClose(onOpenMarket)} />
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

    return game.facilityTypes.flatMap((type) => {
      const group = groupsByTypeId.get(type.id);
      return group && group.count > 0 ? [{ type, group }] : [];
    });
  }, [game.facilityGroups, game.facilityTypes]);
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
      description="同类未冻结工厂共享生产周期和服务器正式配方；公式展示本周期或恢复后的集群输入、输出与成本。"
      actions={
        <>
          <StatusTag tone="success">运行 {formatNumber(model.derived.runningFacilities)}</StatusTag>
          <StatusTag tone="neutral">停止 {formatNumber(model.derived.stoppedFacilities)}</StatusTag>
          <StatusTag tone={model.derived.blockedFacilities > 0 ? 'danger' : 'neutral'}>
            异常 {formatNumber(model.derived.blockedFacilities)}
          </StatusTag>
          {model.derived.constructingFacilities > 0 ? (
            <StatusTag tone="warning">施工 {formatNumber(model.derived.constructingFacilities)}</StatusTag>
          ) : null}
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
