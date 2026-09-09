import { useMemo, useState } from 'react';
import { claimPublicProjectReward, contributePublicProject } from '../../api/publicProjects';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { IntegerInput } from '../ui/FormControls';
import { Button, DataList, DataRow, Panel, StatusTag, WidgetHeading } from '../ui/layout';
import { reportActionException } from '../../notifications/operationFeedback';
import { parseIntegerDraft } from '../../utils/integerDraft';
import { formatNumber } from '../../utils/formatters';
import type {
  ExtendedEconomicCalendarState,
  PublicProjectGoalView,
  PublicProjectStatus,
  PublicProjectView,
  RegionalEconomicEventView,
} from '../../public-projects/types';
import '../../styles/regional-events-public-projects.css';

function calendarFor(model: LoadedGameViewModel) {
  return model.game.economicCalendar as unknown as ExtendedEconomicCalendarState | undefined;
}

function statusLabel(status: PublicProjectStatus) {
  if (status === 'active') return '进行中';
  if (status === 'upcoming') return '即将开始';
  if (status === 'completed') return '已完成';
  return '已结束';
}

function statusTone(status: PublicProjectStatus): 'info' | 'success' | 'neutral' | 'warning' {
  if (status === 'active') return 'warning';
  if (status === 'completed') return 'success';
  if (status === 'upcoming') return 'info';
  return 'neutral';
}

function formatShanghaiTime(value: number) {
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function eventStatus(event: RegionalEconomicEventView, now: number) {
  if (now < event.startsAt) return '即将开始';
  if (now < event.endsAt) return '进行中';
  return '已结束';
}

export function RegionalEconomicEventBanner({
  model,
  provinceId = model.selectedProvinceId,
}: {
  model: LoadedGameViewModel;
  provinceId?: string;
}) {
  const calendar = calendarFor(model);
  const now = Number(model.game.lastProcessedAt || Date.now());
  const events = (calendar?.events ?? []).filter((event) => (
    event.scope === 'regional'
    && event.provinceId === provinceId
    && event.endsAt > now - 24 * 60 * 60 * 1000
  ));
  if (events.length === 0) return null;
  const event = events.find((candidate) => candidate.startsAt <= now && candidate.endsAt > now) ?? events[0];
  const productNames = new Map(model.game.products.map((product) => [product.id, product.name]));
  return (
    <Panel className="regional-economic-event-banner" data-regional-event-id={event.id}>
      <div className="regional-economic-event-banner__heading">
        <strong>{event.title}</strong>
        <StatusTag tone={event.startsAt <= now && event.endsAt > now ? 'warning' : 'info'}>{eventStatus(event, now)}</StatusTag>
      </div>
      <p>{event.description}</p>
      <div className="regional-economic-event-banner__meta">
        <span>{event.productIds.map((productId) => productNames.get(productId) ?? productId).join(' · ')}</span>
        <span>{formatShanghaiTime(event.startsAt)}—{formatShanghaiTime(event.endsAt)}</span>
      </div>
    </Panel>
  );
}

function GoalContribution({
  goal,
  project,
  model,
  pending,
  onContribute,
}: {
  goal: PublicProjectGoalView;
  project: PublicProjectView;
  model: LoadedGameViewModel;
  pending: boolean;
  onContribute: (productId: string, quantity: number) => Promise<void>;
}) {
  const product = model.game.products.find((candidate) => candidate.id === goal.productId);
  const inventory = model.game.provinceInventories?.[project.provinceId]?.[goal.productId];
  const available = Math.max(0, Math.floor(Number(inventory?.available || 0)));
  const remaining = Math.max(0, Math.floor(goal.targetQuantity - goal.contributedQuantity));
  const maximum = Math.min(available, remaining);
  const fallback = Math.max(1, Math.min(maximum || 1, 100));
  const [draft, setDraft] = useState(String(fallback));
  const parsed = parseIntegerDraft(draft, { min: 1, max: Math.max(1, maximum) });
  const ratio = goal.targetQuantity > 0
    ? Math.min(100, Math.round(goal.contributedQuantity / goal.targetQuantity * 100))
    : 0;

  return (
    <div className="public-project-goal">
      <div className="public-project-goal__heading">
        <strong>{product?.name ?? goal.productId}</strong>
        <span>{formatNumber(goal.contributedQuantity)} / {formatNumber(goal.targetQuantity)}</span>
      </div>
      <progress aria-label={`${product?.name ?? goal.productId}项目进度`} max={Math.max(1, goal.targetQuantity)} value={Math.min(goal.targetQuantity, goal.contributedQuantity)} />
      <div className="public-project-goal__meta">
        <span>进度 {ratio}%</span>
        <span>本州可用 {formatNumber(available)}</span>
      </div>
      {project.status === 'active' && remaining > 0 ? (
        <div className="public-project-goal__action">
          <IntegerInput
            label="提交数量"
            value={draft}
            fallbackValue={fallback}
            min={1}
            max={Math.max(1, maximum)}
            disabled={pending || maximum < 1}
            onValueChange={setDraft}
          />
          <Button
            disabled={pending || maximum < 1 || parsed === null}
            onClick={() => parsed !== null && void onContribute(goal.productId, parsed)}
          >
            提交
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function PublicProjectPanel({
  model,
  provinceId = model.selectedProvinceId,
}: {
  model: LoadedGameViewModel;
  provinceId?: string;
}) {
  const calendar = calendarFor(model);
  const projects = useMemo(() => (
    (calendar?.publicProjects?.projects ?? []).filter((project) => project.provinceId === provinceId)
  ), [calendar?.publicProjects?.projects, provinceId]);
  const [pendingKey, setPendingKey] = useState('');

  if (projects.length === 0) return null;

  const refreshConfirmedState = (action: string) => {
    void model.refresh({ mode: 'authoritative' }).catch(() => {
      model.notify(`${action}已完成，但状态同步失败`, 'warning');
    });
  };

  const executeContribution = async (project: PublicProjectView, productId: string, quantity: number) => {
    const key = `${project.id}:${productId}`;
    if (pendingKey) return;
    setPendingKey(key);
    try {
      const result = await contributePublicProject(Number(model.game.saveEpoch || 0), project.id, productId, quantity);
      if (result.code === 'ACTION_RESULT_UNCONFIRMED') {
        await reportActionException(model, null, '公共项目提交');
      } else {
        await model.showResult(result);
        if (result.ok) refreshConfirmedState('公共项目提交');
      }
    } catch (reason) {
      await reportActionException(model, reason, '公共项目提交');
    } finally {
      setPendingKey('');
    }
  };

  const claim = async (project: PublicProjectView) => {
    if (pendingKey) return;
    setPendingKey(`claim:${project.id}`);
    try {
      const result = await claimPublicProjectReward(Number(model.game.saveEpoch || 0), project.id);
      if (result.code === 'ACTION_RESULT_UNCONFIRMED') {
        await reportActionException(model, null, '公共项目奖励');
      } else {
        await model.showResult(result);
        if (result.ok) refreshConfirmedState('公共项目奖励');
      }
    } catch (reason) {
      await reportActionException(model, reason, '公共项目奖励');
    } finally {
      setPendingKey('');
    }
  };

  return (
    <div className="public-projects-stack">
      {projects.map((project) => (
        <Panel className="public-project-card" key={project.id} data-public-project-id={project.id}>
          <WidgetHeading
            title={project.title}
            action={<StatusTag tone={statusTone(project.status)}>{statusLabel(project.status)}</StatusTag>}
          />
          <p className="public-project-card__description">{project.description}</p>
          <DataList>
            <DataRow label="项目州" value={project.provinceName} />
            <DataRow label="项目时间" value={`${formatShanghaiTime(project.startsAt)}—${formatShanghaiTime(project.endsAt)}`} />
            <DataRow label="全服已提交" value={`${formatNumber(project.totalContributedQuantity)} 件`} />
            <DataRow label="我的贡献" value={`${formatNumber(project.myContributedQuantity)} 件`} />
            <DataRow label="项目贡献积分" value={`${formatNumber(project.rewardPointsClaimed)} 已领取${project.rewardPointsClaimable > 0 ? ` · ${formatNumber(project.rewardPointsClaimable)} 可领取` : ''}`} />
          </DataList>
          <div className="public-project-goals">
            {project.goals.map((goal) => (
              <GoalContribution
                key={goal.productId}
                goal={goal}
                project={project}
                model={model}
                pending={Boolean(pendingKey)}
                onContribute={(productId, quantity) => executeContribution(project, productId, quantity)}
              />
            ))}
          </div>
          {project.rewardPointsClaimable > 0 ? (
            <Button block disabled={Boolean(pendingKey)} onClick={() => void claim(project)}>
              领取 {formatNumber(project.rewardPointsClaimable)} 项目贡献积分
            </Button>
          ) : null}
          {project.leaderboard.length > 0 ? (
            <details className="public-project-leaderboard">
              <summary>贡献排行</summary>
              <ol>
                {project.leaderboard.map((entry) => (
                  <li key={`${project.id}:${entry.rank}:${entry.playerName}`} className={entry.isCurrentPlayer ? 'is-current-player' : undefined}>
                    <span>{entry.rank}. {entry.playerName}</span>
                    <strong>{formatNumber(Math.round(entry.contributionValue))}</strong>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}
