import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import {
  DataList,
  DataRow,
  EmptyState,
  PageLayout,
  PagePanel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { formatNumber } from '../utils/formatters';

export function ResearchPage({ model }: { model: TutorialAwareGameViewModel }) {
  const ownedGroups = model.game.facilityGroups.filter((group) => group.count > 0);
  const ownedFacilities = ownedGroups.reduce((sum, group) => sum + group.count, 0);
  const runningFacilities = ownedGroups.reduce(
    (sum, group) => sum + (group.status === 'running' ? group.participatingCount : 0),
    0,
  );
  const blockedGroups = ownedGroups.filter((group) => group.status === 'error').length;

  return (
    <PageLayout title="研发" description="查看当前产业基础与未来技术路线；研发玩法尚未开放。">
      <PagePanel className="research-baseline-card">
        <WidgetHeading title="当前产业基础" action={<StatusTag tone="neutral">只读</StatusTag>} />
        <DataList>
          <DataRow label="已拥有工厂" value={formatNumber(ownedFacilities)} />
          <DataRow label="已布局工厂类型" value={formatNumber(ownedGroups.length)} />
          <DataRow label="当前参与生产" value={formatNumber(runningFacilities)} />
          <DataRow
            label="异常工厂集群"
            value={formatNumber(blockedGroups)}
            tone={blockedGroups > 0 ? 'danger' : 'success'}
          />
        </DataList>
      </PagePanel>

      <PagePanel className="research-roadmap-card">
        <WidgetHeading title="技术路线" action={<StatusTag tone="info">规划中</StatusTag>} />
        <p>研发是生产右侧的独立一级入口，后续承载技术路线与产业升级，不与生产配方、作业制度或工厂启停混用。</p>
        <EmptyState>
          <strong>研发功能尚未开放</strong>
          <p>当前版本不扣除资金或宝石，不生成研发进度，也不改变工厂产量、周期、成本、配方或仓库容量。</p>
        </EmptyState>
      </PagePanel>
    </PageLayout>
  );
}
