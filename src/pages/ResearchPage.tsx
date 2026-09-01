import { CompactNumber } from '../components/ui/CompactNumber';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { FacilityIcon } from '../components/icons/FacilityIcons';
import { ProductArtwork } from '../components/products/ProductArtwork';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { MobileDetailSummary } from '../components/ui/MobileDetailSummary';
import { MobileWorkspaceDetailSheet } from '../components/ui/MobileWorkspaceDetailSheet';
import {
  Button,
  PageLayout,
  PagePanel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { useNow } from '../hooks/useNow';
import { useStableSelection } from '../hooks/useStableSelection';
import { ResearchTreeViewport } from '../research/ResearchTreeViewport';
import { buildResearchTreeFocus, buildResearchTreeLayout } from '../research/researchTreeLayout';
import { formatCurrency, formatDuration, formatNumber } from '../utils/formatters';
import type {
  FacilityComplexity,
  FacilityTypeDefinition,
  ResearchTechnologyDefinition,
} from '../types';
import { recipesForType } from './production/ProductionFacilityDetail';
import '../styles/facility-build-select.css';

type ResearchNodeStatus = 'mastered' | 'active' | 'available' | 'locked';

const RESEARCH_ACCELERATION_FALLBACK_MS = 30 * 60 * 1000;
const RESEARCH_ACCELERATION_FALLBACK_COST = 1;

function isMobileResearchLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

const statusLabels: Record<ResearchNodeStatus, string> = {
  mastered: '已掌握',
  active: '研发中',
  available: '可研发',
  locked: '尚未开放',
};

const statusTones = {
  mastered: 'success',
  active: 'info',
  available: 'warning',
  locked: 'neutral',
} as const;

function missingPrerequisites(
  technology: ResearchTechnologyDefinition,
  completed: ReadonlySet<string>,
  technologiesById: ReadonlyMap<string, ResearchTechnologyDefinition>,
) {
  return technology.prerequisiteTechnologyIds
    .map((technologyId) => technologiesById.get(technologyId))
    .filter((candidate): candidate is ResearchTechnologyDefinition => Boolean(candidate && !completed.has(candidate.id)));
}

function statusFor(
  technology: ResearchTechnologyDefinition,
  completed: ReadonlySet<string>,
  technologiesById: ReadonlyMap<string, ResearchTechnologyDefinition>,
  activeTechnologyId?: string,
): ResearchNodeStatus {
  if (completed.has(technology.id)) return 'mastered';
  if (technology.id === activeTechnologyId) return 'active';
  return missingPrerequisites(technology, completed, technologiesById).length === 0
    ? 'available'
    : 'locked';
}

function progressForResearchTechnology(
  technology: ResearchTechnologyDefinition,
  active: {
    technologyId?: string;
    completesAt: number;
    durationMs?: number;
  } | null,
  now: number,
  isMastered: boolean,
) {
  if (active?.technologyId !== technology.id) return isMastered ? 1 : 0;
  const duration = Math.max(1, active.durationMs ?? technology.durationMs);
  const remaining = Math.max(0, active.completesAt - now);
  return Math.max(0, Math.min(1, (duration - remaining) / duration));
}

function outputProductIdsForFacility(facility: FacilityTypeDefinition) {
  const seenProductIds = new Set<string>();
  return recipesForType(facility).flatMap((recipe) => {
    const productId = recipe.output.productId;
    if (seenProductIds.has(productId)) return [];
    seenProductIds.add(productId);
    return [productId];
  });
}

function pseudoTechnologyForActive(
  active: TutorialAwareGameViewModel['game']['research']['active'],
): ResearchTechnologyDefinition | null {
  if (!active) return null;
  return {
    id: active.technologyId ?? `legacy-stage-${active.targetComplexity}`,
    name: active.technologyName ?? `${active.targetComplexity} 阶段研发`,
    stage: active.targetComplexity,
    rank: Number(active.targetComplexity.slice(1)),
    cost: active.cost,
    durationMs: active.durationMs ?? Math.max(1, active.completesAt - active.startedAt),
    prerequisiteTechnologyIds: [],
    unlockFacilityTypeIds: [],
    description: '从旧版整级研发迁移而来的阶段项目，完成后授予该阶段剩余科技。',
    legacy: true,
  };
}

interface ResearchDetailProps {
  model: TutorialAwareGameViewModel;
  technology: ResearchTechnologyDefinition;
  facilities: FacilityTypeDefinition[];
  technologiesById: ReadonlyMap<string, ResearchTechnologyDefinition>;
  completed: ReadonlySet<string>;
  now: number;
  isAccelerating: boolean;
  onStart: () => void;
  onAccelerate: () => void;
}

function resolveResearchDetailPresentation({
  model,
  technology,
  technologiesById,
  completed,
  now,
}: Pick<ResearchDetailProps, 'model' | 'technology' | 'technologiesById' | 'completed' | 'now'>) {
  const active = model.game.research.active;
  const status = statusFor(technology, completed, technologiesById, active?.technologyId);
  const isSelectedActive = active?.technologyId === technology.id;
  const isMastered = completed.has(technology.id);
  const missing = missingPrerequisites(technology, completed, technologiesById);
  const hasOtherResearch = Boolean(active && !isSelectedActive);
  const canStart = !technology.initial && !technology.legacy && !active && !isMastered && missing.length === 0;
  const fundsMet = model.game.credits >= technology.cost;
  const remaining = isSelectedActive && active ? Math.max(0, active.completesAt - now) : 0;
  const awaitingConfirmation = isSelectedActive && remaining === 0;
  const accelerationMs = active?.gemAccelerationMs ?? RESEARCH_ACCELERATION_FALLBACK_MS;
  const accelerationCost = active?.gemAccelerationCost ?? RESEARCH_ACCELERATION_FALLBACK_COST;
  const progress = progressForResearchTechnology(technology, active, now, isMastered);
  const actionLabel = isMastered
    ? `已掌握「${technology.name}」`
    : isSelectedActive
      ? awaitingConfirmation ? '确认研发完成中…' : `研发中 · 剩余 ${formatDuration(remaining)}`
      : hasOtherResearch
        ? `正在研发「${active?.technologyName ?? active?.targetComplexity}」`
        : missing.length > 0
          ? `需要先完成「${missing[0].name}」`
          : !fundsMet
            ? '可用资金不足'
            : technology.initial
              ? '新玩家初始掌握'
              : `开始研发「${technology.name}」`;

  return {
    active,
    status,
    isSelectedActive,
    isMastered,
    hasOtherResearch,
    canStart,
    fundsMet,
    missing,
    remaining,
    awaitingConfirmation,
    accelerationMs,
    accelerationCost,
    progress,
    actionLabel,
  };
}

function ResearchDetailBody({
  model,
  technology,
  facilities,
  technologiesById,
  completed,
  now,
}: ResearchDetailProps) {
  const liveNow = useNow(now);
  const presentation = resolveResearchDetailPresentation({
    model,
    technology,
    technologiesById,
    completed,
    now: liveNow,
  });
  const operationMethodEntries = technology.kind === 'operation'
    ? model.game.facilityTypes.flatMap((facility) => (facility.productionMethodGroups ?? []).flatMap((group) => (
        group.methods
          .filter((method) => method.requiredTechnologyIds?.includes(technology.id))
          .map((method) => ({ facility, method }))
      )))
    : [];
  const {
    active,
    status,
    isSelectedActive,
    remaining,
    awaitingConfirmation,
    progress,
  } = presentation;

  return (
    <div className="research-detail-content">
      <WidgetHeading
        title="研发新技术"
        action={<StatusTag tone={statusTones[status]}>{statusLabels[status]}</StatusTag>}
      />

      <MobileDetailSummary
        className="research-detail-summary"
        artworkClassName="research-detail-level-artwork"
        artwork={technology.kind === 'operation' && technology.operationProductIds?.[0]
          ? <ProductArtwork productId={technology.operationProductIds[0]} />
          : facilities[0] ? <FacilityIcon facilityTypeId={facilities[0].id} /> : <span>{technology.stage}</span>}
        title={<h3>{technology.name}</h3>}
        meta={
          <>
            <StatusTag tone="neutral">{technology.kind === 'operation' ? '作业科技' : '生产科技'}</StatusTag>
            <span className="research-detail-summary-status">
              <StatusTag tone={statusTones[status]}>{statusLabels[status]}</StatusTag>
            </span>
          </>
        }
        description={<p>{technology.description}</p>}
      />

      <section
        className="research-investment mobile-detail-section"
        aria-labelledby={`research-investment-${technology.id}`}
      >
        <strong id={`research-investment-${technology.id}`}>研发投入</strong>
        <div className="research-investment-list">
          <div className="research-investment-item">
            <span>研发费用</span>
            <strong>
              {technology.cost === 0
                ? '无需费用'
                : <CurrencyAmount>{formatCurrency(technology.cost)}</CurrencyAmount>}
            </strong>
          </div>
          <div className="research-investment-item">
            <span>研发时间</span>
            <strong>{technology.durationMs > 0 ? formatDuration(technology.durationMs) : '立即掌握'}</strong>
          </div>
        </div>
      </section>

      <section
        className="research-unlocks mobile-detail-section"
        aria-labelledby={`research-unlocks-${technology.id}`}
      >
        <strong id={`research-unlocks-${technology.id}`}>
          {technology.kind === 'operation' ? '解锁作业制度' : '解锁工厂'}
        </strong>
        {technology.kind === 'operation' ? (
          operationMethodEntries.length > 0 ? (
            <div className="research-unlock-list">
              {operationMethodEntries.map(({ facility, method }) => (
                <div className="research-unlock-item" key={`${facility.id}:${method.id}`}>
                  <span className="research-unlock-artwork" aria-hidden="true">
                    <FacilityIcon facilityTypeId={facility.id} />
                  </span>
                  <span className="research-unlock-copy">
                    <strong>{facility.name}</strong>
                    <small>{method.name}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="ui-helper-text">当前工厂目录尚未返回该作业科技对应的制度。</p>
        ) : facilities.length > 0 ? (
          <div className="research-unlock-list">
            {facilities.map((facility) => {
              const outputProductIds = outputProductIdsForFacility(facility);
              return (
                <div className="research-unlock-item" key={facility.id}>
                  <span className="research-unlock-artwork" aria-hidden="true">
                    <FacilityIcon facilityTypeId={facility.id} />
                  </span>
                  <span className="research-unlock-copy">
                    <strong>{facility.name}</strong>
                    <span className="facility-build-output-list" aria-label={`${facility.name}可生产产物`}>
                      {outputProductIds.map((productId) => (
                        <span className="facility-build-output-item" key={productId}>
                          <ProductArtwork productId={productId} />
                          <span>{model.game.products.find((product) => product.id === productId)?.name ?? productId}</span>
                        </span>
                      ))}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : <p className="ui-helper-text">该项目完成后授予阶段剩余科技，不直接对应单座工厂。</p>}
      </section>

      {isSelectedActive && active ? (

        <section className="research-progress-section mobile-detail-section" aria-live="polite">
          <div className="research-progress-heading">
            <strong>研发进度</strong>
            <span>{awaitingConfirmation ? '等待服务器确认' : formatDuration(remaining)}</span>
          </div>
          <div
            className="research-progress-track"
            role="progressbar"
            aria-label={`${technology.name}研发进度`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span style={{ width: `${progress * 100}%` }} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ResearchDetailActions(props: ResearchDetailProps) {
  const liveNow = useNow(props.now);
  const {
    canStart,
    fundsMet,
    actionLabel,
    isSelectedActive,
    awaitingConfirmation,
    accelerationCost,
    accelerationMs,
  } = resolveResearchDetailPresentation({ ...props, now: liveNow });
  if (isSelectedActive) {
    const hasEnoughGems = props.model.game.gems >= accelerationCost;
    return (
      <div className="research-detail-actions">
        <Button
          block
          disabled={awaitingConfirmation || !hasEnoughGems || props.isAccelerating}
          onClick={props.onAccelerate}
        >
          {props.isAccelerating
            ? '研发中 · 加速处理中…'
            : awaitingConfirmation
              ? '研发中 · 确认完成中…'
              : !hasEnoughGems
                ? '研发中 · 宝石不足'
                : <>研发中 · <CompactNumber value={accelerationCost} /> 宝石加速 {formatDuration(accelerationMs)}</>}
        </Button>
      </div>
    );
  }
  return (
    <div className="research-detail-actions">
      <Button block disabled={!canStart || !fundsMet} onClick={props.onStart}>
        {actionLabel}
      </Button>
      <small className="ui-helper-text">同时只能研发一项科技；开始后不可取消或排队。</small>
    </div>
  );
}

function ResearchDetailContent(props: ResearchDetailProps) {
  return (
    <div className="research-detail-layout">
      <ResearchDetailBody {...props} />
      <ResearchDetailActions {...props} />
    </div>
  );
}

interface MobileResearchDetailSheetProps extends ResearchDetailProps {
  isOpen: boolean;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

function MobileResearchDetailSheet({
  isOpen,
  returnFocusRef,
  onClose,
  ...detailProps
}: MobileResearchDetailSheetProps) {
  return (
    <MobileWorkspaceDetailSheet
      isOpen={isOpen}
      ariaLabel={`${detailProps.technology.name}研发新技术`}
      viewportAriaLabel={`${detailProps.technology.name}研发详情`}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
      footer={<ResearchDetailActions {...detailProps} />}
    >
      <ResearchDetailBody {...detailProps} />
    </MobileWorkspaceDetailSheet>
  );
}

export function ResearchPage({ model }: { model: TutorialAwareGameViewModel }) {
  const now = useNow(model.game.lastProcessedAt, 10_000);
  const research = model.game.research;
  const active = research.active;
  const technologies = model.game.researchTechnologies ?? [];
  const technologiesById = useMemo(
    () => new Map(technologies.map((technology) => [technology.id, technology])),
    [technologies],
  );
  const completed = useMemo(
    () => new Set(research.completedTechnologyIds ?? []),
    [research.completedTechnologyIds],
  );
  const facilitiesById = useMemo(
    () => new Map(model.game.facilityTypes.map((facility) => [facility.id, facility])),
    [model.game.facilityTypes],
  );
  const activeTechnology = active
    ? (active.technologyId ? technologiesById.get(active.technologyId) : null) ?? pseudoTechnologyForActive(active)
    : null;
  const firstAvailable = technologies.find((technology) => (
    !technology.initial
    && !completed.has(technology.id)
    && missingPrerequisites(technology, completed, technologiesById).length === 0
  ));
  const fallbackTechnologyId = activeTechnology?.id
    ?? firstAvailable?.id
    ?? technologies[0]?.id
    ?? '';
  const selectableTechnologyIds = useMemo(() => {
    const technologyIds = technologies.map((technology) => technology.id);
    if (activeTechnology && !technologyIds.includes(activeTechnology.id)) {
      technologyIds.push(activeTechnology.id);
    }
    return technologyIds;
  }, [activeTechnology, technologies]);
  const [selectedTechnologyId, setSelectedTechnologyId] = useStableSelection<string>({
    availableIds: selectableTechnologyIds,
    fallbackId: fallbackTechnologyId,
  });
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [isAccelerating, setAccelerating] = useState(false);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedTechnology = technologiesById.get(selectedTechnologyId)
    ?? (activeTechnology?.id === selectedTechnologyId ? activeTechnology : null)
    ?? technologiesById.get(fallbackTechnologyId)
    ?? (activeTechnology?.id === fallbackTechnologyId ? activeTechnology : null)
    ?? technologies[0];
  const researchTreeLayout = useMemo(
    () => buildResearchTreeLayout(technologies),
    [technologies],
  );
  const researchTreeFocus = useMemo(
    () => buildResearchTreeFocus(technologies, selectedTechnology?.id ?? ''),
    [selectedTechnology?.id, technologies],
  );
  const selectedTreeNode = researchTreeLayout.nodes.find((node) => node.id === selectedTechnology?.id);
  const selectedFacilities = selectedTechnology
    ? selectedTechnology.unlockFacilityTypeIds
      .map((facilityTypeId) => facilitiesById.get(facilityTypeId))
      .filter((facility): facility is FacilityTypeDefinition => Boolean(facility))
    : [];


  const selectTechnology = useCallback((technologyId: string, trigger: HTMLButtonElement) => {
    detailTriggerRef.current = trigger;
    setSelectedTechnologyId(technologyId);
    if (isMobileResearchLayout()) setDetailOpen(true);
  }, []);

  const startSelectedResearch = useCallback(() => {
    if (!selectedTechnology || selectedTechnology.legacy) return;
    const technologyId = selectedTechnology.id;
    const technologyName = selectedTechnology.name;
    const technologyCost = selectedTechnology.cost;
    const technologyDurationMs = selectedTechnology.durationMs;
    const confirmed = window.confirm(
      `将支付 ${technologyCost} 普通货币并开始研发「${technologyName}」，基础时间 ${formatDuration(technologyDurationMs)}。研发开始后不可取消，是否继续？`,
    );
    if (confirmed) void model.showResult(model.startResearch(technologyId));
  }, [model, selectedTechnology]);

  const accelerateResearch = useCallback(async () => {
    if (!active || isAccelerating) return;
    setAccelerating(true);
    try {
      await model.showResult(model.accelerateResearch());
    } finally {
      setAccelerating(false);
    }
  }, [active, isAccelerating, model]);

  if (!selectedTechnology) {
    return (
      <PageLayout title="研发" description="服务器尚未返回科技目录。" scrollable={false}>
        <PagePanel className="empty-state">暂无研发科技。</PagePanel>
      </PageLayout>
    );
  }

  const detailProps: ResearchDetailProps = {
    model,
    technology: selectedTechnology,
    facilities: selectedFacilities,
    technologiesById,
    completed,
    now,
    isAccelerating,
    onStart: startSelectedResearch,
    onAccelerate: () => void accelerateResearch(),
  };

  return (
    <>
      <PageLayout
        title="研发"
        description="按产业链选择科技节点；C1–C7 仅表示产业阶段，工厂准入由具体科技决定。"
        scrollable={false}
      >
        <div className="research-workspace">
          <div className="research-tree-panel">
            <PagePanel className="research-action-panel">
              <ResearchDetailContent {...detailProps} />
            </PagePanel>
            <ResearchTreeViewport
              width={researchTreeLayout.width}
              height={researchTreeLayout.height}
              focusPoint={selectedTreeNode ? { x: selectedTreeNode.x, y: selectedTreeNode.y } : undefined}
            >
              <div
                className="research-tree"
                role="tree"
                aria-label="产业科技树"
                data-layout-direction="downward"
              >
                <svg
                  className="research-tree-connections"
                  viewBox={`0 0 ${researchTreeLayout.width} ${researchTreeLayout.height}`}
                  aria-hidden="true"
                >
                  {researchTreeLayout.edges.map((edge) => (
                    <path
                      className="research-tree-edge"
                      data-highlighted={researchTreeFocus.upstreamEdgeKeys.has(edge.key) || undefined}
                      data-related={researchTreeFocus.downstreamEdgeKeys.has(edge.key) || undefined}
                      d={edge.path}
                      key={edge.key}
                    />
                  ))}
                </svg>
                {researchTreeLayout.nodes.map((layoutNode) => {
                  const technology = technologiesById.get(layoutNode.id);
                  if (!technology) return null;
                  const status = statusFor(technology, completed, technologiesById, active?.technologyId);
                  const isSelected = selectedTechnology.id === technology.id;
                  const progress = progressForResearchTechnology(
                    technology,
                    active,
                    now,
                    status === 'mastered',
                  );
                  const facility = technology.unlockFacilityTypeIds
                    .map((facilityTypeId) => facilitiesById.get(facilityTypeId))
                    .find(Boolean);
                  const operationProductId = technology.kind === 'operation' ? technology.operationProductIds?.[0] : undefined;
                  const isAncestor = researchTreeFocus.ancestorIds.has(technology.id);
                  const isDirectChild = researchTreeFocus.directChildIds.has(technology.id);
                  const nodeStyle = {
                    '--research-node-progress': `${Math.round(progress * 360)}deg`,
                    '--research-node-x': `${layoutNode.x}px`,
                    '--research-node-y': `${layoutNode.y}px`,
                  } as CSSProperties;
                  return (
                    <button
                      type="button"
                      className="research-facility-node research-technology-node"
                      data-ui-interactive="surface"
                      data-technology-id={technology.id}
                      data-depth={layoutNode.depth}
                      data-prerequisites={technology.prerequisiteTechnologyIds.join(',')}
                      data-research-node-x={layoutNode.x}
                      data-research-node-y={layoutNode.y}
                      data-status={status}
                      data-selected={isSelected || undefined}
                      data-path={isAncestor ? 'ancestor' : isDirectChild ? 'descendant' : undefined}
                      style={nodeStyle}
                      key={technology.id}
                      aria-pressed={isSelected}
                      aria-label={`${technology.name}，${statusLabels[status]}，${technology.stage} ${technology.kind === 'operation' ? '作业科技' : '生产科技'}`}
                      onClick={(event) => selectTechnology(technology.id, event.currentTarget)}
                    >
                      <span className="research-facility-artwork" aria-hidden="true">
                        {operationProductId
                          ? <ProductArtwork productId={operationProductId} />
                          : facility ? <FacilityIcon facilityTypeId={facility.id} /> : <span>{technology.stage}</span>}
                      </span>
                      <span className="research-technology-node-name">{technology.name}</span>
                    </button>
                  );
                })}
              </div>
            </ResearchTreeViewport>
          </div>
        </div>
      </PageLayout>

      <MobileResearchDetailSheet
        {...detailProps}
        isOpen={isDetailOpen}
        returnFocusRef={detailTriggerRef}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
}
