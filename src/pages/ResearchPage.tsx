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
  ResearchLevelDefinition,
} from '../types';

type ResearchNodeStatus = 'mastered' | 'active' | 'available' | 'locked';

const RESEARCH_ACCELERATION_FALLBACK_MS = 30 * 60 * 1000;
const RESEARCH_ACCELERATION_FALLBACK_COST = 1;

function rankOf(level: FacilityComplexity) {
  return Number(level.slice(1));
}

function isMobileResearchLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

function statusFor(
  level: ResearchLevelDefinition,
  unlockedRank: number,
  activeTarget?: FacilityComplexity,
): ResearchNodeStatus {
  if (level.rank <= unlockedRank) return 'mastered';
  if (level.id === activeTarget) return 'active';
  if (level.rank === unlockedRank + 1) return 'available';
  return 'locked';
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

function progressForResearchLevel(
  level: ResearchLevelDefinition,
  active: { targetComplexity: FacilityComplexity; completesAt: number } | null,
  now: number,
  isMastered: boolean,
) {
  if (active?.targetComplexity !== level.id) return isMastered ? 1 : 0;
  const duration = Math.max(1, level.durationMs);
  const remaining = Math.max(0, active.completesAt - now);
  return Math.max(0, Math.min(1, (duration - remaining) / duration));
}

interface ResearchDetailProps {
  model: TutorialAwareGameViewModel;
  level: ResearchLevelDefinition;
  facilities: FacilityTypeDefinition[];
  now: number;
  unlockedRank: number;
  isAccelerating: boolean;
  onStart: () => void;
  onAccelerate: () => void;
}

function resolveResearchDetailPresentation({
  model,
  level,
  now,
  unlockedRank,
}: Pick<ResearchDetailProps, 'model' | 'level' | 'now' | 'unlockedRank'>) {
  const active = model.game.research.active;
  const status = statusFor(level, unlockedRank, active?.targetComplexity);
  const isSelectedActive = active?.targetComplexity === level.id;
  const isMastered = level.rank <= unlockedRank;
  const isNext = level.rank === unlockedRank + 1;
  const hasOtherResearch = Boolean(active && !isSelectedActive);
  const canStart = !active && isNext;
  const fundsMet = model.game.credits >= level.cost;
  const prerequisiteLevels = model.game.researchLevels
    .filter((candidate) => candidate.rank > unlockedRank && candidate.rank < level.rank)
    .map((candidate) => candidate.id);
  const remaining = isSelectedActive && active ? Math.max(0, active.completesAt - now) : 0;
  const awaitingConfirmation = isSelectedActive && remaining === 0;
  const accelerationMs = active?.gemAccelerationMs ?? RESEARCH_ACCELERATION_FALLBACK_MS;
  const accelerationCost = active?.gemAccelerationCost ?? RESEARCH_ACCELERATION_FALLBACK_COST;
  const remainingAfterAcceleration = Math.max(0, remaining - accelerationMs);
  const progress = progressForResearchLevel(level, active, now, isMastered);
  const shortfall = Math.max(0, level.cost - model.game.credits);
  const actionLabel = isMastered
    ? `已掌握 ${level.id}`
    : isSelectedActive
      ? awaitingConfirmation ? '确认研发完成中…' : `研发中 · 剩余 ${formatDuration(remaining)}`
      : hasOtherResearch
        ? `正在研发 ${active?.targetComplexity}`
        : !isNext
          ? `需要先完成 C${Math.max(1, level.rank - 1)}`
          : !fundsMet
            ? '可用资金不足'
            : `开始研发 ${level.id}`;

  return {
    active,
    status,
    isSelectedActive,
    isMastered,
    hasOtherResearch,
    canStart,
    fundsMet,
    prerequisiteLevels,
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
  level,
  facilities,
  now,
  unlockedRank,
  isAccelerating,
  onAccelerate,
}: ResearchDetailProps) {
  const presentation = resolveResearchDetailPresentation({ model, level, now, unlockedRank });
  const {
    active,
    status,
    isSelectedActive,
    isMastered,
    hasOtherResearch,
    prerequisiteLevels,
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
        artwork={facilities[0] ? <FacilityIcon facilityTypeId={facilities[0].id} /> : <span>{level.id}</span>}
        title={<h3>{level.id} 产业技术</h3>}
        meta={
          <>
            <span className="research-detail-summary-status">
              <StatusTag tone={statusTones[status]}>{statusLabels[status]}</StatusTag>
            </span>
            <span className="research-detail-summary-metric">
              {level.durationMs > 0 ? formatDuration(level.durationMs) : '立即掌握'}
            </span>
          </>
        }
        description={
          <p>完成后解锁 {formatNumber(facilities.length)} 种工厂及对应建设、购买、竞拍和运营资格。</p>
        }
      />

      <section
        className="research-requirements mobile-detail-section"
        aria-labelledby={`research-requirements-${level.id}`}
      >
        <strong id={`research-requirements-${level.id}`}>具体要求</strong>
        <ul>
          <li data-met={isMastered || level.rank === 1 || level.rank <= unlockedRank + 1}>
            <span aria-hidden="true">{isMastered || level.rank === 1 || level.rank <= unlockedRank + 1 ? '✓' : '×'}</span>
            <div>
              <strong>前置技术</strong>
              <small>
                {isMastered
                  ? '前置技术已经完成'
                  : prerequisiteLevels.length > 0
                    ? `需要依次完成 ${prerequisiteLevels.join('、')}`
                    : level.rank === 1 ? '新玩家初始掌握' : `已满足 ${level.id} 的前置等级`}
              </small>
            </div>
          </li>
          <li data-met={isMastered || fundsMet}>
            <span aria-hidden="true">{isMastered || fundsMet ? '✓' : '×'}</span>
            <div>
              <strong>研发费用</strong>
              <small>
                {level.cost === 0
                  ? '初始掌握，无需费用'
                  : `需要 ${formatNumber(level.cost)}，当前 ${formatNumber(model.game.credits)}${
                      shortfall > 0 ? `，还差 ${formatNumber(shortfall)}` : ''
                    }`}
              </small>
            </div>
          </li>
          <li data-met={isMastered || !hasOtherResearch}>
            <span aria-hidden="true">{isMastered || !hasOtherResearch ? '✓' : '×'}</span>
            <div>
              <strong>研发队列</strong>
              <small>{hasOtherResearch ? `当前由 ${active?.targetComplexity} 占用` : '当前可以安排研发'}</small>
            </div>
          </li>
          <li data-met="true">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>基础时间</strong>
              <small>{level.durationMs > 0 ? formatDuration(level.durationMs) : '立即掌握'}</small>
            </div>
          </li>
        </ul>
      </section>

      <section
        className="research-unlocks mobile-detail-section"
        aria-labelledby={`research-unlocks-${level.id}`}
      >
        <strong id={`research-unlocks-${level.id}`}>解锁工厂</strong>
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
        ) : <p className="ui-helper-text">当前正式目录没有该等级工厂。</p>}
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
            aria-label={`${level.id} 研发进度`}
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

function ResearchDetailActions({
  model,
  level,
  now,
  unlockedRank,
  onStart,
}: ResearchDetailProps) {
  const { canStart, fundsMet, actionLabel } = resolveResearchDetailPresentation({
    model,
    level,
    now,
    unlockedRank,
  });

  return (
    <div className="research-detail-actions">
      <Button
        block
        disabled={!canStart || !fundsMet}
        onClick={onStart}
      >
        {actionLabel}
      </Button>
      <small className="ui-helper-text">研发只能按 C1–C7 顺序进行；开始后不可取消或排队。</small>
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
      ariaLabel={`${detailProps.level.id} 研发新技术`}
      viewportAriaLabel={`${detailProps.level.id} 研发要求`}
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
  const unlockedRank = rankOf(research.unlockedComplexity);
  const facilitiesByComplexity = useMemo(() => {
    const groups = new Map<FacilityComplexity, FacilityTypeDefinition[]>();
    for (const facility of model.game.facilityTypes) {
      const facilities = groups.get(facility.complexity) ?? [];
      facilities.push(facility);
      groups.set(facility.complexity, facilities);
    }
    return groups;
  }, [model.game.facilityTypes]);
  const initialLevelId = active?.targetComplexity
    ?? model.game.researchLevels.find((level) => level.rank === unlockedRank + 1)?.id
    ?? model.game.researchLevels[model.game.researchLevels.length - 1]?.id
    ?? 'C1';
  const [selectedLevelId, setSelectedLevelId] = useState<FacilityComplexity>(initialLevelId);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [isAccelerating, setAccelerating] = useState(false);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedLevel = model.game.researchLevels.find((level) => level.id === selectedLevelId)
    ?? model.game.researchLevels[0];
  const selectedFacilities = selectedLevel
    ? facilitiesByComplexity.get(selectedLevel.id) ?? []
    : [];

  useEffect(() => {
    const defaultLevelId = active?.targetComplexity
      ?? model.game.researchLevels.find((level) => level.rank === unlockedRank + 1)?.id
      ?? model.game.researchLevels[model.game.researchLevels.length - 1]?.id
      ?? 'C1';
    setSelectedLevelId(defaultLevelId);
  }, [active?.targetComplexity, unlockedRank]);

  const selectLevel = useCallback((levelId: FacilityComplexity, trigger: HTMLButtonElement) => {
    detailTriggerRef.current = trigger;
    setSelectedLevelId(levelId);
    if (isMobileResearchLayout()) setDetailOpen(true);
  }, []);

  const startSelectedResearch = useCallback(() => {
    if (!selectedLevel) return;
    const confirmed = window.confirm(
      `将支付 ${selectedLevel.cost} 普通货币并开始研发 ${selectedLevel.id}，基础时间 ${formatDuration(selectedLevel.durationMs)}。研发开始后不可取消，是否继续？`,
    );
    if (confirmed) void model.showResult(model.startResearch(selectedLevel.id));
  }, [model, selectedLevel]);

  const accelerateResearch = useCallback(async () => {
    if (!active || isAccelerating) return;
    setAccelerating(true);
    try {
      await model.showResult(model.accelerateResearch());
    } finally {
      setAccelerating(false);
    }
  }, [active, isAccelerating, model]);

  if (!selectedLevel) {
    return (
      <PageLayout title="研发" description="服务器尚未返回研发目录。">
        <PagePanel className="empty-state">暂无研发等级。</PagePanel>
      </PageLayout>
    );
  }

  const detailProps: ResearchDetailProps = {
    model,
    level: selectedLevel,
    facilities: selectedFacilities,
    now,
    unlockedRank,
    isAccelerating,
    onStart: startSelectedResearch,
    onAccelerate: () => void accelerateResearch(),
  };

  return (
    <PageLayout
      title="研发"
      description="沿 C1–C7 技术主干顺序研发；圆形支线节点展示每级解锁的正式工厂。"
      actions={
        <>
          <StatusTag tone="success">已掌握 {research.unlockedComplexity}</StatusTag>
          <StatusTag tone={active ? 'info' : 'neutral'}>
            {active ? `研发 ${active.targetComplexity}` : '研发队列空闲'}
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
              <p>主干表示强制研发顺序，支线表示完成该等级后解锁的工厂。</p>
            </div>
            <StatusTag tone="neutral">{formatNumber(model.game.researchLevels.length)} 级</StatusTag>
          </div>

          <div className="research-tree-scroll">
            <div className="research-tree" role="tree" aria-label="C1 到 C7 产业技术树">
              {model.game.researchLevels.map((level) => {
                const facilities = facilitiesByComplexity.get(level.id) ?? [];
                const status = statusFor(level, unlockedRank, active?.targetComplexity);
                const isSelected = selectedLevel.id === level.id;
                const progress = progressForResearchLevel(
                  level,
                  active,
                  now,
                  status === 'mastered',
                );
                const nodeStyle = {
                  '--research-node-progress': `${Math.round(progress * 360)}deg`,
                } as CSSProperties;
                return (
                  <div
                    className="research-tree-level"
                    data-status={status}
                    data-selected={isSelected || undefined}
                    role="treeitem"
                    aria-expanded="true"
                    key={level.id}
                  >
                    <button
                      className="research-level-node"
                      type="button"
                      style={nodeStyle}
                      aria-pressed={isSelected}
                      aria-label={`${level.id} 产业技术，${statusLabels[status]}，解锁 ${facilities.length} 种工厂`}
                      onClick={(event) => selectLevel(level.id, event.currentTarget)}
                    >
                      <span className="research-level-artwork" aria-hidden="true">
                        {facilities[0] ? <FacilityIcon facilityTypeId={facilities[0].id} /> : <span>{level.id}</span>}
                      </span>
                      <span className="research-level-code">{level.id}</span>
                    </button>
                    <div className="research-level-caption">
                      <strong>{level.id} 产业技术</strong>
                      <span>{statusLabels[status]}</span>
                    </div>
                    <div className="research-facility-branches" role="group" aria-label={`${level.id} 解锁工厂`}>
                      {facilities.map((facility) => (
                        <button
                          type="button"
                          className="research-facility-node"
                          key={facility.id}
                          aria-label={`${facility.name}，由 ${level.id} 解锁`}
                          onClick={(event) => selectLevel(level.id, event.currentTarget)}
                        >
                          <span className="research-facility-artwork" aria-hidden="true">
                            <FacilityIcon facilityTypeId={facility.id} />
                          </span>
                          <span>{facility.name}</span>
                        </button>
                      ))}
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
