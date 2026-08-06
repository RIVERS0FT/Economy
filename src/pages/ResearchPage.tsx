import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { FacilityIcon } from '../components/icons/FacilityIcons';
import { MobileDetailSummary } from '../components/ui/MobileDetailSummary';
import { MobileWorkspaceDetailSheet } from '../components/ui/MobileWorkspaceDetailSheet';
import {
  Button,
  DataList,
  DataRow,
  PageLayout,
  PagePanel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { useNow } from '../hooks/useNow';
import { formatDuration, formatNumber } from '../utils/formatters';
import type {
  FacilityComplexity,
  FacilityTypeDefinition,
  ResearchTechnologyDefinition,
} from '../types';

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
  const remainingAfterAcceleration = Math.max(0, remaining - accelerationMs);
  const progress = progressForResearchTechnology(technology, active, now, isMastered);
  const shortfall = Math.max(0, technology.cost - model.game.credits);
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
    remainingAfterAcceleration,
    progress,
    shortfall,
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
  isAccelerating,
  onAccelerate,
}: ResearchDetailProps) {
  const presentation = resolveResearchDetailPresentation({
    model,
    technology,
    technologiesById,
    completed,
    now,
  });
  const {
    active,
    status,
    isSelectedActive,
    isMastered,
    hasOtherResearch,
    missing,
    remaining,
    awaitingConfirmation,
    accelerationMs,
    accelerationCost,
    remainingAfterAcceleration,
    progress,
    shortfall,
    fundsMet,
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
        artwork={facilities[0] ? <FacilityIcon facilityTypeId={facilities[0].id} /> : <span>{technology.stage}</span>}
        title={<h3>{technology.name}</h3>}
        meta={
          <>
            <span className="research-detail-summary-status">
              <StatusTag tone={statusTones[status]}>{statusLabels[status]}</StatusTag>
            </span>
            <span className="research-detail-summary-metric">
              {technology.durationMs > 0 ? formatDuration(technology.durationMs) : '初始掌握'}
            </span>
          </>
        }
        description={<p>{technology.description}</p>}
      />

      <section
        className="research-requirements mobile-detail-section"
        aria-labelledby={`research-requirements-${technology.id}`}
      >
        <strong id={`research-requirements-${technology.id}`}>具体要求</strong>
        <ul>
          <li data-met={isMastered || missing.length === 0}>
            <span aria-hidden="true">{isMastered || missing.length === 0 ? '✓' : '×'}</span>
            <div>
              <strong>前置科技</strong>
              <small>
                {isMastered
                  ? '前置科技已经完成'
                  : missing.length > 0
                    ? `还需完成 ${missing.map((item) => `「${item.name}」`).join('、')}`
                    : technology.initial ? '新玩家初始掌握' : '全部前置科技已经完成'}
              </small>
            </div>
          </li>
          <li data-met={isMastered || fundsMet}>
            <span aria-hidden="true">{isMastered || fundsMet ? '✓' : '×'}</span>
            <div>
              <strong>研发费用</strong>
              <small>
                {technology.cost === 0
                  ? '初始掌握，无需费用'
                  : `需要 ${formatNumber(technology.cost)}，当前 ${formatNumber(model.game.credits)}${
                    shortfall > 0 ? `，还差 ${formatNumber(shortfall)}` : ''
                  }`}
              </small>
            </div>
          </li>
          <li data-met={isMastered || !hasOtherResearch}>
            <span aria-hidden="true">{isMastered || !hasOtherResearch ? '✓' : '×'}</span>
            <div>
              <strong>研发队列</strong>
              <small>{hasOtherResearch ? `当前由「${active?.technologyName ?? active?.targetComplexity}」占用` : '当前可以安排研发'}</small>
            </div>
          </li>
          <li data-met="true">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>产业阶段</strong>
              <small>{technology.stage} · 基础时间 {technology.durationMs > 0 ? formatDuration(technology.durationMs) : '立即掌握'}</small>
            </div>
          </li>
        </ul>
      </section>

      <section
        className="research-unlocks mobile-detail-section"
        aria-labelledby={`research-unlocks-${technology.id}`}
      >
        <strong id={`research-unlocks-${technology.id}`}>解锁工厂</strong>
        {facilities.length > 0 ? (
          <div className="research-unlock-list">
            {facilities.map((facility) => (
              <div className="research-unlock-item" key={facility.id}>
                <span className="research-unlock-artwork" aria-hidden="true">
                  <FacilityIcon facilityTypeId={facility.id} />
                </span>
                <span>{facility.name}</span>
              </div>
            ))}
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
          <DataList>
            <DataRow
              label="就业资金已释放"
              value={`${formatNumber(active.employmentReleased)} / ${formatNumber(active.cost)}`}
              tone="info"
            />
          </DataList>
          <div className="research-gem-acceleration">
            <div>
              <strong>宝石加速</strong>
              <span>{formatNumber(accelerationCost)} 宝石固定减少 {formatDuration(accelerationMs)}</span>
            </div>
            <p>
              {awaitingConfirmation
                ? '等待服务器确认研发完成'
                : remainingAfterAcceleration > 0
                  ? `使用后剩余 ${formatDuration(remainingAfterAcceleration)}`
                  : '使用后立即完成；不足 30m 的部分不退还宝石'}
            </p>
            <Button
              block
              disabled={awaitingConfirmation || model.game.gems < accelerationCost || isAccelerating}
              onClick={onAccelerate}
            >
              {isAccelerating
                ? '加速处理中…'
                : model.game.gems < accelerationCost
                  ? '宝石不足'
                  : `${formatNumber(accelerationCost)} 宝石 · 加速 ${formatDuration(accelerationMs)}`}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ResearchDetailActions(props: ResearchDetailProps) {
  const { canStart, fundsMet, actionLabel } = resolveResearchDetailPresentation(props);
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
      viewportAriaLabel={`${detailProps.technology.name}研发要求`}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
      footer={<ResearchDetailActions {...detailProps} />}
    >
      <ResearchDetailBody {...detailProps} />
    </MobileWorkspaceDetailSheet>
  );
}

export function ResearchPage({ model }: { model: TutorialAwareGameViewModel }) {
  const now = useNow(model.game.lastProcessedAt);
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
  const initialTechnologyId = activeTechnology?.id
    ?? firstAvailable?.id
    ?? technologies[technologies.length - 1]?.id
    ?? '';
  const [selectedTechnologyId, setSelectedTechnologyId] = useState(initialTechnologyId);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [isAccelerating, setAccelerating] = useState(false);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedTechnology = technologiesById.get(selectedTechnologyId)
    ?? (activeTechnology?.id === selectedTechnologyId ? activeTechnology : null)
    ?? firstAvailable
    ?? technologies[0];
  const selectedFacilities = selectedTechnology
    ? selectedTechnology.unlockFacilityTypeIds
      .map((facilityTypeId) => facilitiesById.get(facilityTypeId))
      .filter((facility): facility is FacilityTypeDefinition => Boolean(facility))
    : [];

  useEffect(() => {
    const defaultTechnologyId = activeTechnology?.id
      ?? technologies.find((technology) => (
        !technology.initial
        && !completed.has(technology.id)
        && missingPrerequisites(technology, completed, technologiesById).length === 0
      ))?.id
      ?? technologies[technologies.length - 1]?.id
      ?? '';
    setSelectedTechnologyId(defaultTechnologyId);
  }, [activeTechnology?.id, completed, technologies, technologiesById]);

  const selectTechnology = useCallback((technologyId: string, trigger: HTMLButtonElement) => {
    detailTriggerRef.current = trigger;
    setSelectedTechnologyId(technologyId);
    if (isMobileResearchLayout()) setDetailOpen(true);
  }, []);

  const startSelectedResearch = useCallback(() => {
    if (!selectedTechnology || selectedTechnology.legacy) return;
    const confirmed = window.confirm(
      `将支付 ${selectedTechnology.cost} 普通货币并开始研发「${selectedTechnology.name}」，基础时间 ${formatDuration(selectedTechnology.durationMs)}。研发开始后不可取消，是否继续？`,
    );
    if (confirmed) void model.showResult(model.startResearch(selectedTechnology.id));
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
      <PageLayout title="研发" description="服务器尚未返回科技目录。">
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
    <PageLayout
      title="研发"
      description="按产业链选择科技节点；C1–C7 仅表示产业阶段，工厂准入由具体科技决定。"
      actions={
        <>
          <StatusTag tone="success">完整阶段 {research.unlockedComplexity}</StatusTag>
          <StatusTag tone={active ? 'info' : 'neutral'}>
            {active ? `研发「${active.technologyName ?? active.targetComplexity}」` : `已掌握 ${formatNumber(completed.size)} 项`}
          </StatusTag>
        </>
      }
    >
      <div className="research-workspace">
        <PagePanel className="research-action-panel">
          <ResearchDetailContent {...detailProps} />
        </PagePanel>

        <PagePanel className="research-tree-panel">
          <div className="research-tree-heading">
            <div>
              <h2>技术树</h2>
              <p>阶段只用于组织难度；节点前置关系决定可研发路线。</p>
            </div>
            <StatusTag tone="neutral">{formatNumber(technologies.length)} 项科技</StatusTag>
          </div>

          <div className="research-tree-scroll">
            <div className="research-tree" role="tree" aria-label="产业科技树">
              {model.game.researchLevels.map((stage) => {
                const stageTechnologies = technologies.filter((technology) => technology.stage === stage.id);
                const completedCount = stageTechnologies.filter((technology) => completed.has(technology.id)).length;
                return (
                  <div
                    className="research-tree-level"
                    data-stage={stage.id}
                    role="treeitem"
                    aria-expanded="true"
                    key={stage.id}
                  >
                    <div className="research-level-node research-stage-node" aria-label={`${stage.id} 产业阶段`}>
                      <span className="research-level-code">{stage.id}</span>
                    </div>
                    <div className="research-level-caption">
                      <strong>{stage.id} 产业阶段</strong>
                      <span>{completedCount}/{stageTechnologies.length} 已掌握</span>
                    </div>
                    <div className="research-facility-branches" role="group" aria-label={`${stage.id} 科技节点`}>
                      {stageTechnologies.map((technology) => {
                        const status = statusFor(technology, completed, technologiesById, active?.technologyId);
                        const isSelected = selectedTechnology.id === technology.id;
                        const progress = progressForResearchTechnology(
                          technology,
                          active,
                          now,
                          status === 'mastered',
                        );
                        const nodeStyle = {
                          '--research-node-progress': `${Math.round(progress * 360)}deg`,
                        } as CSSProperties;
                        const facility = technology.unlockFacilityTypeIds
                          .map((facilityTypeId) => facilitiesById.get(facilityTypeId))
                          .find(Boolean);
                        return (
                          <button
                            type="button"
                            className="research-facility-node research-technology-node"
                            data-status={status}
                            data-selected={isSelected || undefined}
                            style={nodeStyle}
                            key={technology.id}
                            aria-pressed={isSelected}
                            aria-label={`${technology.name}，${statusLabels[status]}，${technology.stage} 科技`}
                            onClick={(event) => selectTechnology(technology.id, event.currentTarget)}
                          >
                            <span className="research-facility-artwork" aria-hidden="true">
                              {facility ? <FacilityIcon facilityTypeId={facility.id} /> : <span>{technology.stage}</span>}
                            </span>
                            <span>{technology.name}</span>
                            <small>{statusLabels[status]}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PagePanel>
      </div>

      <MobileResearchDetailSheet
        {...detailProps}
        isOpen={isDetailOpen}
        returnFocusRef={detailTriggerRef}
        onClose={() => setDetailOpen(false)}
      />
    </PageLayout>
  );
}
