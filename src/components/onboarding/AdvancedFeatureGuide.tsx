import type { EconomyState } from '../../types';
import { PagePanel, StatusTag, WidgetHeading } from '../ui/layout';

interface AdvancedFeatureGuideProps {
  game: EconomyState;
  title: string;
  description: string;
  recommendedAfter: string;
}

function completedFoundationLoop(game: EconomyState) {
  const completedProduction = Number(game.stats.producedGoods || 0) > 0
    || game.facilityGroups.some((group) => Number(group.lifetimeOutput || 0) > 0);
  const completedTrade = Number(game.stats.commodityVolume || 0) > 0
    || Number(game.stats.facilityVolume || 0) > 0;
  return completedProduction && completedTrade;
}

export function AdvancedFeatureGuide({
  game,
  title,
  description,
  recommendedAfter,
}: AdvancedFeatureGuideProps) {
  if (completedFoundationLoop(game)) return null;

  return (
    <PagePanel className="advanced-feature-guide" aria-label={`${title}使用建议`}>
      <WidgetHeading
        title={title}
        action={<StatusTag tone="info">进阶功能</StatusTag>}
      />
      <p>{description}</p>
      <small>建议在{recommendedAfter}后重点使用；当前页面仍可正常操作。</small>
    </PagePanel>
  );
}
