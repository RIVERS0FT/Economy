import { useMemo } from 'react';
import { usePlayerPageNavigation } from '../components/ui/PageNavigationContext';
import { FACILITY_STATUS_LABELS, type FacilityStatusFilter } from '../navigation/playerPageStack';
import { overviewOperations } from '../utils/overviewOperations';
import { ChevronIcon } from '../components/icons/GameIcons';
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
  const pageNavigation = usePlayerPageNavigation();
  const operations = useMemo(() => overviewOperations(game), [game.facilityGroups, game.provinceFacilityGroups,
    game.commercialBuildingGroups, game.transportRoutes, game.productionContractSummary, game.provinces]);
  const openFacilities = (facilityStatus?: FacilityStatusFilter) => pageNavigation
    ? pageNavigation.pushPage({ type: 'tab', tab: 'buildings', buildingKind: 'industrial', facilityStatus })
    : setTab('buildings');
  const openCommercial = () => pageNavigation
    ? pageNavigation.pushPage({ type: 'tab', tab: 'buildings', buildingKind: 'commercial' })
    : setTab('buildings');

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
              <WidgetHeading title="生产摘要" action={<Button variant="text" onClick={() => openFacilities()}>管理建筑</Button>} />
              <DataList className="compact overview-core-data">
                <DataRow label="工厂总数" value={<Button variant="text" aria-label="查看全部工业建筑" onClick={() => openFacilities()}><CompactNumber value={operations.facilities.total} /><ChevronIcon direction="right" /></Button>} tone="info" />
                {(['running', 'error', 'stopped'] as const).map((status) => (
                  <DataRow key={status} label={FACILITY_STATUS_LABELS[status]}
                    value={<Button variant="text" aria-label={`查看${FACILITY_STATUS_LABELS[status]}的工厂`} onClick={() => openFacilities(status)}><CompactNumber value={operations.facilities[status]} /><ChevronIcon direction="right" /></Button>}
                    tone={status === 'running' ? 'success' : operations.facilities[status] > 0 ? status === 'error' ? 'danger' : 'warning' : 'neutral'} />
                ))}
              </DataList>
              <div className="overview-operation-links" aria-label="其他经营摘要">
                <Button variant="text" onClick={openCommercial}>商业建筑 <CompactNumber value={operations.commercialCount} /><ChevronIcon direction="right" /></Button>
                <Button variant="text" onClick={() => setTab('transport')}>运输路线 <CompactNumber value={operations.routeCount} /><ChevronIcon direction="right" /></Button>
                <Button variant="text" onClick={() => setTab('contracts')}>进行中合同 <CompactNumber value={operations.activeContracts} /><ChevronIcon direction="right" /></Button>
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
