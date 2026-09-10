import { COMMERCIAL_PROMOTION_CYCLES, commercialStarRating, normalizeCommercialPopularity } from '../../../shared/commercial-popularity.js';
import type { CommercialBuildingGroup, CommercialBuildingTypeDefinition, CommercialServiceLevel } from '../../types/commercial';
import { commercialProfitPerCycle } from '../../utils/commercialPresentation';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { SelectInput } from '../ui/FormControls';
import { Button, DataList, DataRow, WidgetHeading } from '../ui/layout';

function signedChange(value: number | undefined) {
  if (value === undefined) return '尚无结算记录';
  if (value > 0) return `+${value}`;
  return String(value);
}

export function CommercialPopularityPanel({ group, type, pending, onServiceLevelChange, onPromote }: {
  group: CommercialBuildingGroup;
  type: CommercialBuildingTypeDefinition;
  pending: boolean;
  onServiceLevelChange: (serviceLevel: CommercialServiceLevel) => void;
  onPromote: () => void;
}) {
  const popularity = normalizeCommercialPopularity(group.popularity ?? 0);
  const starRating = commercialStarRating(popularity);
  const serviceLevel = group.serviceLevel ?? 'standard';
  const promotionCyclesRemaining = Math.max(0, group.promotionCyclesRemaining ?? 0);
  const promotionCost = type.promotionCostPerBuilding * group.count;
  const nextStarPopularity = starRating < 5 ? starRating * 20 + 1 : null;
  const cycleFootfall = group.pendingFootfall;
  const cycleTargetFootfall = group.pendingTargetFootfall;
  return (
    <section className="mobile-detail-section commercial-popularity" aria-label="人气与客流">
      <WidgetHeading title="人气与客流" />
      <div className="commercial-popularity__rating" aria-label={`人气 ${popularity}，${starRating} 星`}>
        <span className="commercial-popularity__stars" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => <span className={index < starRating ? 'is-earned' : ''} key={index}>{index < starRating ? '★' : '☆'}</span>)}
        </span>
        <strong>{formatNumber(popularity)} / 100</strong>
      </div>
      <DataList>
        <DataRow label="当前星级利润／座／周期"
          value={<CurrencyAmount sign="+">{formatCurrency(commercialProfitPerCycle(type, starRating))}</CurrencyAmount>} />
        <DataRow label="下一星级"
          value={nextStarPopularity === null ? '已达五星' : `人气 ${formatNumber(nextStarPopularity)}`} />
        <DataRow label="本周期预计客流"
          value={cycleFootfall === undefined || cycleTargetFootfall === undefined
            ? '周期开始时锁定'
            : `${formatNumber(cycleFootfall)} / 目标 ${formatNumber(cycleTargetFootfall)}`} />
        <DataRow label="上周期客流"
          value={group.lastFootfall === undefined || group.lastTargetFootfall === undefined
            ? '尚无结算记录'
            : `${formatNumber(group.lastFootfall)} / 目标 ${formatNumber(group.lastTargetFootfall)}`} />
        <DataRow label="上周期人气变化" value={signedChange(group.lastPopularityChange)} />
        <DataRow label="累计有效客流" value={formatNumber(group.lifetimeFootfall ?? 0)} />
      </DataList>
      <div className="commercial-popularity__controls">
        <SelectInput label="服务方案" value={serviceLevel} disabled={pending || group.count < 1}
          description={serviceLevel === 'premium'
            ? `每座等效营业店铺额外支出 ${formatCurrency(type.premiumServiceCostPerCycle)}／周期，增加客流`
            : '无额外服务费，适合自然积累至三星'}
          onChange={(event) => onServiceLevelChange(event.target.value as CommercialServiceLevel)}>
          <option value="standard">标准服务</option>
          <option value="premium">精品服务</option>
        </SelectInput>
        <Button variant="secondary" block disabled={pending || group.count < 1 || promotionCyclesRemaining > 0}
          onClick={onPromote}>
          {promotionCyclesRemaining > 0
            ? `推广进行中 · 剩余 ${promotionCyclesRemaining} 个有效周期`
            : `开展 ${COMMERCIAL_PROMOTION_CYCLES} 周期推广 · ${formatCurrency(promotionCost)}`}
        </Button>
      </div>
      <small className="ui-helper-text">
        有效客流相对当前星级目标决定人气变化；扩张不扣除人气，扩张后的首个完成周期享有降幅保护。推广只覆盖购买时已有店铺，缺货或零接待不会消耗推广周期。
      </small>
    </section>
  );
}
