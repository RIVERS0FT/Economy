import { useMemo } from 'react';
import { useNow } from '../hooks/useNow';
import {
  facilityStatusReasonNames,
  orderStatusNames,
} from '../app/gameViewModel';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { FactoryIcon } from '../components/icons/GameIcons';
import { GemIcon } from '../components/icons/GemIcon';
import { ProductIconLabel } from '../components/icons/ProductIcons';
import { GameGuideStrip } from '../components/GameGuideStrip';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import {
  Button,
  DataList,
  DataRow,
  EmptyState,
  PageLayout,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { formatCurrency, formatDuration, formatNumber, formatTime } from '../utils/formatters';
import { orderAssetId, orderKind } from '../utils/orderIdentity';

function greetingForHour(hour: number) {
  if (hour < 5) return '凌晨好';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

type OverviewPageProps = { model: TutorialAwareGameViewModel };

type OverviewAlert = {
  id: string;
  tone: 'danger' | 'warning' | 'info';
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
};

export function OverviewPage({ model }: OverviewPageProps) {
  const {
    game,
    derived,
    isWorking,
    isCheckingIn,
    work,
    checkIn,
    showResult,
    setTab,
  } = model;
  const now = useNow(game.lastProcessedAt);
  const workRemaining = Math.max(0, game.work.cooldownUntil - now);
  const pendingRecipeChanges = game.facilityGroups.filter((group) => Boolean(group.pendingRecipeId)).length;
  const totalFacilities = game.facilityGroups.reduce((sum, group) => sum + group.count, 0);
  const pendingJoin = game.facilityGroups.reduce((sum, group) => sum + group.pendingJoinCount, 0);
  const greeting = greetingForHour(new Date(now).getHours());
  const ownOpenOrders = [...derived.ownOpenOrders].sort((left, right) => right.createdAt - left.createdAt);
  const buyOrderCount = ownOpenOrders.filter((order) => order.side === 'buy').length;
  const sellOrderCount = ownOpenOrders.length - buyOrderCount;
  const economicEvents = game.economicCalendar?.events ?? [];
  const productNames = useMemo(() => new Map(game.products.map((product) => [product.id, product.name])), [game.products]);

  const theoreticalDailyOutput = useMemo(() => game.facilityGroups.reduce((sum, group) => {
    if (group.status !== 'running' || group.participatingCount <= 0) return sum;
    const facilityType = game.facilityTypes.find((item) => item.id === group.facilityTypeId);
    const recipe = facilityType?.recipes.find((item) => item.id === group.activeRecipeId)
      ?? facilityType?.recipes[0];
    if (!recipe || recipe.cycleMs <= 0) return sum;
    return sum + Math.floor((86_400_000 / recipe.cycleMs) * recipe.output.quantity * group.participatingCount);
  }, 0), [game.facilityGroups, game.facilityTypes]);


  const businessAlerts = useMemo(() => {
    const alerts: OverviewAlert[] = [];
    const productionAction = () => setTab('production');

    if (game.warehouseAvailableCapacity <= 0) {
      alerts.push({
        id: 'warehouse-full',
        tone: 'danger',
        title: '共享仓库已满',
        detail: '生产无法继续入库，请扩容、出售库存或取消占用容量的买单。',
        actionLabel: '处理仓库',
        onAction: productionAction,
      });
    } else if (game.warehouseAvailableCapacity <= Math.max(25, Math.ceil(game.inventoryCapacity * 0.1))) {
      alerts.push({
        id: 'warehouse-low',
        tone: 'warning',
        title: '共享仓库空间偏低',
        detail: `当前仅剩 ${formatNumber(game.warehouseAvailableCapacity)} 容量，建议提前处理库存。`,
        actionLabel: '查看仓库',
        onAction: productionAction,
      });
    }

    for (const group of game.facilityGroups.filter((item) => item.status === 'error').slice(0, 2)) {
      const facilityName = game.facilityTypes.find((item) => item.id === group.facilityTypeId)?.name ?? group.facilityTypeId;
      alerts.push({
        id: `facility-error-${group.facilityTypeId}`,
        tone: 'danger',
        title: `${facilityName}生产受阻`,
        detail: facilityStatusReasonNames[group.statusReason ?? 'maintenance'],
        actionLabel: '管理工厂',
        onAction: productionAction,
      });
    }

    if (ownOpenOrders.length > 0) {
      alerts.push({
        id: 'open-orders',
        tone: 'info',
        title: `有 ${formatNumber(ownOpenOrders.length)} 笔挂单等待处理`,
        detail: `买单 ${formatNumber(buyOrderCount)} 笔，卖单 ${formatNumber(sellOrderCount)} 笔。`,
        actionLabel: '管理订单',
        onAction: () => setTab('market'),
      });
    }

    if (derived.stoppedFacilities > 0) {
      alerts.push({
        id: 'stopped-facilities',
        tone: 'warning',
        title: `${formatNumber(derived.stoppedFacilities)} 座工厂处于停止状态`,
        detail: '确认是否需要恢复生产，或继续保留为主动停工。',
        actionLabel: '查看工厂',
        onAction: productionAction,
      });
    }

    if (game.facilityConstruction) {
      const facilityName = game.facilityTypes.find((item) => item.id === game.facilityConstruction?.facilityTypeId)?.name ?? '工厂';
      alerts.push({
        id: 'facility-construction',
        tone: 'info',
        title: `${facilityName}正在施工`,
        detail: `预计 ${formatDuration(Math.max(0, game.facilityConstruction.completesAt - now))} 后完成。`,
        actionLabel: '查看施工',
        onAction: productionAction,
      });
    }

    return alerts;
  }, [buyOrderCount, derived.stoppedFacilities, game, now, ownOpenOrders.length, sellOrderCount, setTab]);

  const visibleAlerts = businessAlerts.slice(0, model.tutorial.isVisible ? 2 : 3);
  const primaryAction = ownOpenOrders.length > 0
    ? { label: '处理订单', onClick: () => setTab('market') }
    : businessAlerts.some((alert) => alert.id !== 'open-orders')
      ? { label: '查看经营提醒', onClick: () => setTab('production') }
      : { label: '进入市场', onClick: () => setTab('market') };

  const claimedCheckInDates = new Set(game.checkIn.claimedDateKeys);
  const claimCompletesWeek = game.checkIn.weeklyBonusEligible
    && !game.checkIn.weeklyBonusEarned
    && game.checkIn.weeklyClaimCount === 6;
  const openOrdersListClassName = ownOpenOrders.length > 3
    ? 'overview-open-orders-list overview-open-orders-list--scrollable'
    : 'overview-open-orders-list';

  return (
    <PageLayout
      title={<>{greeting}，{game.playerName}</>}
      description="优先处理生产、仓库与订单提醒，并领取服务器每日签到奖励。"
      actions={(
        <>
          <StatusTag tone={businessAlerts.length > 0 ? 'warning' : 'success'}>
            {businessAlerts.length > 0 ? `待处理事项 ${formatNumber(businessAlerts.length)}` : '经营状态正常'}
          </StatusTag>
          <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
        </>
      )}
    >
      <div className="home-grid">
        <div className="overview-primary-grid">
          <Panel className="widget overview-today-panel">
            <WidgetHeading
              title="今日经营"
              action={<StatusTag tone="success">工作收益 <CurrencyAmount>{formatCurrency(1)}</CurrencyAmount></StatusTag>}
            />
            <GameGuideStrip tutorial={model.tutorial} />
            <div className="overview-work-strip">
              <div className="overview-work-copy">
                <strong>基础工作</strong>
                <span>固定 3s 冷却，为产业调整提供兜底资金。</span>
              </div>
              <Button
                variant="secondary"
                className="overview-work-button"
                disabled={isWorking || workRemaining > 0}
                onClick={() => void showResult(work())}
              >
                {isWorking ? '处理中…' : workRemaining > 0 ? formatDuration(workRemaining) : '开始工作'}
              </Button>
            </div>

            <div className="overview-alert-heading">
              <div>
                <strong>经营提醒</strong>
                <span>按仓库、生产、订单和停工优先级排列</span>
              </div>
              <StatusTag tone={businessAlerts.length > 0 ? 'warning' : 'success'}>{formatNumber(businessAlerts.length)}</StatusTag>
            </div>
            <div className="overview-alert-list">
              {visibleAlerts.map((alert) => (
                <div className={`overview-alert overview-alert--${alert.tone}`} key={alert.id}>
                  <div>
                    <strong>{alert.title}</strong>
                    <small>{alert.detail}</small>
                  </div>
                  <Button variant="text" onClick={alert.onAction}>{alert.actionLabel} →</Button>
                </div>
              ))}
              {visibleAlerts.length === 0 ? (
                <EmptyState className="overview-alert-empty">当前没有需要立即处理的经营异常。</EmptyState>
              ) : null}
            </div>
          </Panel>

          <Panel className="widget overview-check-in-panel">
  <WidgetHeading
    title="本周签到"
    action={(
      <StatusTag tone={game.checkIn.weeklyBonusEarned ? 'success' : 'info'}>
        {formatNumber(game.checkIn.weeklyClaimCount)} / 7 天
      </StatusTag>
    )}
  />
  <div className="overview-check-in-rewards">
    <div>
      <span>每日签到</span>
      <strong><GemIcon /> +{formatNumber(game.checkIn.dailyRewardGems)} 宝石</strong>
    </div>
    <div>
      <span>本周全勤</span>
      <strong><GemIcon /> +{formatNumber(game.checkIn.weeklyBonusGems)} 宝石</strong>
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
  <div className="overview-check-in-footer">
    <div>
      <strong>{game.checkIn.weeklyBonusEarned
        ? '本周全勤奖励已领取'
        : game.checkIn.weeklyBonusEligible
          ? '连续签到 7 天可额外获得 5 宝石'
          : '注册所在周可领取每日奖励，下周起参与全勤'}</strong>
      <small>签到日期由服务器按北京时间判定，不支持补签。</small>
    </div>
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
  </div>
</Panel>
        </div>


<Panel className="widget overview-economic-calendar-panel">
  <WidgetHeading
    title="公开经济事件日历"
    action={<StatusTag tone="info">未来 7 天</StatusTag>}
  />
  <p className="overview-economic-calendar-note">
    事件只调整既有人口直接需求的类别与商品选择权重；人口总预算、直接／派生预算、市场储备和货币发行均保持不变。
  </p>
  <div className="overview-economic-event-list" role="list" aria-label="未来七天公开经济事件">
    {economicEvents.map((event) => {
      const active = event.startsAt <= now && now < event.endsAt;
      const upcoming = now < event.startsAt;
      const remaining = active ? event.endsAt - now : event.startsAt - now;
      const products = event.productIds.map((id) => productNames.get(id) || id).join('、');
      return (
        <article className={`overview-economic-event${active ? ' is-active' : ''}`} key={event.id} role="listitem">
          <header>
            <StatusTag tone={active ? 'success' : 'info'}>{active ? '生效中' : '即将开始'}</StatusTag>
            <time dateTime={new Date(event.startsAt).toISOString()}>{formatTime(event.startsAt)}</time>
          </header>
          <strong>{event.title}</strong>
          <p>{event.description}</p>
          <small>重点类别：{event.classLabels.join('、')} · 重点商品：{products}</small>
          <span>{active ? '距离结束' : upcoming ? '距离开始' : '等待服务器更新'} {formatDuration(Math.max(0, remaining))}</span>
        </article>
      );
    })}
    {economicEvents.length === 0 ? <EmptyState>未来七天暂无已公布的经济事件。</EmptyState> : null}
  </div>
</Panel>

<div className="overview-summary-row">
          <Panel className="widget production-summary overview-summary-card">
            <WidgetHeading title="生产摘要" action={<Button variant="text" onClick={() => setTab('production')}>管理工厂</Button>} />
            <DataList className="compact overview-core-data">
              <DataRow label="工厂总数" value={formatNumber(totalFacilities)} tone="info" />
              <DataRow label="正在运行" value={formatNumber(derived.runningFacilities)} tone="success" />
              <DataRow label="生产受阻" value={formatNumber(derived.blockedFacilities)} tone={derived.blockedFacilities ? 'danger' : 'neutral'} />
              <DataRow label="主动停工" value={formatNumber(derived.stoppedFacilities)} tone={derived.stoppedFacilities ? 'warning' : 'neutral'} />
              <DataRow label="理论日产量" value={formatNumber(theoreticalDailyOutput)} tone="info" />
            </DataList>
            <div className="overview-production-footnote">
              <span>施工 {formatNumber(derived.constructingFacilities)}</span>
              <span>下一周期加入 {formatNumber(pendingJoin)}</span>
              <span>待改种 {formatNumber(pendingRecipeChanges)} 组</span>
            </div>
          </Panel>

          <Panel className="widget overview-summary-card overview-assets-card">
            <WidgetHeading title="资产与银行" action={<Button variant="text" onClick={() => setTab('bank')}>查看详情</Button>} />
            <DataList className="compact overview-core-data">
              <DataRow label="现金资产" value={<CurrencyAmount>{formatCurrency(derived.cashValue)}</CurrencyAmount>} />
              <DataRow label="商品估值" value={<CurrencyAmount>{formatCurrency(derived.commodityValue)}</CurrencyAmount>} />
              <DataRow label="工厂估值" value={<CurrencyAmount>{formatCurrency(derived.facilityValue)}</CurrencyAmount>} />
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

          <Panel className="widget overview-summary-card overview-open-orders-card">
            <WidgetHeading title="当前挂单" action={<Button variant="text" onClick={() => setTab('market')}>管理订单</Button>} />
            <DataList className="compact overview-order-summary">
              <DataRow label="买单" value={`${formatNumber(buyOrderCount)} 笔`} tone={buyOrderCount ? 'success' : 'neutral'} />
              <DataRow label="卖单" value={`${formatNumber(sellOrderCount)} 笔`} tone={sellOrderCount ? 'danger' : 'neutral'} />
              <DataRow label="冻结资金" value={<CurrencyAmount>{formatCurrency(game.frozenCredits)}</CurrencyAmount>} tone={game.frozenCredits ? 'warning' : 'neutral'} />
            </DataList>
            <div className={openOrdersListClassName}>
              {ownOpenOrders.map((order) => {
                const assetId = orderAssetId(order);
                const facilityOrder = orderKind(order) === 'facility';
                const assetName = facilityOrder
                  ? game.facilityTypes.find((facility) => facility.id === assetId)?.name ?? assetId
                  : game.products.find((product) => product.id === assetId)?.name ?? assetId;
                return (
                  <div className="overview-open-order" key={order.id}>
                    <div className="overview-open-order-identity">
                      {facilityOrder ? (
                        <span className="overview-facility-label"><FactoryIcon /><strong>{assetName}</strong></span>
                      ) : (
                        <ProductIconLabel productId={assetId}>{assetName}</ProductIconLabel>
                      )}
                      <small>{facilityOrder ? '工厂' : '商品'} · {formatTime(order.createdAt)}</small>
                    </div>
                    <div className="overview-open-order-values">
                      <StatusTag tone={order.side === 'buy' ? 'success' : 'danger'}>{order.side === 'buy' ? '买入' : '卖出'}</StatusTag>
                      <strong><CurrencyAmount>{formatCurrency(order.price)}</CurrencyAmount></strong>
                      <small>{formatNumber(order.remaining)}/{formatNumber(order.quantity)} · {orderStatusNames[order.status]}</small>
                    </div>
                  </div>
                );
              })}
              {ownOpenOrders.length === 0 ? <EmptyState className="overview-compact-empty">当前没有未完成订单。</EmptyState> : null}
            </div>
          </Panel>
        </div>
      </div>
    </PageLayout>
  );
}
