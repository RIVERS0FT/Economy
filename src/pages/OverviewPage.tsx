import { useMemo } from 'react';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { CompactNumber } from '../components/ui/CompactNumber';
import { GemIcon } from '../components/icons/GemIcon';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import {
  Button,
  DataList,
  DataRow,
  PageLayout,
  Panel,
  WidgetHeading,
} from '../components/ui/layout';
import { formatCurrency } from '../utils/formatters';

type OverviewPageProps = { model: TutorialAwareGameViewModel };

export function OverviewPage({ model }: OverviewPageProps) {
  const {
    game,
    derived,
    isCheckingIn,
    checkIn,
    showResult,
    setTab,
  } = model;
  const totalFacilities = game.facilityGroups.reduce((sum, group) => sum + group.count, 0);

  const theoreticalDailyOutput = useMemo(() => game.facilityGroups.reduce((sum, group) => {
    if (group.status !== 'running' || group.participatingCount <= 0) return sum;
    const facilityType = game.facilityTypes.find((item) => item.id === group.facilityTypeId);
    const recipe = facilityType?.recipes.find((item) => item.id === group.activeRecipeId)
      ?? facilityType?.recipes[0];
    if (!recipe || recipe.cycleMs <= 0) return sum;
    return sum + Math.floor((86_400_000 / recipe.cycleMs) * recipe.output.quantity * group.participatingCount);
  }, 0), [game.facilityGroups, game.facilityTypes]);

  const claimedCheckInDates = new Set(game.checkIn.claimedDateKeys);
  const claimCompletesWeek = game.checkIn.weeklyBonusEligible
    && !game.checkIn.weeklyBonusEarned
    && game.checkIn.weeklyClaimCount === 6;

  return (
    <PageLayout
      title="概览"
      description="经营提醒统一进入通知待处理；在此领取每日签到并查看核心经营状态。"
    >
      <div className="overview-dashboard-shell">
        <div className="home-grid">
          <Panel className="widget overview-check-in-panel">
            <WidgetHeading
              title="本周签到"
              action={(
                <Button
                  disabled={isCheckingIn || game.checkIn.claimedToday}
                  onClick={() => void showResult(checkIn())}
                >
                  {isCheckingIn
                    ? '处理中…'
                    : game.checkIn.claimedToday
                      ? '今日已签到'
                      : claimCompletesWeek
                        ? '签到领取 1 + 5 宝石'
                        : '签到领取 1 宝石'}
                </Button>
              )}
            />
            <div className="overview-check-in-rewards">
              <div>
                <span>每日签到</span>
                <strong><GemIcon /> +{<CompactNumber value={game.checkIn.dailyRewardGems} />} 宝石</strong>
              </div>
              <div>
                <span>本周全勤</span>
                <strong><GemIcon /> +{<CompactNumber value={game.checkIn.weeklyBonusGems} />} 宝石</strong>
              </div>
            </div>
            <div className="overview-check-in-calendar" role="list" aria-label="本周签到日历">
              {game.checkIn.dateKeys.map((dateKey, index) => {
                const claimed = claimedCheckInDates.has(dateKey);
                const isToday = dateKey === game.checkIn.todayKey;
                const missed = dateKey < game.checkIn.todayKey && !claimed;
                const future = dateKey > game.checkIn.todayKey;
                const status = claimed ? '已签' : isToday ? '今日' : missed ? '漏签' : '未到';
                const weekday = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][index];
                return (
                  <div
                    className={`overview-check-in-day${claimed ? ' is-claimed' : ''}${isToday ? ' is-today' : ''}${missed ? ' is-missed' : ''}${future ? ' is-future' : ''}`}
                    key={dateKey}
                    role="listitem"
                    aria-label={`${weekday} ${dateKey.slice(5)} ${status}`}
                  >
                    <span>{weekday}</span>
                    <strong>{dateKey.slice(5)}</strong>
                    <small>{status}</small>
                  </div>
                );
              })}
            </div>
            {game.checkIn.weeklyBonusEarned || !game.checkIn.weeklyBonusEligible ? (
              <strong className="overview-check-in-status">
                {game.checkIn.weeklyBonusEarned
                  ? '本周全勤奖励已领取'
                  : '注册所在周可领取每日奖励，下周起参与全勤'}
              </strong>
            ) : null}
          </Panel>

          <div className="overview-summary-row">
            <Panel className="widget production-summary overview-summary-card">
              <WidgetHeading title="生产摘要" action={<Button variant="text" onClick={() => setTab('buildings')}>管理建筑</Button>} />
              <DataList className="compact overview-core-data">
                <DataRow label="工厂总数" value={<CompactNumber value={totalFacilities} />} tone="info" />
                <DataRow label="正在运行" value={<CompactNumber value={derived.runningFacilities} />} tone="success" />
                <DataRow label="生产受阻" value={<CompactNumber value={derived.blockedFacilities} />} tone={derived.blockedFacilities ? 'danger' : 'neutral'} />
                <DataRow label="主动停工" value={<CompactNumber value={derived.stoppedFacilities} />} tone={derived.stoppedFacilities ? 'warning' : 'neutral'} />
                <DataRow label="理论日产量" value={<CompactNumber value={theoreticalDailyOutput} />} tone="info" />
              </DataList>
              <div className="overview-production-footnote">
                <span>施工 {<CompactNumber value={derived.constructingFacilities} />}</span>
                <span>新增工厂直接加入运行</span>
                <span>生产配置立即生效</span>
              </div>
            </Panel>

            <Panel className="widget overview-summary-card overview-assets-card">
              <WidgetHeading title="资产与银行" action={<Button variant="text" onClick={() => setTab('bank')}>查看详情</Button>} />
              <DataList className="compact overview-core-data">
                <DataRow label="现金资产" value={<CurrencyAmount>{formatCurrency(derived.cashValue)}</CurrencyAmount>} />
                <DataRow label="商品估值" value={<CurrencyAmount>{formatCurrency(derived.commodityValue)}</CurrencyAmount>} />
                <DataRow label="工厂估值" value={<CurrencyAmount>{formatCurrency(derived.facilityValue)}</CurrencyAmount>} />
                <DataRow label="商业建筑估值" value={<CurrencyAmount>{formatCurrency(game.assetSummary.commercialValue ?? 0)}</CurrencyAmount>} />
                <DataRow label="冻结资金" value={<CurrencyAmount>{formatCurrency(game.frozenCredits)}</CurrencyAmount>} tone={game.frozenCredits > 0 ? 'warning' : 'neutral'} />
              </DataList>
              <div className="overview-subsection-heading">
                <strong>资产状态</strong>
                <span>服务器权威结果</span>
              </div>
              <DataList className="compact overview-core-data overview-asset-status">
                <DataRow label="可支配资产" value={<CurrencyAmount>{formatCurrency(game.assetSummary.availableAssetValue ?? (derived.totalAssets - (game.assetSummary.frozenAssetValue ?? 0)))}</CurrencyAmount>} />
                <DataRow label="冻结资产" value={<CurrencyAmount>{formatCurrency(game.assetSummary.frozenAssetValue ?? 0)}</CurrencyAmount>} tone={(game.assetSummary.frozenAssetValue ?? 0) > 0 ? 'warning' : 'neutral'} />
                <DataRow label="贷款负债" value={<CurrencyAmount>{formatCurrency(game.assetSummary.liabilityValue ?? 0)}</CurrencyAmount>} tone={(game.assetSummary.liabilityValue ?? 0) > 0 ? 'warning' : 'neutral'} />
              </DataList>
            </Panel>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
