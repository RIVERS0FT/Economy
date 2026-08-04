import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import {
  Button,
  DataList,
  DataRow,
  PageLayout,
  PagePanel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { AdvancedFeatureGuide } from '../components/onboarding/AdvancedFeatureGuide';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { useNow } from '../hooks/useNow';
import { formatDuration, formatNumber } from '../utils/formatters';
import type { FacilityComplexity, ResearchLevelDefinition } from '../types';

function rankOf(level: FacilityComplexity) {
  return Number(level.slice(1));
}

function levelStatus(level: ResearchLevelDefinition, unlockedRank: number, activeTarget?: FacilityComplexity) {
  if (level.rank <= unlockedRank) return { label: '已掌握', tone: 'success' as const };
  if (level.id === activeTarget) return { label: '研发中', tone: 'info' as const };
  if (level.rank === unlockedRank + 1) return { label: '可研发', tone: 'warning' as const };
  return { label: '尚未开放', tone: 'neutral' as const };
}

export function ResearchPage({ model }: { model: TutorialAwareGameViewModel }) {
  const now = useNow(model.game.lastProcessedAt);
  const research = model.game.research;
  const active = research.active;
  const unlockedRank = rankOf(research.unlockedComplexity);
  const ownedGroups = model.game.facilityGroups.filter((group) => group.count > 0);
  const facilitiesByComplexity = new Map<FacilityComplexity, string[]>();
  for (const facility of model.game.facilityTypes) {
    const names = facilitiesByComplexity.get(facility.complexity) ?? [];
    names.push(facility.name);
    facilitiesByComplexity.set(facility.complexity, names);
  }

  const startResearch = (level: ResearchLevelDefinition) => {
    const confirmed = window.confirm(
      `将支付 ${level.cost} 普通货币并开始研发 ${level.id}。研发开始后不可取消，是否继续？`,
    );
    if (confirmed) void model.showResult(model.startResearch(level.id));
  };

  return (
    <PageLayout title="研发" description="顺序研发 C1-C7，解锁更高复杂度的工厂建设、购买和运营资格。">
      <AdvancedFeatureGuide
        game={model.game}
        title="了解基础生产与交易循环"
        description="研发用于解锁更高复杂度工厂，不直接提高现有工厂产量、周期或利润。"
        recommendedAfter="完成首次生产和出售"
      />
      <PagePanel className="research-baseline-card">
        <WidgetHeading
          title="当前研发状态"
          action={<StatusTag tone={active ? 'info' : 'success'}>{active ? `研发 ${active.targetComplexity}` : `已掌握 ${research.unlockedComplexity}`}</StatusTag>}
        />
        <DataList>
          <DataRow label="已拥有工厂" value={formatNumber(ownedGroups.reduce((sum, group) => sum + group.count, 0))} />
          <DataRow label="已布局工厂类型" value={formatNumber(ownedGroups.length)} />
          <DataRow label="最高产业复杂度" value={research.unlockedComplexity} tone="success" />
          <DataRow
            label={active ? '剩余研发时间' : '下一步'}
            value={active
              ? (now >= active.completesAt ? '确认研发完成中…' : formatDuration(active.completesAt - now))
              : unlockedRank >= 7 ? '全部研发完成' : `研发 C${unlockedRank + 1}`}
            tone={active ? 'info' : 'neutral'}
          />
        </DataList>
      </PagePanel>

      {model.game.researchLevels.map((level) => {
        const status = levelStatus(level, unlockedRank, active?.targetComplexity);
        const facilityNames = facilitiesByComplexity.get(level.id) ?? [];
        const canStart = !active && level.rank === unlockedRank + 1;
        return (
          <PagePanel className="research-level-card" key={level.id}>
            <WidgetHeading title={`${level.id} 产业技术`} action={<StatusTag tone={status.tone}>{status.label}</StatusTag>} />
            <p>{facilityNames.length > 0 ? `解锁工厂：${facilityNames.join('、')}` : '当前目录没有该复杂度工厂。'}</p>
            <DataList>
              <DataRow label="研发费用" value={level.cost > 0 ? <CurrencyAmount>{formatNumber(level.cost)}</CurrencyAmount> : '初始掌握'} />
              <DataRow label="研发时间" value={level.durationMs > 0 ? formatDuration(level.durationMs) : '立即'} />
              {active?.targetComplexity === level.id ? (
                <DataRow label="就业资金已释放" value={`${formatNumber(active.employmentReleased)} / ${formatNumber(active.cost)}`} tone="info" />
              ) : null}
            </DataList>
            {canStart ? (
              <Button
                block
                disabled={model.game.credits < level.cost}
                onClick={() => startResearch(level)}
              >
                {model.game.credits < level.cost ? '可用资金不足' : `开始研发 ${level.id}`}
              </Button>
            ) : null}
          </PagePanel>
        );
      })}
    </PageLayout>
  );
}
